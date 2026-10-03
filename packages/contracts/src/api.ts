import { z } from 'zod';
import { SafeIdentifierSchema, TitleSchema, IsoDateTimeSchema } from './common.js';
import { ColumnProfileSchema } from './profile.js';
import { DashboardSpecSchema, WidgetSpecSchema } from './spec.js';
import { QueryPlanSchema } from './query.js';

/**
 * 1. Spec Refinement Payloads (LLM Natural Language Spec Editing)
 */

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(2000),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const SpecRefinementRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(2000, 'Prompt exceeds 2000 characters'),
  currentSpec: DashboardSpecSchema,
  profiles: z.array(ColumnProfileSchema).min(1, 'Must include at least one column profile'),
  history: z.array(ChatMessageSchema).max(20).optional(),
});

export type SpecRefinementRequest = z.infer<typeof SpecRefinementRequestSchema>;

export const SpecRefinementResponseSchema = z.object({
  success: z.boolean(),
  updatedSpec: DashboardSpecSchema.optional(),
  explanation: z.string().max(2000),
  appliedChanges: z.array(z.string().max(256)).optional(),
  error: z.string().max(500).optional(),
});

export type SpecRefinementResponse = z.infer<typeof SpecRefinementResponseSchema>;

/**
 * 2. Share Link Payloads (Encrypted / Snapshot / Ephemeral Dashboard Sharing)
 */

/**
 * Secure token format: minimum 22 characters (base64url/hex/uuid) providing >= 128 bits entropy.
 */
export const ShareTokenSchema = z
  .string()
  .min(22, 'Share token must have at least 128 bits entropy (>=22 characters)')
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Share token must be URL-safe alphanumeric or hyphen/underscore');

export type ShareToken = z.infer<typeof ShareTokenSchema>;

export const CreateShareLinkRequestSchema = z.object({
  title: TitleSchema,
  spec: DashboardSpecSchema,
  allowExport: z.boolean().default(false),
  expiresInHours: z.number().int().min(1).max(720).optional(), // 1 hour to 30 days
  includeDataSnapshot: z.boolean().default(false),
  dataSnapshot: z.array(z.record(SafeIdentifierSchema, z.unknown())).max(10000).optional(),
});

export type CreateShareLinkRequest = z.infer<typeof CreateShareLinkRequestSchema>;

export const CreateShareLinkResponseSchema = z.object({
  shareToken: ShareTokenSchema,
  shareUrl: z.string().url(),
  expiresAt: IsoDateTimeSchema.optional(),
});

export type CreateShareLinkResponse = z.infer<typeof CreateShareLinkResponseSchema>;

export const GetShareLinkResponseSchema = z.object({
  title: TitleSchema,
  spec: DashboardSpecSchema,
  allowExport: z.boolean(),
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema.optional(),
  dataSnapshot: z.array(z.record(SafeIdentifierSchema, z.unknown())).optional(),
});

export type GetShareLinkResponse = z.infer<typeof GetShareLinkResponseSchema>;

/**
 * 3. Ask-Your-Data Payloads (Natural Language Question to SQL / Widget)
 */

export const AskYourDataRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question exceeds 1000 characters'),
  sheetName: z.string().min(1).max(128),
  profiles: z.array(ColumnProfileSchema).min(1, 'At least one column profile is required'),
});

export type AskYourDataRequest = z.infer<typeof AskYourDataRequestSchema>;

export const AskYourDataResponseSchema = z.object({
  success: z.boolean(),
  interpretedIntent: z.string().max(500),
  queryPlan: QueryPlanSchema.optional(),
  suggestedWidget: WidgetSpecSchema.optional(),
  sql: z.string().max(4000).optional(),
  explanation: z.string().max(2000),
  error: z.string().max(500).optional(),
});

export type AskYourDataResponse = z.infer<typeof AskYourDataResponseSchema>;
