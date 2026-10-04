import { describe, it, expect } from 'vitest';
import { ShareTokenSchema, CreateShareLinkRequestSchema } from '@unsheet/contracts';
import { generateShareToken } from '@/lib/share/token';

describe('Adversarial Red-Team Suite: Phase 6 Share Link Security & Attack Vectors', () => {
  // =========================================================================
  // VECTOR 1: Brute-Force, Timing Oracles & Token Pathologies
  // =========================================================================
  describe('Vector 1: Share Token Pathologies & Brute-Force Mitigations', () => {
    it('ADV-P6-S01: Rejects path traversal, SQL injection, null bytes, and oversized token strings (>128 chars)', () => {
      const maliciousTokens = [
        "../../etc/passwd",
        "' OR '1'='1",
        "token\0null",
        "token; DROP TABLE share_links;--",
        "A".repeat(129),
        "short_token_12", // <22 chars
        "token with spaces",
      ];

      for (const t of maliciousTokens) {
        expect(() => ShareTokenSchema.parse(t)).toThrow();
      }
    });

    it('ADV-P6-S02: Generates cryptographically secure tokens with >=128 bits entropy (>=22 characters base64url)', () => {
      const token = generateShareToken();
      expect(token.length).toBeGreaterThanOrEqual(22);
      expect(ShareTokenSchema.parse(token)).toBe(token);
    });
  });

  // =========================================================================
  // VECTOR 2: Request Payload Tampering & Oversized Snapshots
  // =========================================================================
  describe('Vector 2: Request Payload Tampering & Oversized Snapshots', () => {
    it('ADV-P6-S03: Rejects CreateShareLinkRequest with invalid TTL (expiresInHours > 720 or < 1)', () => {
      const baseReq = {
        title: 'Test Dashboard',
        spec: {
          version: '1.0' as const,
          id: 'dash_1',
          title: 'Test',
          sheetBinding: 'sheet_1',
          layout: { columns: 12, gap: 16, padding: 16 },
          filters: [],
          widgets: [],
        },
      };

      expect(() => CreateShareLinkRequestSchema.parse({ ...baseReq, expiresInHours: 0 })).toThrow();
      expect(() => CreateShareLinkRequestSchema.parse({ ...baseReq, expiresInHours: 721 })).toThrow();
      expect(() => CreateShareLinkRequestSchema.parse({ ...baseReq, expiresInHours: -24 })).toThrow();
    });
  });
});
