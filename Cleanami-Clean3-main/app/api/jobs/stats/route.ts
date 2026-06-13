import { NextResponse } from "next/server";
import { getJobStats } from "@/lib/queries/stats";
import { createClient } from "@/lib/supabase/server";
import {
  customerAuthErrorStatus,
  getCustomerAuth,
} from "@/lib/customer-auth";

export async function GET() {
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
          { error: error ?? "Unauthorized" },
          { status: customerAuthErrorStatus(error) }
        );
      }
      customerId = resolvedCustomerId;
    }

    const stats = await getJobStats(customerId);
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
