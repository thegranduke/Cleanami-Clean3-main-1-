import "server-only";

import type { Database } from "@/db";
import { getDbOrNull } from "@/db";
import { cleaners, jobsToCleaners, users } from "@/db/schemas";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_UNAVAILABLE } from "@/lib/env/messages";
import { and, eq } from "drizzle-orm";

export type CleanerAuthResult = {
  cleanerId: string | null;
  error: string | null;
};

const PROFILE_NOT_FOUND_MESSAGE =
  "We could not load your cleaner profile. Try signing out and back in, or contact support.";

const PROFILE_SETUP_FAILED_MESSAGE =
  "Your account exists but we could not finish setting up your cleaner profile. Please try again or contact support.";

async function resolveCleanerEmail(
  claims: Record<string, unknown>
): Promise<string | null> {
  if (typeof claims.email === "string" && claims.email.length > 0) {
    return claims.email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return null;
  }

  return data.user.email;
}

async function ensureCleanerProfile(
  database: Database,
  supabaseUserId: string,
  email: string,
  displayName: string
): Promise<string | null> {
  let dbUser = await database.query.users.findFirst({
    where: eq(users.supabaseUserId, supabaseUserId),
    columns: { id: true },
  });

  if (!dbUser) {
    const [insertedUser] = await database
      .insert(users)
      .values({
        supabaseUserId,
        email,
        role: "cleaner",
        name: displayName,
      })
      .returning({ id: users.id });

    dbUser = insertedUser;
  }

  let cleaner = await database.query.cleaners.findFirst({
    where: eq(cleaners.userId, dbUser.id),
    columns: { id: true },
  });

  if (!cleaner) {
    const [insertedCleaner] = await database
      .insert(cleaners)
      .values({
        userId: dbUser.id,
        email,
        fullName: displayName,
      })
      .returning({ id: cleaners.id });

    cleaner = insertedCleaner;
  }

  return cleaner.id;
}

/**
 * Resolves the authenticated cleaner's ID from the current session.
 * Use in all /api/cleaner/* routes to scope data to the logged-in cleaner.
 */
export async function getCleanerAuth(): Promise<CleanerAuthResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return { cleanerId: null, error: "Unauthorized" };
  }

  const userRole = claims.user_metadata?.role;
  if (userRole !== "cleaner") {
    return { cleanerId: null, error: "Forbidden" };
  }

  const database = getDbOrNull();
  if (!database) {
    return { cleanerId: null, error: SERVICE_UNAVAILABLE.database };
  }

  const dbUser = await database.query.users.findFirst({
    where: eq(users.supabaseUserId, claims.sub),
    columns: { id: true },
  });

  if (dbUser) {
    const cleaner = await database.query.cleaners.findFirst({
      where: eq(cleaners.userId, dbUser.id),
      columns: { id: true },
    });

    if (cleaner) {
      return { cleanerId: cleaner.id, error: null };
    }
  }

  const email = await resolveCleanerEmail(claims);
  if (!email) {
    return { cleanerId: null, error: PROFILE_NOT_FOUND_MESSAGE };
  }

  const metadata = claims.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const displayName =
    metadata?.full_name?.trim() ||
    metadata?.name?.trim() ||
    email.split("@")[0];

  try {
    const cleanerId = await ensureCleanerProfile(
      database,
      claims.sub,
      email,
      displayName
    );
    return { cleanerId, error: null };
  } catch (profileError) {
    console.error("[getCleanerAuth] Failed to provision cleaner profile:", profileError);
    return { cleanerId: null, error: PROFILE_SETUP_FAILED_MESSAGE };
  }
}

export async function requireCleanerJobAssignment(
  cleanerId: string,
  jobId: string
) {
  const database = getDbOrNull();
  if (!database) {
    return { assignment: null, error: SERVICE_UNAVAILABLE.database };
  }

  const assignment = await database.query.jobsToCleaners.findFirst({
    where: and(
      eq(jobsToCleaners.cleanerId, cleanerId),
      eq(jobsToCleaners.jobId, jobId)
    ),
  });

  if (!assignment) {
    return { assignment: null, error: "Not assigned to this job" };
  }

  return { assignment, error: null };
}

export function cleanerAuthErrorStatus(error: string | null): number {
  if (
    error === SERVICE_UNAVAILABLE.database ||
    error?.toLowerCase().includes("profile") ||
    error?.toLowerCase().includes("setting up your cleaner")
  ) {
    return 503;
  }
  if (error === "Forbidden" || error === "Not assigned to this job") {
    return 403;
  }
  return 401;
}
