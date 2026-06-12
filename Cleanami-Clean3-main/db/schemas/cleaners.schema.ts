
import { pgTable, uuid, timestamp, text, integer, boolean, numeric, jsonb, index, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

// Enum for on-call status as requested
export const onCallStatusEnum = pgEnum('on_call_status', ['available', 'unavailable', 'on_job']);

export const cleaners = pgTable("cleaners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone_number"),
  address: text("address"),
  travelRadiusMiles: integer("travel_radius_miles").default(25),
  profilePhotoUrl: text("profile_photo_url"),
  experienceYears: integer("experience_years"),
  hasHotTubCert: boolean("has_hot_tub_cert").default(false),
  reliabilityScore: numeric("reliability_score", { precision: 5, scale: 2 }), 
  onCallStatus: onCallStatusEnum("on_call_status").default('unavailable'),
  stripeAccountId: text("stripe_account_id").unique(),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  geocodedAt: timestamp("geocoded_at"),
  legalDocsSigned: jsonb("legal_docs_signed").$type<{
    w9Url: string | null;
    liabilityWaiverUrl: string | null;
    gpsConsentUrl: string | null;
  }>().default({ w9Url: null, liabilityWaiverUrl: null, gpsConsentUrl: null }),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(1),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Index for job assignment engine ranking
  index("cleaners_reliability_idx").on(table.reliabilityScore),
  index("cleaners_location_idx").on(table.latitude, table.longitude),
]);

