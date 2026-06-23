import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/admin-auth";
import { mergeProperties } from "@/lib/queries/properties";
import { mergePropertiesSchema } from "@/lib/validations/customer-record";

export async function POST(request: NextRequest) {
  const { isAdmin, error } = await getAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = mergePropertiesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const result = await mergeProperties(
      parsed.data.sourcePropertyId,
      parsed.data.targetPropertyId
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/properties/merge]", err);
    const message =
      err instanceof Error ? err.message : "Failed to merge properties";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
