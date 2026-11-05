import { z } from 'zod';
import { ShareTokenSchema, SafeUrlSchema } from '@unsheet/contracts';

const KEY = 'unsheet_share_management';
const ManagedShareSchema = z.object({
  shareToken: ShareTokenSchema,
  shareUrl: SafeUrlSchema,
  managementToken: ShareTokenSchema,
});
export type ManagedShare = z.infer<typeof ManagedShareSchema>;

export function loadManagedShares(): ManagedShare[] {
  try {
    const parsed = z.array(ManagedShareSchema).max(20).safeParse(JSON.parse(localStorage.getItem(KEY) || '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveManagedShares(shares: ManagedShare[]): void {
  localStorage.setItem(KEY, JSON.stringify(z.array(ManagedShareSchema).max(20).parse(shares)));
}
