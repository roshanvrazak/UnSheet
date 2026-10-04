import crypto from 'crypto';
import type { SheetProfile, SchemaFingerprint } from '@unsheet/contracts';
import { SchemaFingerprintSchema } from '@unsheet/contracts';

/**
 * Computes a deterministic schema fingerprint from a sheet profile.
 * Sorts columns deterministically by columnKey, constructs canonical string of ${columnKey}:${inferredType}:${!nullable},
 * and computes SHA-256 hash.
 */
export function computeSchemaFingerprint(profile: SheetProfile): SchemaFingerprint {
  const sortedColumns = [...profile.columnProfiles].sort((a, b) => a.columnKey.localeCompare(b.columnKey));
  
  const fingerprintColumns = sortedColumns.map((col) => ({
    key: col.columnKey,
    name: col.originalName,
    inferredType: col.inferredType,
    required: !col.nullable,
  }));

  const canonicalParts = fingerprintColumns.map(
    (col) => `${col.key}:${col.inferredType}:${col.required}`
  );
  const canonicalString = canonicalParts.join('|');

  const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');

  const fingerprint: SchemaFingerprint = {
    hash,
    version: '1.0',
    columnCount: fingerprintColumns.length,
    columns: fingerprintColumns,
  };

  return SchemaFingerprintSchema.parse(fingerprint);
}
