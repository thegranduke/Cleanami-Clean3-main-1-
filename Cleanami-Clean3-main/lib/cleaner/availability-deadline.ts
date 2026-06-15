import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const TZ = "America/New_York";

/** Reference submission Sunday (ET) — biweekly cycles align every 14 days from this date. */
const SUBMISSION_ANCHOR_SUNDAY = "2025-01-05";

export type AvailabilityPeriod = {
  start: string;
  end: string;
  dates: string[];
};

export type AvailabilityDisplayMode = "submit" | "locked" | "preview";

export type SubmissionLateStatus =
  | "on_time"
  | "late_accepted"
  | "late_warning"
  | null;

export type DeadlineClosedReason =
  | "off_week_sunday"
  | "outside_submission_window"
  | "past_grace";

export type DeadlineStatus = {
  pastDeadline: boolean;
  /** Late tier when in the submission window; null otherwise. */
  lateStatus: SubmissionLateStatus;
  /** True when submission is after the deadline (late_accepted or late_warning). */
  isGracePeriod: boolean;
  rejected: boolean;
  /** Full biweekly availability submission (all day toggles). */
  canSubmitRegular: boolean;
  /** On-call / open pool only — allowed outside the submission window on locked periods. */
  canEditPreferences: boolean;
  offWeekSunday: boolean;
  closedReason: DeadlineClosedReason | null;
  submissionSunday: string;
  nextSubmissionSunday: string;
  deadline: Date;
};

export type AvailabilityWindow = {
  period: AvailabilityPeriod;
  deadline: DeadlineStatus;
  displayMode: AvailabilityDisplayMode;
};

function parseEtNoon(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return toZonedTime(new Date(year, month - 1, day, 12, 0, 0), TZ);
}

function toEtIso(date: Date): string {
  return format(toZonedTime(date, TZ), "yyyy-MM-dd");
}

function daysBetweenEt(isoA: string, isoB: string): number {
  const a = parseEtNoon(isoA).getTime();
  const b = parseEtNoon(isoB).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function getThisWeekMonday(nowEt: Date): Date {
  const today = parseEtNoon(toEtIso(nowEt));
  const day = today.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return addDays(today, -daysFromMonday);
}

/** True when `isoDate` is a Sunday on the biweekly submission cadence. */
export function isBiweeklySubmissionSunday(isoDate: string): boolean {
  const date = parseEtNoon(isoDate);
  if (date.getDay() !== 0) return false;
  return daysBetweenEt(isoDate, SUBMISSION_ANCHOR_SUNDAY) % 14 === 0;
}

/** Sunday immediately before the period-start Monday. */
export function getSubmissionSundayForPeriodStart(
  periodStartMonday: string
): string {
  return toEtIso(addDays(parseEtNoon(periodStartMonday), -1));
}

function getSubmissionWindowBounds(periodStartMonday: string): {
  windowStart: Date;
  deadline: Date;
  graceEnd: Date;
} {
  const submissionSundayIso =
    getSubmissionSundayForPeriodStart(periodStartMonday);
  const sundayLocal = parseEtNoon(submissionSundayIso);
  sundayLocal.setHours(0, 0, 0, 0);
  const windowStart = fromZonedTime(sundayLocal, TZ);
  const deadline = getSubmissionDeadline(periodStartMonday);
  const graceEnd = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);
  return { windowStart, deadline, graceEnd };
}

/** Submission opens 00:00 ET on the biweekly submission Sunday; closes after 24h grace. */
export function isWithinSubmissionWindow(
  periodStartMonday: string,
  now = new Date()
): boolean {
  if (
    !isBiweeklySubmissionSunday(
      getSubmissionSundayForPeriodStart(periodStartMonday)
    )
  ) {
    return false;
  }
  const { windowStart, graceEnd } = getSubmissionWindowBounds(periodStartMonday);
  return now >= windowStart && now <= graceEnd;
}

export function getLateSubmissionStatus(
  periodStartMonday: string,
  now = new Date()
): SubmissionLateStatus | "rejected" {
  if (!isWithinSubmissionWindow(periodStartMonday, now)) {
    const submissionSunday = getSubmissionSundayForPeriodStart(periodStartMonday);
    if (!isBiweeklySubmissionSunday(submissionSunday)) {
      return "rejected";
    }
    const { graceEnd } = getSubmissionWindowBounds(periodStartMonday);
    return now > graceEnd ? "rejected" : null;
  }

  const { deadline, graceEnd } = getSubmissionWindowBounds(periodStartMonday);
  if (now <= deadline) return "on_time";

  const oneHourLate = new Date(deadline.getTime() + 60 * 60 * 1000);
  if (now <= oneHourLate) return "late_accepted";
  if (now <= graceEnd) return "late_warning";

  return "rejected";
}

function findNextBiweeklySubmissionSunday(fromEt: Date): string {
  const startIso = toEtIso(fromEt);
  for (let offset = 0; offset <= 28; offset++) {
    const candidate = addDays(parseEtNoon(startIso), offset);
    if (candidate.getDay() !== 0) continue;
    const iso = toEtIso(candidate);
    if (isBiweeklySubmissionSunday(iso)) return iso;
  }
  return toEtIso(addDays(fromEt, 14));
}

function buildPeriodFromMonday(periodStartMonday: string): AvailabilityPeriod {
  const periodStart = parseEtNoon(periodStartMonday);
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    dates.push(toEtIso(addDays(periodStart, i)));
  }
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    dates,
  };
}

function findActiveSubmissionPeriodMonday(now: Date): string | null {
  const nowEt = toZonedTime(now, TZ);
  const todayIso = toEtIso(nowEt);

  for (let offset = -20; offset <= 0; offset++) {
    const sunday = addDays(parseEtNoon(todayIso), offset);
    if (sunday.getDay() !== 0) continue;
    const sundayIso = toEtIso(sunday);
    if (!isBiweeklySubmissionSunday(sundayIso)) continue;
    const mondayIso = toEtIso(addDays(sunday, 1));
    if (isWithinSubmissionWindow(mondayIso, now)) return mondayIso;
  }

  return null;
}

/** Biweekly block currently in effect (contains today). */
function findOperationalPeriodMonday(now: Date): string | null {
  const nowEt = toZonedTime(now, TZ);
  const todayIso = toEtIso(nowEt);
  const thisMonday = getThisWeekMonday(nowEt);

  for (const weekOffset of [0, -7, -14]) {
    const mondayIso = toEtIso(addDays(thisMonday, weekOffset));
    const submissionSunday = getSubmissionSundayForPeriodStart(mondayIso);
    if (!isBiweeklySubmissionSunday(submissionSunday)) continue;
    const period = buildPeriodFromMonday(mondayIso);
    if (period.dates.includes(todayIso)) return mondayIso;
  }

  return null;
}

function findNextBiweeklyPeriodMonday(now: Date): string {
  const nowEt = toZonedTime(now, TZ);
  return toEtIso(
    addDays(parseEtNoon(findNextBiweeklySubmissionSunday(nowEt)), 1)
  );
}

function buildClosedDeadline(
  periodStartMonday: string,
  now: Date,
  overrides: Partial<DeadlineStatus> = {}
): DeadlineStatus {
  const base = getDeadlineStatus(periodStartMonday, now);
  return {
    ...base,
    canSubmitRegular: false,
    canEditPreferences: false,
    ...overrides,
  };
}

export function getAvailabilityWindow(now = new Date()): AvailabilityWindow {
  const activeMonday = findActiveSubmissionPeriodMonday(now);

  if (activeMonday) {
    const period = buildPeriodFromMonday(activeMonday);
    const deadline = getDeadlineStatus(period.start, now);
    return { period, deadline, displayMode: "submit" };
  }

  const operationalMonday = findOperationalPeriodMonday(now);
  if (operationalMonday) {
    const period = buildPeriodFromMonday(operationalMonday);
    const nextMonday = findNextBiweeklyPeriodMonday(now);
    const deadline = buildClosedDeadline(nextMonday, now, {
      canEditPreferences: true,
      closedReason: "outside_submission_window",
    });
    return { period, deadline, displayMode: "locked" };
  }

  const nextMonday = findNextBiweeklyPeriodMonday(now);
  const period = buildPeriodFromMonday(nextMonday);
  const deadline = buildClosedDeadline(period.start, now);
  return { period, deadline, displayMode: "preview" };
}

/** Next 14 days for the current display / submission block. */
export function getTwoWeekPeriod(now = new Date()): AvailabilityPeriod {
  return getAvailabilityWindow(now).period;
}

/** Sunday 6 PM ET immediately before the period start date. */
export function getSubmissionDeadline(periodStartDate: string): Date {
  const periodStart = parseEtNoon(periodStartDate);
  const dayOfWeek = periodStart.getDay();
  const daysBack = dayOfWeek === 0 ? 7 : dayOfWeek;

  const deadlineLocal = addDays(periodStart, -daysBack);
  deadlineLocal.setHours(18, 0, 0, 0);

  return fromZonedTime(deadlineLocal, TZ);
}

export function getDeadlineStatus(
  periodStartDate: string,
  now = new Date()
): DeadlineStatus {
  const nowEt = toZonedTime(now, TZ);
  const todayIso = toEtIso(nowEt);
  const submissionSunday = getSubmissionSundayForPeriodStart(periodStartDate);
  const nextSubmissionSunday = findNextBiweeklySubmissionSunday(nowEt);
  const offWeekSunday =
    nowEt.getDay() === 0 && !isBiweeklySubmissionSunday(todayIso);
  const { deadline, graceEnd } = getSubmissionWindowBounds(periodStartDate);

  if (!isBiweeklySubmissionSunday(submissionSunday)) {
    return {
      pastDeadline: true,
      lateStatus: null,
      isGracePeriod: false,
      rejected: true,
      canSubmitRegular: false,
      canEditPreferences: false,
      offWeekSunday,
      closedReason: offWeekSunday
        ? "off_week_sunday"
        : "outside_submission_window",
      submissionSunday,
      nextSubmissionSunday,
      deadline,
    };
  }

  const inWindow = isWithinSubmissionWindow(periodStartDate, now);
  const lateResult = getLateSubmissionStatus(periodStartDate, now);

  if (!inWindow) {
    const pastGrace = now > graceEnd;
    return {
      pastDeadline: pastGrace || now > deadline,
      lateStatus: null,
      isGracePeriod: false,
      rejected: true,
      canSubmitRegular: false,
      canEditPreferences: false,
      offWeekSunday,
      closedReason: offWeekSunday
        ? "off_week_sunday"
        : pastGrace
          ? "past_grace"
          : "outside_submission_window",
      submissionSunday,
      nextSubmissionSunday,
      deadline,
    };
  }

  if (lateResult === "rejected") {
    return {
      pastDeadline: true,
      lateStatus: null,
      isGracePeriod: false,
      rejected: true,
      canSubmitRegular: false,
      canEditPreferences: false,
      offWeekSunday: false,
      closedReason: "past_grace",
      submissionSunday,
      nextSubmissionSunday,
      deadline,
    };
  }

  const lateStatus = lateResult;
  const isLate = lateStatus === "late_accepted" || lateStatus === "late_warning";

  return {
    pastDeadline: isLate,
    lateStatus,
    isGracePeriod: isLate,
    rejected: false,
    canSubmitRegular: true,
    canEditPreferences: true,
    offWeekSunday: false,
    closedReason: null,
    submissionSunday,
    nextSubmissionSunday,
    deadline,
  };
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    parseEtNoon(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TZ,
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDayLabel(iso: string): string {
  return parseEtNoon(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
}

export function formatSubmissionSundayLabel(iso: string): string {
  return parseEtNoon(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  });
}

export function getSubmissionClosedMessage(
  deadline: DeadlineStatus,
  period: AvailabilityPeriod,
  displayMode: AvailabilityDisplayMode
): string {
  const periodRange = formatDateRange(period.start, period.end);
  const nextSunday = formatSubmissionSundayLabel(deadline.nextSubmissionSunday);

  if (displayMode === "locked") {
    return `Regular availability for ${periodRange} is locked. You can still update On-Call and Open Pool for days you marked available. Next full submission: ${nextSunday} before 6 PM ET.`;
  }

  if (deadline.offWeekSunday) {
    return `Availability submissions happen every other Sunday. Submissions are closed today. Submit for ${periodRange} on ${nextSunday} before 6 PM ET.`;
  }

  if (deadline.closedReason === "outside_submission_window") {
    return `Submissions for ${periodRange} open on ${nextSunday} at 12:00 AM ET and close at 6 PM ET (24-hour grace until Monday 6 PM ET).`;
  }

  if (deadline.closedReason === "past_grace") {
    return `Submissions for ${periodRange} are closed — more than 24 hours past the Sunday 6 PM ET deadline. Your most recent submitted availability remains in effect. Next submission: ${nextSunday} before 6 PM ET.`;
  }

  return `Submissions are currently closed. Next submission: ${nextSunday} before 6 PM ET.`;
}

export function getLateSubmissionMessage(
  lateStatus: SubmissionLateStatus
): string | null {
  if (lateStatus === "late_accepted") {
    return "Submitted after the 6 PM ET deadline. Your availability was accepted.";
  }
  if (lateStatus === "late_warning") {
    return "Submitted more than 1 hour after the deadline. Your availability was accepted, but late submissions may not be fully considered.";
  }
  return null;
}

/** Maps late status to DB submission_status enum value. */
export function toSubmissionStatus(
  lateStatus: SubmissionLateStatus
): "on_time" | "late_accepted" | "late_warning" {
  if (lateStatus === "late_accepted") return "late_accepted";
  if (lateStatus === "late_warning") return "late_warning";
  return "on_time";
}
