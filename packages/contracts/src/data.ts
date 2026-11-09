import { z } from "zod";

/** Mirrors the PostgreSQL enums in supabase/migrations. Keep in sync (a test compares them). */
export const AppRole = z.enum(["contributor", "editor", "ad_manager", "content_admin", "super_admin"]);
export type AppRole = z.infer<typeof AppRole>;

export const ContentStatus = z.enum(["draft", "in_review", "published", "archived", "trashed"]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const VerificationStatus = z.enum(["unverified", "pending", "verified", "rejected"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** PUBLIC shape of a business: contact details are separate and only present with recorded consent. */
export const PublicBusiness = z.object({
  id: z.string().uuid(),
  slug,
  name: z.string(),
  description: z.string().nullable(),
  area: z.string().nullable(),
  city: z.string().nullable(),
  website: z.string().url().nullable(),
  isGrocerySupplier: z.boolean(),
  verificationStatus: VerificationStatus,
  verifiedAt: z.string().nullable(),
});
export type PublicBusiness = z.infer<typeof PublicBusiness>;

export const PublicContact = z.object({
  businessId: z.string().uuid(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
});
export type PublicContact = z.infer<typeof PublicContact>;

export const PublicArticle = z.object({
  id: z.string().uuid(),
  slug,
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string(),
  isHighStakes: z.boolean(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "needs_update"]),
  lastReviewedAt: z.string().nullable(),
  sources: z.array(z.object({ title: z.string(), publisher: z.string().nullable(), url: z.string().url(), accessedOn: z.string() })),
});
export type PublicArticle = z.infer<typeof PublicArticle>;

export const AvailabilityEvidence = z.object({
  ingredientId: z.string().uuid(),
  businessId: z.string().uuid(),
  observedOn: z.string(),
  sourceType: z.enum(["owner_report", "staff_visit", "member_tip", "website"]),
});
export type AvailabilityEvidence = z.infer<typeof AvailabilityEvidence>;

/** Shown beside any sponsored placement. Never hide or reword. */
export const AdDisclosure = z.enum(["Sponsored", "Ad", "Advertisement"]);

// ---------------------------------------------------------------- auth API (phase 04)
export const MeResponse = z.object({
  user: z.object({ id: z.string().uuid(), email: z.string().nullable() }),
  roles: z.array(AppRole),
  aal: z.enum(["aal1", "aal2"]),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const FavoriteList = z.object({
  favorites: z.array(z.object({ businessId: z.string().uuid(), slug: z.string().nullable(), name: z.string().nullable() })),
});
export type FavoriteList = z.infer<typeof FavoriteList>;

export const AdminStatus = z.object({ roles: z.array(AppRole), mfaVerified: z.literal(true) });
export type AdminStatus = z.infer<typeof AdminStatus>;
