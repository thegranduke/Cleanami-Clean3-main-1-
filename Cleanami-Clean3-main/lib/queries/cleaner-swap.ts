import "server-only";

import { db } from "@/db";
import { jobs, swapRequests } from "@/db/schemas";
import { eq, and, sql } from "drizzle-orm";

const SWAP_LIMIT = 3;
const HOURS_BEFORE_JOB = 24;

type SwapEligibilityRow = {
  cleaner_id: string;
  full_name: string;
  reliability_score: string | number | null;
  swap_count: number;
  is_eligible: boolean;
  conflict_reason: string | null;
};

function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

export async function createCleanerSwapRequest(
  cleanerId: string,
  jobId: string
): Promise<
  | {
      success: true;
      eligibleCleanerNames: string[];
      message: string;
    }
  | { success: false; message: string }
> {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: { cleaners: true },
  });

  if (!job) {
    return { success: false, message: "Job not found." };
  }

  const isAssigned = job.cleaners.some((c) => c.cleanerId === cleanerId);
  if (!isAssigned) {
    return { success: false, message: "You are not assigned to this job." };
  }

  if (!job.checkInTime) {
    return {
      success: false,
      message: "This job does not have a scheduled start time yet.",
    };
  }

  const msUntilJob = job.checkInTime.getTime() - Date.now();
  if (msUntilJob <= HOURS_BEFORE_JOB * 60 * 60 * 1000) {
    return {
      success: false,
      message:
        "Swaps must be requested more than 24 hours before the job starts.",
    };
  }

  const swapCountRows = await db.execute<{ get_cleaner_swap_count: number }>(
    sql`SELECT get_cleaner_swap_count(${cleanerId}::uuid) as get_cleaner_swap_count`
  );
  const swapCount = Number(swapCountRows[0]?.get_cleaner_swap_count ?? 0);

  if (swapCount >= SWAP_LIMIT) {
    return {
      success: false,
      message: `You've reached the swap limit (${SWAP_LIMIT} per 60 days).`,
    };
  }

  const existingPending = await db.query.swapRequests.findFirst({
    where: and(
      eq(swapRequests.jobId, jobId),
      eq(swapRequests.originalCleanerId, cleanerId),
      eq(swapRequests.status, "pending")
    ),
  });

  if (existingPending) {
    return {
      success: false,
      message: "You already have a pending swap request for this job.",
    };
  }

  const eligibilityRows = await db.execute<SwapEligibilityRow>(
    sql`SELECT * FROM check_swap_eligibility(${jobId}::uuid, ${cleanerId}::uuid)`
  );

  const eligible = eligibilityRows.filter((r) => r.is_eligible);

  if (eligible.length === 0) {
    const reason =
      eligibilityRows.find((r) => r.conflict_reason)?.conflict_reason ??
      "No eligible cleaners are available for a swap right now.";
    return { success: false, message: reason };
  }

  const expiresAt = new Date(
    job.checkInTime.getTime() - HOURS_BEFORE_JOB * 60 * 60 * 1000
  );

  await db.insert(swapRequests).values({
    jobId,
    originalCleanerId: cleanerId,
    status: "pending",
    expiresAt,
  });

  return {
    success: true,
    eligibleCleanerNames: eligible.map((r) => firstName(r.full_name)),
    message: "Your swap request has been sent to available cleaners.",
  };
}
