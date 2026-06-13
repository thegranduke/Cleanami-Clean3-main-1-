import "server-only";

import { db } from "@/db";
import { cleaners } from "@/db/schemas";
import { stripe } from "@/lib/stripe/config";
import { eq } from "drizzle-orm";

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SERVER_URL ??
    "http://localhost:3000"
  );
}

export async function createStripeOnboardingLink(cleanerId: string) {
  const cleaner = await db.query.cleaners.findFirst({
    where: eq(cleaners.id, cleanerId),
  });

  if (!cleaner) {
    throw new Error("Cleaner not found");
  }

  let accountId = cleaner.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: cleaner.email,
      metadata: { cleanerId: cleaner.id },
      capabilities: {
        transfers: { requested: true },
      },
    });

    accountId = account.id;

    await db
      .update(cleaners)
      .set({ stripeAccountId: accountId, updatedAt: new Date() })
      .where(eq(cleaners.id, cleanerId));
  }

  const baseUrl = getAppBaseUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/cleaner/profile?stripe=refresh`,
    return_url: `${baseUrl}/cleaner/profile?stripe=complete`,
    type: "account_onboarding",
  });

  return { url: accountLink.url, accountId };
}

export async function syncStripeOnboardingStatus(cleanerId: string) {
  const cleaner = await db.query.cleaners.findFirst({
    where: eq(cleaners.id, cleanerId),
    columns: { stripeAccountId: true, stripeOnboardingComplete: true },
  });

  if (!cleaner?.stripeAccountId) {
    return cleaner?.stripeOnboardingComplete ?? false;
  }

  try {
    const account = await stripe.accounts.retrieve(cleaner.stripeAccountId);
    const complete =
      account.details_submitted === true &&
      account.charges_enabled === true;

    if (complete && !cleaner.stripeOnboardingComplete) {
      await db
        .update(cleaners)
        .set({ stripeOnboardingComplete: true, updatedAt: new Date() })
        .where(eq(cleaners.id, cleanerId));
    }

    return complete;
  } catch {
    return cleaner.stripeOnboardingComplete ?? false;
  }
}
