import { NextRequest, NextResponse } from "next/server";
import { getPropertiesWithOwner } from "@/lib/queries/properties";
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
    const query = searchParams.get("query") || "";

    const result = await getPropertiesWithOwner({
      page,
      limit,
      query,
      customerId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}
