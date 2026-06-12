import { NextResponse } from "next/server";
import { getJobStats } from "@/lib/queries/stats";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    const userRole = user?.user_metadata?.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getJobStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching job stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch job stats" },
      { status: 500 }
    );
  }
}

export type GetJobStatsResponse = Awaited<ReturnType<typeof getJobStats>>;
