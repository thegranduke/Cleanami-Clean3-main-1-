import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPaymentIntentForSignup } from "@/lib/services/create-payment-intent.service";
import {
  deserializeSignupFormDataFromServer,
  SerializableSignupFormData,
} from "@/lib/validations/bookng-modal/serialize-signup-form";

const bodySchema = z.object({
  formData: z.record(z.string(), z.unknown()),
  clientSideAmount: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment request." },
        { status: 400 }
      );
    }

    const formData = deserializeSignupFormDataFromServer(
      parsed.data.formData as SerializableSignupFormData
    );

    const result = await createPaymentIntentForSignup(
      formData,
      parsed.data.clientSideAmount
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ clientSecret: result.clientSecret });
  } catch (error) {
    console.error("[POST /api/payment/create-intent]", error);
    return NextResponse.json(
      { error: "Could not initialize payment. Please try again." },
      { status: 500 }
    );
  }
}
