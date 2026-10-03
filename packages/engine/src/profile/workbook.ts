import type { SheetProfile, WorkbookModel } from '@unsheet/contracts';
import { findJoinCandidates, type JoinCandidate } from './joins.js';
import { profileSheet } from './sheet.js';

export interface WorkbookProfile {
  workbookId: string;
  filename: string;
  sheets: SheetProfile[];
  joinCandidates: JoinCandidate[];
}

/**
 * Profiles an entire WorkbookModel, producing sheet profiles for all normalized sheets
 * and identifying relational join candidate keys between sheet pairs.
 */
export function profileWorkbook(workbook: WorkbookModel): WorkbookProfile {
  const sheetProfiles: SheetProfile[] = workbook.sheets.map((sheet) => profileSheet(sheet));
  const joinCandidates = findJoinCandidates(workbook.sheets);

  return {
    workbookId: workbook.id,
    filename: workbook.filename,
    sheets: sheetProfiles,
    joinCandidates,
  };
}
