import { NextRequest, NextResponse } from "next/server";
import {
  cleanerAuthErrorStatus,
  getCleanerAuth,
} from "@/lib/cleaner-auth";
import { requireCleanerAssignmentEligible } from "@/lib/cleaner/require-eligible";
import {
  assertBootstrapDayAllowed,
  resolveAvailabilityBootstrapState,
} from "@/lib/cleaner/availability-bootstrap";
import {
  formatDateRange,
  getAvailabilityWindow,
  getLateSubmissionMessage,
  getSubmissionClosedMessage,
} from "@/lib/cleaner/availability-deadline";
import {
  countCleanerAvailabilityInPeriod,
  getCleanerAvailability,
  saveCleanerAvailability,
  saveCleanerAvailabilityPreferences,
  saveCleanerBootstrapAvailability,
  type AvailabilityDayInput,
  type AvailabilityPreferenceInput,
} from "@/lib/queries/cleaner-availability";

export async function GET() {
  const { cleanerId, error } = await getCleanerAuth();
  if (!cleanerId) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: cleanerAuthErrorStatus(error) }
    );
  }

  try {
    const { eligible, error: eligibilityError } =
      await requireCleanerAssignmentEligible(cleanerId);
    if (!eligible) {
      return NextResponse.json(
        { error: eligibilityError ?? "Onboarding required" },
        { status: 403 }
      );
    }

    const data = await getCleanerAvailability(cleanerId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/cleaner/availability]", err);
    return NextResponse.json(
      { error: "Failed to load availability" },
      { status: 500 }
    );
  }
}

type SaveBody = {
  mode?: "full" | "preferences" | "bootstrap";
  days?: AvailabilityDayInput[];
  preferences?: AvailabilityPreferenceInput[];
};

function validateDayFlags(days: AvailabilityDayInput[]) {
  for (const day of days) {
    if (!day.isAvailable && day.onCallEligible) {
      return "On-call cannot be enabled when not available";
    }
    if (!day.isAvailable && day.openPoolEligible) {
      return "Open Pool cannot be enabled when not available";
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { cleanerId, error } = await getCleanerAuth();
  if (!cleanerId) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: cleanerAuthErrorStatus(error) }
    );
  }

  try {
    const { eligible, error: eligibilityError } =
      await requireCleanerAssignmentEligible(cleanerId);
    if (!eligible) {
      return NextResponse.json(
        { error: eligibilityError ?? "Onboarding required" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SaveBody;
    const { period, deadline, displayMode } = getAvailabilityWindow();

    const existingRowCount = await countCleanerAvailabilityInPeriod(
      cleanerId,
      period
    );
    const bootstrap = resolveAvailabilityBootstrapState({
      displayMode,
      period,
      existingRowCount,
    });

    if (body.mode === "bootstrap") {
      const days = body.days;

      if (!days?.length) {
        return NextResponse.json(
          { error: "days array is required" },
          { status: 400 }
        );
      }

      if (!bootstrap.canBootstrap) {
        return NextResponse.json(
          {
            error:
              "Mid-cycle availability setup is not available. You may already have submitted for this block, or the submission window is open.",
          },
          { status: 403 }
        );
      }

      const allowed = new Set(bootstrap.bootstrapDates);
      const flagError = validateDayFlags(days);
      if (flagError) {
        return NextResponse.json({ error: flagError }, { status: 400 });
      }

      for (const day of days) {
        if (!day.isAvailable) {
          continue;
        }
        try {
          assertBootstrapDayAllowed(day.date, period, allowed);
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Invalid date" },
            { status: 400 }
          );
        }
      }

      const { period: savedPeriod } = await saveCleanerBootstrapAvailability(
        cleanerId,
        days,
        bootstrap.bootstrapDates
      );

      return NextResponse.json({
        success: true,
        mode: "bootstrap",
        message: `Availability saved for ${formatDateRange(savedPeriod.start, savedPeriod.end)} (remaining days this cycle)`,
      });
    }

    if (body.mode === "preferences") {
      const preferences = body.preferences;

      if (!preferences?.length) {
        return NextResponse.json(
          { error: "preferences array is required" },
          { status: 400 }
        );
      }

      if (!deadline.canEditPreferences) {
        return NextResponse.json(
          {
            error: getSubmissionClosedMessage(deadline, period, displayMode),
          },
          { status: 403 }
        );
      }

      const validDates = new Set(period.dates);
      for (const pref of preferences) {
        if (!validDates.has(pref.date)) {
          return NextResponse.json(
            { error: `Date ${pref.date} is outside the current period` },
            { status: 400 }
          );
        }
      }

      const { period: savedPeriod } = await saveCleanerAvailabilityPreferences(
        cleanerId,
        preferences
      );

      return NextResponse.json({
        success: true,
        mode: "preferences",
        message: `On-Call and Open Pool updated for ${formatDateRange(savedPeriod.start, savedPeriod.end)}`,
      });
    }

    const days = body.days;

    if (!days?.length) {
      return NextResponse.json(
        { error: "days array is required" },
        { status: 400 }
      );
    }

    if (!deadline.canSubmitRegular) {
      return NextResponse.json(
        {
          error: getSubmissionClosedMessage(deadline, period, displayMode),
        },
        { status: 403 }
      );
    }

    const validDates = new Set(period.dates);
    for (const day of days) {
      if (!validDates.has(day.date)) {
        return NextResponse.json(
          { error: `Date ${day.date} is outside the current period` },
          { status: 400 }
        );
      }
    }

    const flagError = validateDayFlags(days);
    if (flagError) {
      return NextResponse.json({ error: flagError }, { status: 400 });
    }

    const { period: savedPeriod } = await saveCleanerAvailability(
      cleanerId,
      days,
      deadline.lateStatus
    );

    const lateMessage = getLateSubmissionMessage(deadline.lateStatus);

    return NextResponse.json({
      success: true,
      mode: "full",
      message: `Availability saved for ${formatDateRange(savedPeriod.start, savedPeriod.end)}`,
      submissionStatus: deadline.lateStatus ?? "on_time",
      lateMessage,
      isGracePeriod: deadline.isGracePeriod,
      pastDeadline: deadline.pastDeadline,
    });
  } catch (err) {
    console.error("[POST /api/cleaner/availability]", err);
    const message =
      err instanceof Error ? err.message : "Failed to save availability";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
