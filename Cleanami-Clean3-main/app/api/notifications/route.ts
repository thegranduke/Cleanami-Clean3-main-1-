import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { notifications } from "@/db/schemas";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;
    const userRole = user?.user_metadata?.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recent = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
    return NextResponse.json(recent);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
