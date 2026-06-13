import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TZ = "America/New_York";

export type AvailabilityPeriod = {
  start: string;
  end: string;
  dates: string[];
};

export type DeadlineStatus = {
  pastDeadline: boolean;
  isGracePeriod: boolean;
  rejected: boolean;
  deadline: Date;
};

/** Next 14 days starting today (America/New_York). */
export function getTwoWeekPeriod(): AvailabilityPeriod {
  const now = toZonedTime(new Date(), TZ);
  const dates: string[] = [];

  for (let i = 0; i < 14; i++) {
    dates.push(format(addDays(now, i), "yyyy-MM-dd"));
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1],
    dates,
  };
}

/** Sunday 6 PM ET immediately before the period start date. */
export function getSubmissionDeadline(periodStartDate: string): Date {
  const [year, month, day] = periodStartDate.split("-").map(Number);
  const periodStartLocal = new Date(year, month - 1, day, 12, 0, 0);
  const periodStart = toZonedTime(periodStartLocal, TZ);
  const dayOfWeek = periodStart.getDay();
  const daysBack = dayOfWeek === 0 ? 7 : dayOfWeek;

  const deadlineLocal = addDays(periodStart, -daysBack);
  deadlineLocal.setHours(18, 0, 0, 0);

  return fromZonedTime(deadlineLocal, TZ);
}

export function getDeadlineStatus(periodStartDate: string): DeadlineStatus {
  const deadline = getSubmissionDeadline(periodStartDate);
  const now = new Date();
  const graceEnd = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);

  if (now <= deadline) {
    return {
      pastDeadline: false,
      isGracePeriod: false,
      rejected: false,
      deadline,
    };
  }

  if (now <= graceEnd) {
    return {
      pastDeadline: true,
      isGracePeriod: true,
      rejected: false,
      deadline,
    };
  }

  return {
    pastDeadline: true,
    isGracePeriod: false,
    rejected: true,
    deadline,
  };
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TZ,
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}
