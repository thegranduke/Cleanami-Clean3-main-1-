import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionsWithDetails } from "@/lib/queries/subscriptions";
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

    const result = await getSubscriptionsWithDetails({
      page,
      limit,
      status,
      query,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}
