import "server-only";

import {
  formatDateRange,
  getAvailabilityWindow,
  type AvailabilityPeriod,
} from "@/lib/cleaner/availability-deadline";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/New_York";

export function getTodayEtIso(reference = new Date()): string {
  return format(toZonedTime(reference, TZ), "yyyy-MM-dd");
}

/** Remaining days in the operational period (today through period end, ET). */
export function getBootstrapEligibleDates(
  period: AvailabilityPeriod,
  reference = new Date()
): string[] {
  const today = getTodayEtIso(reference);
  return period.dates.filter((date) => date >= today);
}

export function getBootstrapAvailabilityMessage(
  period: AvailabilityPeriod,
  bootstrapDates: string[]
): string {
  if (bootstrapDates.length === 0) {
    return "This availability block has no remaining days to submit.";
  }

  const first = bootstrapDates[0];
  const last = bootstrapDates[bootstrapDates.length - 1];

  return `You joined during an active availability block. Set your schedule for ${formatDateRange(first, last)} (including On-call and Open Pool). Days before today in ${formatDateRange(period.start, period.end)} are already locked for this cycle.`;
}

export type AvailabilityBootstrapState = {
  canBootstrap: boolean;
  bootstrapDates: string[];
  bootstrapMessage: string | null;
};

export function resolveAvailabilityBootstrapState(input: {
  displayMode: ReturnType<typeof getAvailabilityWindow>["displayMode"];
  period: AvailabilityPeriod;
  existingRowCount: number;
  reference?: Date;
}): AvailabilityBootstrapState {
  const bootstrapDates = getBootstrapEligibleDates(
    input.period,
    input.reference
  );

  const canBootstrap =
    input.displayMode === "locked" &&
    input.existingRowCount === 0 &&
    bootstrapDates.length > 0;

  return {
    canBootstrap,
    bootstrapDates: canBootstrap ? bootstrapDates : [],
    bootstrapMessage: canBootstrap
      ? getBootstrapAvailabilityMessage(input.period, bootstrapDates)
      : null,
  };
}

/** True when the date is on or after today (ET) within the period. */
export function isBootstrapEligibleDate(
  date: string,
  period: AvailabilityPeriod,
  reference = new Date()
): boolean {
  const today = getTodayEtIso(reference);
  return period.dates.includes(date) && date >= today;
}

export function isDateBeforeTodayEt(
  date: string,
  reference = new Date()
): boolean {
  const today = getTodayEtIso(reference);
  return date < today;
}

/** Used to validate bootstrap payloads server-side. */
export function assertBootstrapDayAllowed(
  date: string,
  period: AvailabilityPeriod,
  bootstrapDates: Set<string>
): void {
  if (!bootstrapDates.has(date)) {
    if (isDateBeforeTodayEt(date)) {
      throw new Error(
        `Cannot submit availability for ${date} — that day has already passed`
      );
    }
    throw new Error(`Date ${date} is outside your mid-cycle submission window`);
  }
}
