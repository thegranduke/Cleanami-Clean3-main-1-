import { NextRequest, NextResponse } from "next/server";
import { getJobsWithDetails } from "@/lib/queries/jobs";
import { createClient } from "@/lib/supabase/server";
import {
  customerAuthErrorStatus,
  getCustomerAuth,
} from "@/lib/customer-auth";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    const userRole = user?.user_metadata?.role;

    const isAdmin = userRole === "admin" || userRole === "super_admin";
    const isCustomer = userRole === "user";

    if (!isAdmin && !isCustomer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let customerId: string | undefined;

    if (isCustomer) {
      const { customerId: resolvedCustomerId, error } = await getCustomerAuth();
      if (!resolvedCustomerId) {
        return NextResponse.json(
          { error: error ?? "Unauthorized", data: [], nextPage: null },
          { status: customerAuthErrorStatus(error) }
        );
      }
      customerId = resolvedCustomerId;
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = (searchParams.get("status") || "all") as
      | "unassigned"
      | "assigned"
      | "in-progress"
      | "completed"
      | "canceled"
      | "all";
    const query = searchParams.get("query") || "";

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
      customerId,
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
