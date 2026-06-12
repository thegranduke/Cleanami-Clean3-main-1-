import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { swapRequests } from "@/db/schemas";
import { eq } from "drizzle-orm";

export async function PATCH(
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
    const { action } = (await request.json()) as { action?: string };

    if (!action || !["accept", "deny"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const targetRequest = await db.query.swapRequests.findFirst({
      where: eq(swapRequests.id, id),
    });

    if (!targetRequest) {
      return NextResponse.json({ error: "Swap request not found" }, { status: 404 });
    }

    if (targetRequest.status !== "pending") {
      return NextResponse.json({ error: "Swap request is no longer pending" }, { status: 409 });
    }

    const newStatus = action === "accept" ? "accepted" : "cancelled";

    await db
      .update(swapRequests)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(swapRequests.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating swap request:", error);
    return NextResponse.json(
      { error: "Failed to update swap request" },
      { status: 500 }
    );
  }
}