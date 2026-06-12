import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, jobsToCleaners } from "@/db/schemas";
import { eq, and } from "drizzle-orm";
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
    const { cleanerId, role = "primary" } = await request.json();

    if (!cleanerId) {
      return NextResponse.json(
        { error: "Cleaner ID is required" },
        { status: 400 }
      );
    }

    // Remove existing primary cleaner
    await db
      .delete(jobsToCleaners)
      .where(
        and(eq(jobsToCleaners.jobId, id), eq(jobsToCleaners.role, "primary"))
      );

    // Assign new cleaner
    await db.insert(jobsToCleaners).values({
      jobId: id,
      cleanerId,
      role,
    });

    // Update job status
    await db
      .update(jobs)
      .set({
        status: "assigned",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reassigning cleaner:", error);
    return NextResponse.json(
      { error: "Failed to reassign cleaner" },
      { status: 500 }
    );
  }
}
