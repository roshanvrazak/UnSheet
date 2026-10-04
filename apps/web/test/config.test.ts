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
    expect(headerMap['X-Frame-Options']).toBe('DENY');
    expect(headerMap['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );

    const csp = headerMap['Content-Security-Policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("child-src 'self' blob:");
    expect(csp).toContain('https://cdn.jsdelivr.net');

    const scriptSrcMatch = csp!.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();
    // Next.js App Router requires 'unsafe-inline' in script-src for React hydration scripts unless dynamic nonce middleware is used.
    expect(scriptSrcMatch![1]).toContain("'unsafe-inline'");
    expect(scriptSrcMatch![1]).toContain("'wasm-unsafe-eval'");
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
