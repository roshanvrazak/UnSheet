/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const sA = a.slice(0, 128);
  const sB = b.slice(0, 128);
  const m = sA.length;
  const n = sB.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array<number>(n + 1);
  let currRow = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const charA = sA.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const charB = sB.charCodeAt(j - 1);
      const cost = charA === charB ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1]! + 1, // insertion
        prevRow[j]! + 1, // deletion
        prevRow[j - 1]! + cost // substitution
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n]!;
}

/**
 * Splits a column identifier into lowercase tokens.
 */
export function tokenizeIdentifier(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Checks if token A and token B match exactly or via abbreviation / prefix.
 * E.g., "emp" and "employee", "cust" and "customer", "rev" and "revenue".
 */
export function tokensMatch(tA: string, tB: string): boolean {
  if (tA === tB) return true;
  if (tA.length >= 3 && tB.startsWith(tA)) return true;
  if (tB.length >= 3 && tA.startsWith(tB)) return true;
  return false;
}

/**
 * Computes token Jaccard similarity between two identifiers with prefix matching support.
 */
export function tokenJaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenizeIdentifier(a);
  const tokensB = tokenizeIdentifier(b);

  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  let matchCount = 0;
  const matchedB = new Set<number>();

  for (const tA of tokensA) {
    for (let i = 0; i < tokensB.length; i++) {
      if (!matchedB.has(i) && tokensMatch(tA, tokensB[i]!)) {
        matchedB.add(i);
        matchCount++;
        break;
      }
    }
  }

  const union = tokensA.length + tokensB.length - matchCount;
  return union === 0 ? 1.0 : matchCount / union;
}

/**
 * Computes combined string similarity between two column keys,
 * blending Levenshtein character distance and token set overlap.
 */
export function calculateColumnSimilarity(a: string, b: string): number {
  const cleanA = a.slice(0, 128).toLowerCase().trim();
  const cleanB = b.slice(0, 128).toLowerCase().trim();

  if (cleanA === cleanB) return 1.0;

  const maxLen = Math.max(cleanA.length, cleanB.length);
  if (maxLen === 0) return 1.0;

  const levDist = levenshteinDistance(cleanA, cleanB);
  const levSim = Math.max(0, 1 - levDist / maxLen);

  const jaccardSim = tokenJaccardSimilarity(cleanA, cleanB);

  // Substring inclusion bonus
  const isSubstring =
    (cleanA.length >= 3 && cleanB.includes(cleanA)) ||
    (cleanB.length >= 3 && cleanA.includes(cleanB));
  const subBonus = isSubstring ? 0.2 : 0.0;

  const combined = 0.4 * levSim + 0.5 * jaccardSim + subBonus;
  return Math.min(1.0, Math.max(0.0, Number(combined.toFixed(3))));
}
