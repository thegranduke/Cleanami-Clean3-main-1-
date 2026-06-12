import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, jobsToCleaners } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    const userRole = user?.user_metadata?.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    await db.delete(jobsToCleaners).where(eq(jobsToCleaners.jobId, id));

    await db
      .update(jobs)
      .set({
        status: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling job:", error);
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
