import "server-only";

import { db } from "@/db";
import { availability } from "@/db/schemas";
import {
  formatDayLabel,
  getDeadlineStatus,
  getTwoWeekPeriod,
  type AvailabilityPeriod,
} from "@/lib/cleaner/availability-deadline";
import { and, eq, gte, lte } from "drizzle-orm";

export type AvailabilityDayInput = {
  date: string;
  isAvailable: boolean;
  onCallEligible: boolean;
};

export type AvailabilityDayState = {
  date: string;
  label: string;
  isAvailable: boolean;
  onCallEligible: boolean;
};

const DEFAULT_START = "08:00:00";
const DEFAULT_END = "20:00:00";

export async function getCleanerAvailability(
  cleanerId: string
): Promise<{
  period: AvailabilityPeriod;
  days: AvailabilityDayState[];
  deadline: ReturnType<typeof getDeadlineStatus>;
}> {
  const period = getTwoWeekPeriod();
  const deadline = getDeadlineStatus(period.start);

  const rows = await db.query.availability.findMany({
    where: and(
      eq(availability.cleanerId, cleanerId),
      gte(availability.date, period.start),
      lte(availability.date, period.end)
    ),
  });

  const byDate = new Map(
    rows.map((row) => [
      row.date,
      {
        isAvailable: true,
        onCallEligible: row.onCallEligible ?? false,
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
    };
  });

  return { period, days, deadline };
}

export async function saveCleanerAvailability(
  cleanerId: string,
  days: AvailabilityDayInput[],
  isGracePeriod: boolean
): Promise<{ period: AvailabilityPeriod }> {
  const period = getTwoWeekPeriod();
  const now = new Date();

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
        openPoolEligible: true,
        isGracePeriod,
        submittedAt: now,
      });
    }
  }

  return { period };
}
