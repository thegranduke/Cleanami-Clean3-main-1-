import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { notifications } from "@/db/schemas";
import { eq } from "drizzle-orm";

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
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
