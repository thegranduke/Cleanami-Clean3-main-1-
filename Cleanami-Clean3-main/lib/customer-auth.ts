import "server-only";

import { getDbOrNull } from "@/db";
import { customers, jobs, properties } from "@/db/schemas";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_UNAVAILABLE } from "@/lib/env/messages";
import { and, eq } from "drizzle-orm";

export type CustomerAuthResult = {
  customerId: string | null;
  error: string | null;
};

async function resolveCustomerEmail(
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

export async function getCustomerAuth(): Promise<CustomerAuthResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return { customerId: null, error: "Unauthorized" };
  }

  const userRole = claims.user_metadata?.role;
  if (userRole !== "user") {
    return { customerId: null, error: "Forbidden" };
  }

  const database = getDbOrNull();
  if (!database) {
    return { customerId: null, error: SERVICE_UNAVAILABLE.database };
  }

  const email = await resolveCustomerEmail(claims);
  if (!email) {
    return {
      customerId: null,
      error: "Could not resolve your account email. Try signing out and back in.",
    };
  }

  const customer = await database.query.customers.findFirst({
    where: eq(customers.email, email),
    columns: { id: true },
  });

  if (!customer) {
    return {
      customerId: null,
      error:
        "No property profile found for this account. Complete booking onboarding or contact support.",
    };
  }

  return { customerId: customer.id, error: null };
}

export async function customerOwnsJob(
  customerId: string,
  jobId: string
): Promise<boolean> {
  const database = getDbOrNull();
  if (!database) return false;

  const row = await database
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(properties, eq(jobs.propertyId, properties.id))
    .where(and(eq(jobs.id, jobId), eq(properties.customerId, customerId)))
    .limit(1);

  return row.length > 0;
}

export function customerAuthErrorStatus(error: string | null): number {
  if (error === SERVICE_UNAVAILABLE.database) {
    return 503;
  }
  if (error?.includes("property profile")) {
    return 503;
  }
  if (error === "Forbidden") {
    return 403;
  }
  return 401;
}
