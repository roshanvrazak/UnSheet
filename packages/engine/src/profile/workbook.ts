import type {
  SheetProfile,
  WorkbookModel,
  WorkbookProfile,
} from '@unsheet/contracts';
import { WorkbookProfileSchema } from '@unsheet/contracts';
import { findJoinCandidates } from './joins.js';
import { profileSheet } from './sheet.js';

export { type WorkbookProfile } from '@unsheet/contracts';

/**
 * Profiles an entire WorkbookModel, producing sheet profiles for all normalized sheets
 * and identifying relational join candidate keys between sheet pairs.
 * Validates output using WorkbookProfileSchema.
 */
export function profileWorkbook(workbook: WorkbookModel): WorkbookProfile {
  const sheets: SheetProfile[] = workbook.sheets.map((sheet) => profileSheet(sheet));
  const crossSheetJoins = findJoinCandidates(workbook.sheets);

  const profile: WorkbookProfile = {
    sheets,
    crossSheetJoins,
  };

  const parsed = WorkbookProfileSchema.parse(profile);
  Object.defineProperty(parsed, 'joinCandidates', {
    get() {
      return this.crossSheetJoins;
    },
    enumerable: true,
  });

  return parsed as WorkbookProfile;
}
