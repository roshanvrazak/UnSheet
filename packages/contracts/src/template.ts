import { z } from 'zod';
import { SafeIdentifierSchema, TitleSchema, DescriptionSchema, IsoDateTimeSchema } from './common.js';
import { InferredDataTypeSchema } from './profile.js';
import { DashboardSpecSchema } from './spec.js';

/**
 * Expected column profile signature within a schema fingerprint.
 */
export const FingerprintColumnSchema = z.object({
  key: SafeIdentifierSchema,
  name: z.string().min(1).max(256),
  inferredType: InferredDataTypeSchema,
  required: z.boolean().default(true),
});

export type FingerprintColumn = z.infer<typeof FingerprintColumnSchema>;

/**
 * Schema fingerprint representing the structural hash and column signature of a dataset.
 */
export const SchemaFingerprintSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/, 'Fingerprint hash must be a 64-character SHA-256 hex string'),
  version: z.literal('1.0'),
  columnCount: z.number().int().positive(),
  columns: z.array(FingerprintColumnSchema).min(1, 'Fingerprint must contain at least one column'),
});

export type SchemaFingerprint = z.infer<typeof SchemaFingerprintSchema>;

/**
 * Template categories for organizing reusable dashboard designs.
 */
export const TemplateCategorySchema = z.enum([
  'financial',
  'sales',
  'inventory',
  'operations',
  'marketing',
  'human_resources',
  'general',
]);

export type TemplateCategory = z.infer<typeof TemplateCategorySchema>;

/**
 * Dashboard template encapsulating a validated spec alongside a schema fingerprint.
 */
export const TemplateSchema = z.object({
  id: z.string().min(1).max(64),
  name: TitleSchema,
  description: DescriptionSchema,
  category: TemplateCategorySchema.default('general'),
  fingerprint: SchemaFingerprintSchema,
  spec: DashboardSpecSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  isBuiltIn: z.boolean().default(false),
  tags: z.array(z.string().max(32)).max(10).optional(),
});

export type Template = z.infer<typeof TemplateSchema>;
