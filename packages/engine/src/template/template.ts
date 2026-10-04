import type { SheetProfile, DashboardSpec, Template, TemplateCategory } from '@unsheet/contracts';
import { TemplateSchema } from '@unsheet/contracts';
import { computeSchemaFingerprint } from './fingerprint.js';

/**
 * Creates a dashboard template from a spec, profile, and metadata.
 */
export function createTemplate(
  spec: DashboardSpec,
  profile: SheetProfile,
  metadata: {
    id?: string;
    name: string;
    description: string;
    category?: TemplateCategory;
    tags?: string[];
  }
): Template {
  const fingerprint = computeSchemaFingerprint(profile);
  const now = new Date().toISOString();

  const templateData = {
    id: metadata.id ?? `tmpl_${Math.random().toString(36).substring(2, 10)}`,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category ?? 'general',
    fingerprint,
    spec,
    createdAt: now,
    updatedAt: now,
    isBuiltIn: false,
    tags: metadata.tags,
  };

  return TemplateSchema.parse(templateData);
}

/**
 * Validates template data against TemplateSchema.
 */
export function validateTemplate(data: unknown): Template {
  return TemplateSchema.parse(data);
}
