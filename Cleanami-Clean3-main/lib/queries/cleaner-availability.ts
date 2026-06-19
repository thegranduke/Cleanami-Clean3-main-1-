import "server-only";

import { db } from "@/db";
import { availability } from "@/db/schemas";
import {
  formatDayLabel,
  getAvailabilityWindow,
  getSubmissionClosedMessage,
  toSubmissionStatus,
  type AvailabilityDisplayMode,
  type AvailabilityPeriod,
  type SubmissionLateStatus,
} from "@/lib/cleaner/availability-deadline";
import {
  resolveAvailabilityBootstrapState,
} from "@/lib/cleaner/availability-bootstrap";
import { and, eq, gte, lte } from "drizzle-orm";

export type AvailabilityDayInput = {
  date: string;
  isAvailable: boolean;
  onCallEligible: boolean;
  openPoolEligible?: boolean;
};

export type AvailabilityPreferenceInput = {
  date: string;
  onCallEligible: boolean;
  openPoolEligible: boolean;
};

export type AvailabilityDayState = {
  date: string;
  label: string;
  isAvailable: boolean;
  onCallEligible: boolean;
  openPoolEligible: boolean;
};

const DEFAULT_START = "08:00:00";
const DEFAULT_END = "20:00:00";

export async function countCleanerAvailabilityInPeriod(
  cleanerId: string,
  period: AvailabilityPeriod
): Promise<number> {
  const rows = await db.query.availability.findMany({
    where: and(
      eq(availability.cleanerId, cleanerId),
      gte(availability.date, period.start),
      lte(availability.date, period.end)
    ),
    columns: { id: true },
  });

  return rows.length;
}

export async function getCleanerAvailability(
  cleanerId: string
): Promise<{
  period: AvailabilityPeriod;
  days: AvailabilityDayState[];
  deadline: ReturnType<typeof getAvailabilityWindow>["deadline"];
  displayMode: AvailabilityDisplayMode;
  closedMessage: string | null;
  canBootstrap: boolean;
  bootstrapDates: string[];
  bootstrapMessage: string | null;
}> {
  const { period, deadline, displayMode } = getAvailabilityWindow();

  const rows = await db.query.availability.findMany({
    where: and(
      eq(availability.cleanerId, cleanerId),
      gte(availability.date, period.start),
      lte(availability.date, period.end)
    ),
  });

  const bootstrap = resolveAvailabilityBootstrapState({
    displayMode,
    period,
    existingRowCount: rows.length,
  });

  const closedMessage = bootstrap.canBootstrap
    ? null
    : deadline.canSubmitRegular
      ? null
      : getSubmissionClosedMessage(deadline, period, displayMode);

  const byDate = new Map(
    rows.map((row) => [
      row.date,
      {
        isAvailable: true,
        onCallEligible: row.onCallEligible ?? false,
        openPoolEligible: row.openPoolEligible ?? false,
      },
    ])
  );

  const days = period.dates.map((date) => {
    const existing = byDate.get(date);
    return {
      date,
      label: formatDayLabel(date),
      isAvailable: existing?.isAvailable ?? false,
      onCallEligible: existing?.onCallEligible ?? false,
      openPoolEligible: existing?.openPoolEligible ?? false,
    };
  });

  return {
    period,
    days,
    deadline,
    displayMode,
    closedMessage,
    canBootstrap: bootstrap.canBootstrap,
    bootstrapDates: bootstrap.bootstrapDates,
    bootstrapMessage: bootstrap.bootstrapMessage,
  };
}

export async function saveCleanerAvailability(
  cleanerId: string,
  days: AvailabilityDayInput[],
  lateStatus: SubmissionLateStatus
): Promise<{ period: AvailabilityPeriod }> {
  const { period } = getAvailabilityWindow();
  const now = new Date();
  const submissionStatus = toSubmissionStatus(lateStatus);
  const isGracePeriod =
    lateStatus === "late_accepted" || lateStatus === "late_warning";

  for (const day of days) {
    await db
      .delete(availability)
      .where(
        and(
          eq(availability.cleanerId, cleanerId),
          eq(availability.date, day.date)
        )
      );

    if (day.isAvailable) {
      await db.insert(availability).values({
        cleanerId,
        date: day.date,
        availabilityType: "vacation_rental",
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        onCallEligible: day.onCallEligible,
        openPoolEligible: day.openPoolEligible ?? false,
        isGracePeriod,
        submissionStatus,
        submittedAt: now,
      });
    }
  }

  return { period };
}

export async function saveCleanerAvailabilityPreferences(
  cleanerId: string,
  preferences: AvailabilityPreferenceInput[]
): Promise<{ period: AvailabilityPeriod }> {
  const { period } = getAvailabilityWindow();

  for (const pref of preferences) {
    if (!period.dates.includes(pref.date)) {
      throw new Error(`Date ${pref.date} is outside the current period`);
    }

    const existing = await db.query.availability.findFirst({
      where: and(
        eq(availability.cleanerId, cleanerId),
        eq(availability.date, pref.date)
      ),
    });

    if (!existing) {
      throw new Error(
        `Cannot update preferences for ${pref.date} — no availability submitted for that day`
      );
    }

    if (!pref.onCallEligible && !pref.openPoolEligible) {
      // Still allow turning both off while keeping the day available
    }

    await db
      .update(availability)
      .set({
        onCallEligible: pref.onCallEligible,
        openPoolEligible: pref.openPoolEligible,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(availability.cleanerId, cleanerId),
          eq(availability.date, pref.date)
        )
      );
  }

  return { period };
}

export async function saveCleanerBootstrapAvailability(
  cleanerId: string,
  days: AvailabilityDayInput[],
  bootstrapDates: string[]
): Promise<{ period: AvailabilityPeriod }> {
  const { period } = getAvailabilityWindow();
  const allowed = new Set(bootstrapDates);
  const now = new Date();

  for (const day of days) {
    if (!allowed.has(day.date)) {
      continue;
    }

    await db
      .delete(availability)
      .where(
        and(
          eq(availability.cleanerId, cleanerId),
          eq(availability.date, day.date)
        )
      );

    if (day.isAvailable) {
      await db.insert(availability).values({
        cleanerId,
        date: day.date,
        availabilityType: "vacation_rental",
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        onCallEligible: day.onCallEligible,
        openPoolEligible: day.openPoolEligible ?? false,
        isGracePeriod: false,
        submissionStatus: "on_time",
        submittedAt: now,
      });
    }
  }

  return { period };
}
