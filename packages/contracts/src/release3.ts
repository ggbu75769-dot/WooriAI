import { z } from "zod";

export const legalDocumentTypeSchema = z.enum(["terms", "privacy", "marketing", "analytics"]);
export const consentActionSchema = z.enum(["accepted", "revoked", "acknowledged"]);
export const consentSourceSchema = z.enum(["mobile", "web", "admin"]);

export const legalDocumentSchema = z.object({
  id: z.string().uuid(),
  documentType: legalDocumentTypeSchema,
  locale: z.string().min(2),
  version: z.string().min(1),
  title: z.string().min(1),
  bodyMarkdown: z.string(),
  publicUrl: z.string().url().nullable(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  required: z.boolean(),
  placeholder: z.boolean(),
  effectiveAt: z.string().datetime(),
  publishedAt: z.string().datetime()
}).strict();

export const consentUpdateSchema = z.object({
  type: legalDocumentTypeSchema,
  version: z.string().min(1),
  accepted: z.boolean()
}).strict();

export const privacyRequestTypeSchema = z.enum(["deletion", "export", "correction"]);
export const privacyRequestStateSchema = z.enum([
  "requested",
  "access_revoked",
  "processor_delete_queued",
  "purging",
  "retained_exception",
  "completed",
  "failed",
  "cancelled"
]);

export const privacyRequestSchema = z.object({
  id: z.string().uuid(),
  requestType: privacyRequestTypeSchema,
  state: privacyRequestStateSchema,
  requestedAt: z.string().datetime(),
  dueAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failureCode: z.string().nullable(),
  exportExpiresAt: z.string().datetime().nullable()
}).strict();

export const transferOwnershipSchema = z.object({ targetUserId: z.string().uuid() }).strict();

export const release3FeatureFlagsSchema = z.object({
  analytics: z.boolean(),
  affiliate: z.boolean(),
  import: z.boolean(),
  notification: z.boolean()
}).strict();

export const appConfigSchema = z.object({
  minimumSupportedVersion: z.string(),
  latestVersion: z.string(),
  maintenanceMode: z.boolean(),
  readOnlyMode: z.boolean(),
  emergencyMessage: z.string().nullable(),
  authProviders: z.array(z.enum(["kakao", "apple", "google"])),
  featureFlags: release3FeatureFlagsSchema,
  policyVersions: z.record(z.string()),
  analyticsEnabled: z.boolean(),
  affiliateEnabled: z.boolean(),
  importEnabled: z.boolean(),
  notificationEnabled: z.boolean(),
  priceMaxAgeDays: z.number().int().positive().nullable(),
  configVersion: z.number().int().positive(),
  updatedAt: z.string().datetime()
}).strict();
export type AppConfig = z.infer<typeof appConfigSchema>;
