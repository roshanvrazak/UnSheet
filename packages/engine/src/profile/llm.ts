import type {
  ColumnProfile,
  LLMColumnProfile,
  SheetProfile,
} from '@unsheet/contracts';
import { LLMColumnProfileSchema } from '@unsheet/contracts';

export interface LLMSheetProfile extends Omit<SheetProfile, 'columnProfiles'> {
  columnProfiles: LLMColumnProfile[];
}

/**
 * Strips raw category frequency breakdown (topValues) from a column profile
 * to prevent prompt injection and data exfiltration when sending column metadata to external LLMs.
 */
export function toLLMColumnProfile(col: ColumnProfile): LLMColumnProfile {
  const rest = { ...col };
  delete (rest as { topValues?: unknown }).topValues;
  return LLMColumnProfileSchema.parse(rest);
}

/**
 * Transforms a SheetProfile into an LLM-safe representation with all topValues stripped
 * from each column profile.
 */
export function toLLMSheetProfile(sheet: SheetProfile): LLMSheetProfile {
  return {
    ...sheet,
    columnProfiles: sheet.columnProfiles.map(toLLMColumnProfile),
  };
}
