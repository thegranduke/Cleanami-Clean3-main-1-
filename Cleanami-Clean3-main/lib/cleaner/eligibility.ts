import "server-only";

import type { cleaners } from "@/db/schemas";

export type CleanerEligibilityRecord = Pick<
  typeof cleaners.$inferSelect,
  "onboardingCompleted" | "stripePayoutsEnabled"
>;

export function hasRequiredLegalDocs(
  legalDocsSigned: typeof cleaners.$inferSelect.legalDocsSigned
): boolean {
  if (!legalDocsSigned) return false;
  return Boolean(
    legalDocsSigned.w9Url &&
      legalDocsSigned.liabilityWaiverUrl &&
      legalDocsSigned.gpsConsentUrl &&
      legalDocsSigned.contractorAgreementUrl
  );
}

/** Cleaner may receive assignments, payouts, and on-call pool inclusion. */
export function isCleanerAssignmentEligible(
  cleaner: CleanerEligibilityRecord | null | undefined
): boolean {
  if (!cleaner) return false;
  if (!cleaner.onboardingCompleted) return false;
  if (!cleaner.stripePayoutsEnabled) return false;
  return true;
}

export function isCleanerPortalUnlocked(
  cleaner: Pick<
    typeof cleaners.$inferSelect,
    "onboardingCompleted" | "accountStatus"
  > | null | undefined
): boolean {
  if (!cleaner) return false;
  return cleaner.onboardingCompleted === true;
}

export function getCleanerOnboardingBannerMessage(
  cleaner: Pick<
    typeof cleaners.$inferSelect,
    | "onboardingCompleted"
    | "accountStatus"
    | "stripePayoutsEnabled"
    | "stripeOnboardingComplete"
  > | null
): string | null {
  if (!cleaner) return null;
  if (!cleaner.onboardingCompleted) {
    return "Complete onboarding to access jobs, availability, and payouts.";
  }
  if (cleaner.accountStatus === "suspended") {
    return "Your account is suspended. Contact CleanNami support.";
  }
  if (!cleaner.stripePayoutsEnabled) {
    return "Finish Stripe Connect setup to become eligible for job assignments and payouts.";
  }
  return null;
}
