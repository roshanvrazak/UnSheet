import { z } from 'zod';

/**
 * Forbidden object keys that could cause prototype pollution.
 */
export const FORBIDDEN_OBJECT_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

/**
 * Validates that a string is a safe identifier and not a prototype pollution vector.
 */
export const SafeIdentifierSchema = z
  .string()
  .min(1, 'Identifier must not be empty')
  .max(128, 'Identifier exceeds maximum length of 128 characters')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Identifier must contain only letters, numbers, and underscores, starting with a letter or underscore')
  .refine(
    (val) => !FORBIDDEN_OBJECT_KEYS.includes(val as typeof FORBIDDEN_OBJECT_KEYS[number]),
    { message: 'Identifier cannot match prototype properties (__proto__, constructor, prototype)' }
  );

export type SafeIdentifier = z.infer<typeof SafeIdentifierSchema>;

/**
 * Safe alphanumeric/hyphen/underscore entity ID schema that forbids prototype pollution keys.
 */
export const SafeEntityIdSchema = z
  .string()
  .min(1, 'Entity ID must not be empty')
  .max(64, 'Entity ID exceeds maximum length of 64 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Entity ID must contain only alphanumeric characters, underscores, and hyphens')
  .refine(
    (val) => !FORBIDDEN_OBJECT_KEYS.includes(val as typeof FORBIDDEN_OBJECT_KEYS[number]),
    { message: 'Entity ID cannot match prototype properties (__proto__, constructor, prototype)' }
  );

export type SafeEntityId = z.infer<typeof SafeEntityIdSchema>;

/**
 * Sample value string: capped at 40 characters, sanitized against formula injection.
 */
export const SampleValueSchema = z
  .string()
  .max(40, 'Sample value exceeds maximum length of 40 characters')
  .refine(
    (val) => !/^[=+\-@\t\r\n|]/.test(val) && !/^[=+\-@\t\r\n|]/.test(val.trimStart()),
    { message: 'Sample value must not start with formula trigger characters (=, +, -, @, \\t, \\r, \\n, |) even when preceded by whitespace' }
  );

export type SampleValue = z.infer<typeof SampleValueSchema>;

/**
 * Sample values array: strictly capped at max 5 items.
 */
export const SampleValuesArraySchema = z
  .array(SampleValueSchema)
  .max(5, 'Sample values array must not contain more than 5 items');

export type SampleValuesArray = z.infer<typeof SampleValuesArraySchema>;

/**
 * Non-empty string with maximum length.
 */
export const TitleSchema = z
  .string()
  .trim()
  .min(1, 'Title must not be empty')
  .max(120, 'Title exceeds 120 characters');

export const DescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Description exceeds 500 characters')
  .optional();

/**
 * ISO 8601 UTC timestamp schema.
 */
export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be a valid ISO 8601 datetime string' });

export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * Semantic version string (e.g., "1.0", "1.0.0").
 */
export const SemanticVersionSchema = z
  .string()
  .regex(/^(?:\d+\.\d+|\d+\.\d+\.\d+)$/, 'Version must be in semantic format (e.g. 1.0 or 1.0.0)');

export type SemanticVersion = z.infer<typeof SemanticVersionSchema>;

/**
 * Version information payload schema.
 */
export const VersionSchema = z.object({
  version: z.string().min(1),
  name: z.string().min(1),
});

export type Version = z.infer<typeof VersionSchema>;

/**
 * Validates URLs ensuring the protocol is strictly http: or https: (preventing javascript:, data:, file:).
 */
export const SafeUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'URL protocol must be http: or https:' }
  );

export type SafeUrl = z.infer<typeof SafeUrlSchema>;
