import "server-only";

import { db } from "@/db";
import { cleaners } from "@/db/schemas";
import { getStripeRedirectBaseUrl } from "@/lib/app-url";
import { applyStripeAccountState } from "@/lib/cleaner/stripe-account-state";
import { stripe } from "@/lib/stripe/config";
import { eq } from "drizzle-orm";

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

  const baseUrl = getStripeRedirectBaseUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/auth/stripe-connect-return?status=refresh`,
    return_url: `${baseUrl}/auth/stripe-connect-return?status=complete`,
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
    await applyStripeAccountState(cleanerId, account);
    return (
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true
    );
  } catch {
    return cleaner.stripeOnboardingComplete ?? false;
  }
}
