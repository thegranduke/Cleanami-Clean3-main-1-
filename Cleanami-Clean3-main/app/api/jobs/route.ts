import { NextRequest, NextResponse } from "next/server";
import { getJobsWithDetails } from "@/lib/queries/jobs";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    const userRole = user?.user_metadata?.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = (searchParams.get("status") || "all") as any;
    const query = searchParams.get("query") || "";

    // Optional date filtering
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;

    const result = await getJobsWithDetails({
      page,
      limit,
      status,
      query,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export type GetJobsResponse = Awaited<ReturnType<typeof getJobsWithDetails>>;
