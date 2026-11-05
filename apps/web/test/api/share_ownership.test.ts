import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardSpec } from '@unsheet/contracts';

const fake = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  rows: [] as Record<string, unknown>[],
  insertError: false,
  updateError: false,
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: fake.createClient }));
import { POST as create } from '@/app/api/share/route';
import { GET as lookup } from '@/app/api/share/[token]/route';
import { POST as revoke } from '@/app/api/share/[token]/revoke/route';
import { createShareLink, getShareLinkByToken, revokeShareLink } from '@/lib/share/store';
import { generateShareToken } from '@/lib/share/token';

afterEach(() => vi.unstubAllEnvs());

const spec: DashboardSpec = {
  version: '1.0', id: 'ownership', title: 'Ownership', sheetBinding: 'sheet_1',
  layout: { columns: 12, gap: 16, padding: 16 }, filters: [],
  widgets: [{ id: 'kpi', type: 'kpi', title: 'Revenue', measure: 'revenue', aggregation: 'sum', grid: { x: 0, y: 0, w: 4, h: 2 } }],
};
const context = (token: string) => ({ params: Promise.resolve({ token }) });
const revokeRequest = (token: string, headers: Record<string, string> = {}) => new NextRequest(`http://localhost/api/share/${token}/revoke`, { method: 'POST', headers });
const createRequest = (headers: Record<string, string> = {}) => new NextRequest('http://localhost/api/share', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ title: 'Ownership', spec }),
});

describe('Anonymous share ownership', () => {
  it('viewing access cannot revoke; only the separate management secret can', async () => {
    const response = await create(createRequest());
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const created = await response.json();
    expect(created.managementToken).not.toBe(created.shareToken);
    const record = await getShareLinkByToken(created.shareToken);
    expect(record?.management_token_hash).toHaveLength(64);
    expect(record?.management_token_hash).not.toBe(created.managementToken);
    const view = await lookup(new NextRequest(`http://localhost/api/share/${created.shareToken}`), context(created.shareToken));
    const body = await view.json();
    expect(body.managementToken).toBeUndefined();
    expect(body.management_token_hash).toBeUndefined();
    for (const headers of [{}, { 'x-share-management-token': created.shareToken }, { 'x-share-management-token': generateShareToken() }]) {
      expect((await revoke(revokeRequest(created.shareToken, headers), context(created.shareToken))).status).toBe(404);
      expect(await getShareLinkByToken(created.shareToken)).not.toBeNull();
    }
    expect((await revoke(revokeRequest(created.shareToken, { 'x-share-management-token': created.managementToken }), context(created.shareToken))).status).toBe(200);
    expect(await getShareLinkByToken(created.shareToken)).toBeNull();
  });

  it('an unrelated authenticated user cannot revoke an anonymous link without its secret', async () => {
    const link = await createShareLink({ title: 'Anonymous', spec });
    expect(await revokeShareLink(link.shareToken, { userId: 'other-user' })).toBe(false);
  });

  it('owned links require the exact owner and never issue an anonymous secret', async () => {
    const link = await createShareLink({ title: 'Owned', spec, userId: 'owner' });
    expect(link.managementToken).toBeUndefined();
    expect(await revokeShareLink(link.shareToken)).toBe(false);
    expect(await revokeShareLink(link.shareToken, { userId: 'other' })).toBe(false);
    expect(await revokeShareLink(link.shareToken, { managementToken: generateShareToken() })).toBe(false);
    expect(await revokeShareLink(link.shareToken, { userId: 'owner' })).toBe(true);
  });

  it('rejects supplied bearer tokens when verification is unavailable rather than creating anonymous links', async () => {
    expect((await create(createRequest({ authorization: 'Bearer forged' }))).status).toBe(401);
    expect((await create(createRequest({ authorization: 'Basic forged' }))).status).toBe(401);
  });
});

describe('Supabase-backed ownership', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key');
    fake.rows = [];
    fake.insertError = false;
    fake.updateError = false;
    fake.getUser.mockImplementation(async (jwt: string) => jwt === 'valid-owner'
      ? { data: { user: { id: 'owner' } }, error: null }
      : jwt === 'valid-other' ? { data: { user: { id: 'other' } }, error: null }
      : { data: { user: null }, error: new Error('Invalid JWT') });
    fake.createClient.mockReturnValue({
      auth: { getUser: fake.getUser },
      from: () => {
        let update: Record<string, unknown> | undefined;
        const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
        const query = {
          insert: async (row: Record<string, unknown>) => {
            if (fake.insertError) return { error: new Error('Insert failed') };
            fake.rows.push(row); return { error: null };
          },
          update: (patch: Record<string, unknown>) => { update = patch; return query; },
          eq: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return query; },
          is: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return query; },
          select: () => {
            if (!update) return query;
            if (fake.updateError) return Promise.resolve({ data: null, error: new Error('Update failed') });
            const rows = fake.rows.filter(row => predicates.every(predicate => predicate(row)));
            rows.forEach(row => Object.assign(row, update));
            return Promise.resolve({ data: rows.map(row => ({ id: row.id })), error: null });
          },
          single: async () => ({ data: fake.rows.find(row => predicates.every(predicate => predicate(row))) || null, error: null }),
        };
        return query;
      },
    });
  });

  it('verifies tokens with Supabase and rejects a forged JWT', async () => {
    expect((await create(createRequest({ authorization: 'Bearer forged' }))).status).toBe(401);
    expect(fake.rows).toHaveLength(0);
    expect(fake.getUser).toHaveBeenCalledWith('forged');
    const result = await create(createRequest({ authorization: 'Bearer valid-owner' }));
    expect(result.status).toBe(201);
    const created = await result.json();
    expect(created.managementToken).toBeUndefined();
    expect(fake.rows[0]?.user_id).toBe('owner');
    expect((await revoke(revokeRequest(created.shareToken, { authorization: 'Bearer valid-other' }), context(created.shareToken))).status).toBe(404);
    expect(fake.rows[0]?.is_revoked).toBe(false);
    expect((await revoke(revokeRequest(created.shareToken, { authorization: 'Bearer valid-owner' }), context(created.shareToken))).status).toBe(200);
    expect(fake.rows[0]?.is_revoked).toBe(true);
  });

  it('matches anonymous management hashes and requires an affected database row', async () => {
    const created = await (await create(createRequest())).json();
    expect((await revoke(revokeRequest(created.shareToken, { 'x-share-management-token': generateShareToken() }), context(created.shareToken))).status).toBe(404);
    expect(fake.rows[0]?.is_revoked).toBe(false);
    expect((await revoke(revokeRequest(created.shareToken, { 'x-share-management-token': created.managementToken }), context(created.shareToken))).status).toBe(200);
    const missing = generateShareToken();
    expect((await revoke(revokeRequest(missing, { authorization: 'Bearer valid-owner' }), context(missing))).status).toBe(404);
  });
  it('fails closed when durable creation or revocation fails', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.insertError = true;
    expect((await create(createRequest())).status).toBe(500);
    expect(fake.rows).toHaveLength(0);
    fake.insertError = false;
    const created = await (await create(createRequest())).json();
    fake.updateError = true;
    expect((await revoke(revokeRequest(created.shareToken, { 'x-share-management-token': created.managementToken }), context(created.shareToken))).status).toBe(500);
    expect(fake.rows[0]?.is_revoked).toBe(false);
    logger.mockRestore();
  });

});

  it('does not use public anonymous credentials as a substitute for the server key', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key');
    const isolated = await import('@/lib/share/store');
    expect(() => isolated.getShareSupabase()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });
