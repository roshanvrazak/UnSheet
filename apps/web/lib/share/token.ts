import crypto from 'node:crypto';
import { ShareTokenSchema, type ShareToken } from '@unsheet/contracts';

/**
 * Generate a cryptographically secure token using node:crypto.
 * Produces a URL-safe base64url string with 128 bits of entropy (22 characters).
 */
export function generateShareToken(): ShareToken {
  const buffer = crypto.randomBytes(16); // 128 bits
  const token = buffer.toString('base64url');
  
  // Validate against contract schema
  const parsed = ShareTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new Error(`Generated invalid share token: ${parsed.error.message}`);
  }
  
  return parsed.data;
}
