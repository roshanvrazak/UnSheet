import type { InferredDataType } from '@unsheet/contracts';

/**
 * Determines whether data of type `actualType` can be safely or losslessly coerced
 * to satisfy `expectedType` in visualization widgets and analytical queries.
 */
export function isCoercible(
  expectedType: InferredDataType,
  actualType: InferredDataType
): boolean {
  if (expectedType === actualType) {
    return true;
  }

  // Measures/quantifiables are mutually coercible
  const numericTypes: Set<InferredDataType> = new Set(['number', 'currency', 'percent']);
  if (numericTypes.has(expectedType) && numericTypes.has(actualType)) {
    return true;
  }

  // Any data type can be presented as text or string dimension
  if (expectedType === 'text') {
    return true;
  }

  // Discrete string types can coerce to category
  if (expectedType === 'category') {
    if (actualType === 'id' || actualType === 'boolean' || actualType === 'text') {
      return true;
    }
  }

  // Identifiers can accept category or text strings
  if (expectedType === 'id') {
    if (actualType === 'category' || actualType === 'text') {
      return true;
    }
  }

  // Booleans can be represented as binary numbers or categories
  if (expectedType === 'boolean') {
    if (actualType === 'number' || actualType === 'category') {
      return true;
    }
  }

  return false;
}
