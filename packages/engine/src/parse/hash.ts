/**
 * Computes a SHA-256 hexadecimal hash string for a given byte buffer.
 * Compatible with Web Workers (globalThis.crypto.subtle) and Node.js.
 */
export async function computeSha256(data: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback if subtle crypto is not available in test or environment
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}
