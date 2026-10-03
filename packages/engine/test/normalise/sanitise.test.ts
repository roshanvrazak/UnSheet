import { describe, it, expect } from 'vitest';
import { SafeIdentifierSchema } from '@unsheet/contracts';
import { sanitiseHeaders, sanitiseHeaderToken } from '../../src/normalise/index.js';

describe('Column Key Sanitisation', () => {
  it('converts standard headers into safe snake_case identifiers', () => {
    const headers = ['First Name', 'Last Name', 'Total Sales USD', 'Email Address'];
    const keys = sanitiseHeaders(headers);
    expect(keys).toEqual(['first_name', 'last_name', 'total_sales_usd', 'email_address']);
  });

  it('handles camelCase and PascalCase appropriately', () => {
    const headers = ['customerName', 'TotalRevenue', 'orderID'];
    const keys = sanitiseHeaders(headers);
    expect(keys).toEqual(['customer_name', 'total_revenue', 'order_id']);
  });

  it('safely handles leading numbers', () => {
    const headers = ['2023 Revenue', '2024 Revenue', '123'];
    const keys = sanitiseHeaders(headers);
    for (const key of keys) {
      expect(SafeIdentifierSchema.safeParse(key).success).toBe(true);
      expect(key.startsWith('_')).toBe(true);
    }
  });

  it('generates fallback column names for empty or symbol-only headers', () => {
    const headers = ['', null, undefined, '$$$#@', '   '];
    const keys = sanitiseHeaders(headers);
    expect(keys).toEqual(['col_1', 'col_2', 'col_3', 'col_4', 'col_5']);
    for (const key of keys) {
      expect(SafeIdentifierSchema.safeParse(key).success).toBe(true);
    }
  });

  it('strictly neutralizes prototype pollution vectors (__proto__, constructor, prototype)', () => {
    const headers = ['__proto__', 'constructor', 'prototype', '__proto__'];
    const keys = sanitiseHeaders(headers);

    expect(keys).toEqual([
      'safe___proto__',
      'safe_constructor',
      'safe_prototype',
      'safe___proto___1',
    ]);

    for (const key of keys) {
      expect(SafeIdentifierSchema.safeParse(key).success).toBe(true);
      expect(['__proto__', 'constructor', 'prototype'].includes(key)).toBe(false);
    }
  });

  it('disambiguates duplicate headers with sequential suffixes', () => {
    const headers = ['Region', 'Sales', 'Region', 'Region', 'Sales'];
    const keys = sanitiseHeaders(headers);
    expect(keys).toEqual(['region', 'sales', 'region_1', 'region_2', 'sales_1']);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('truncates extremely long headers to stay within the 128 character limit', () => {
    const veryLong = 'a'.repeat(200);
    const keys = sanitiseHeaders([veryLong, veryLong]);
    expect(keys[0]!.length).toBeLessThanOrEqual(128);
    expect(keys[1]!.length).toBeLessThanOrEqual(128);
    expect(SafeIdentifierSchema.safeParse(keys[0]).success).toBe(true);
    expect(SafeIdentifierSchema.safeParse(keys[1]).success).toBe(true);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it('sanitises individual tokens via sanitiseHeaderToken', () => {
    expect(sanitiseHeaderToken('User Profile!', 0)).toBe('user_profile');
    expect(sanitiseHeaderToken('__proto__', 1)).toBe('safe___proto__');
  });
});
