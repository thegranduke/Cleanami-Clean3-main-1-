import { NextRequest, NextResponse } from "next/server";
import {
  cleanerAuthErrorStatus,
  getCleanerAuth,
} from "@/lib/cleaner-auth";
import {
  formatDateRange,
  getDeadlineStatus,
  getTwoWeekPeriod,
} from "@/lib/cleaner/availability-deadline";
import {
  getCleanerAvailability,
  saveCleanerAvailability,
  type AvailabilityDayInput,
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

export async function POST(request: NextRequest) {
  const { cleanerId, error } = await getCleanerAuth();
  if (!cleanerId) {
    return NextResponse.json(
      { error: error ?? "Unauthorized" },
      { status: cleanerAuthErrorStatus(error) }
    );
  }

  try {
    const body = (await request.json()) as { days?: AvailabilityDayInput[] };
    const days = body.days;

    if (!days?.length) {
      return NextResponse.json(
        { error: "days array is required" },
        { status: 400 }
      );
    }

    const period = getTwoWeekPeriod();
    const deadline = getDeadlineStatus(period.start);

    if (deadline.rejected) {
      return NextResponse.json(
        {
          error:
            "Submission is more than 24 hours past the Sunday 6 PM deadline and cannot be accepted.",
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
      if (!day.isAvailable && day.onCallEligible) {
        return NextResponse.json(
          { error: "On-call cannot be enabled when not available" },
          { status: 400 }
        );
      }
    }

    const { period: savedPeriod } = await saveCleanerAvailability(
      cleanerId,
      days,
      deadline.isGracePeriod
    );

    return NextResponse.json({
      success: true,
      message: `Availability saved for ${formatDateRange(savedPeriod.start, savedPeriod.end)}`,
      isGracePeriod: deadline.isGracePeriod,
      pastDeadline: deadline.pastDeadline,
    });
  } catch (err) {
    console.error("[POST /api/cleaner/availability]", err);
    return NextResponse.json(
      { error: "Failed to save availability" },
      { status: 500 }
    );
  }
}
