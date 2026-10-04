import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config.mjs';

describe('Next.js Security & Build Configuration', () => {
  it('defines required security headers', async () => {
    expect(nextConfig.headers).toBeDefined();
    const headersConfig = await nextConfig.headers!();
    expect(headersConfig.length).toBeGreaterThan(0);

    const rootHeaders = headersConfig[0]?.headers ?? [];
    const headerMap = Object.fromEntries(
      rootHeaders.map((h: { key: string; value: string }) => [h.key, h.value])
    );

    expect(headerMap['X-Content-Type-Options']).toBe('nosniff');
    expect(headerMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headerMap['Permissions-Policy']).toContain('camera=()');
    expect(headerMap['Content-Security-Policy']).toBeDefined();
    expect(headerMap['X-Frame-Options']).toBe('DENY');
  });

  it('configures transpilePackages for monorepo workspace packages', () => {
    expect(nextConfig.transpilePackages).toEqual(
      expect.arrayContaining(['@unsheet/contracts', '@unsheet/engine', '@unsheet/fixtures'])
    );
  });

  it('configures webpack WebAssembly and extension alias', () => {
    expect(nextConfig.webpack).toBeDefined();
    interface WebpackMockConfig {
      experiments?: { asyncWebAssembly?: boolean };
      resolve?: { extensionAlias?: Record<string, string[]> };
    }
    const dummyWebpackConfig: WebpackMockConfig = { experiments: {}, resolve: {} };
    const result = nextConfig.webpack!(
      dummyWebpackConfig as Parameters<NonNullable<typeof nextConfig.webpack>>[0]
    ) as WebpackMockConfig;
    expect(result.experiments?.asyncWebAssembly).toBe(true);
    expect(result.resolve?.extensionAlias?.['.js']).toContain('.ts');
  });
});
