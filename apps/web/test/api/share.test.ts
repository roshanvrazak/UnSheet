import { describe, it, expect } from 'vitest';
import { POST as createSharePost } from '@/app/api/share/route';
import { GET as getShareGet } from '@/app/api/share/[token]/route';
import { POST as revokeSharePost } from '@/app/api/share/[token]/revoke/route';
import { NextRequest } from 'next/server';
import { ShareTokenSchema } from '@unsheet/contracts';
import { generateShareToken } from '@/lib/share/token';
import fs from 'node:fs';
import path from 'node:path';

const sampleSpec = {
  version: '1.0' as const,
  id: 'dash_share_test',
  title: 'Shared Performance Dashboard',
  sheetBinding: 'sheet_1',
  layout: { columns: 12, gap: 16, padding: 16 },
  filters: [],
  widgets: [
    {
      id: 'kpi_1',
      type: 'kpi' as const,
      title: 'Total Revenue',
      grid: { x: 0, y: 0, w: 4, h: 4 },
      measure: 'revenue',
      aggregation: 'sum' as const,
    },
  ],
};

describe('Phase 6 Share Links & Templates API & Security', () => {
  it('Test 1: Token entropy and ShareTokenSchema compliance', () => {
    const token1 = generateShareToken();
    const token2 = generateShareToken();

    expect(token1).not.toBe(token2);
    
    const parsed1 = ShareTokenSchema.safeParse(token1);
    expect(parsed1.success).toBe(true);
    expect(token1.length).toBeGreaterThanOrEqual(22);
    expect(/^[A-Za-z0-9_-]+$/.test(token1)).toBe(true);
  });

  it('Test 2: POST /api/share creating share link', async () => {
    const req = new NextRequest('http://localhost:3000/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Shared Performance Dashboard',
        spec: sampleSpec,
        allowExport: true,
        expiresInHours: 24,
      }),
    });

    const res = await createSharePost(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.shareToken).toBeDefined();
    expect(data.shareUrl).toContain(data.shareToken);
    expect(data.expiresAt).toBeDefined();
  });

  it('Test 3: GET /api/share/[token] retrieving valid active link', async () => {
    // First create a link
    const createReq = new NextRequest('http://localhost:3000/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Active Link Dashboard',
        spec: sampleSpec,
        allowExport: false,
      }),
    });
    const createRes = await createSharePost(createReq);
    const createData = await createRes.json();
    const token = createData.shareToken;

    // Retrieve via GET
    const getReq = new NextRequest(`http://localhost:3000/api/share/${token}`, {
      method: 'GET',
    });
    const getRes = await getShareGet(getReq, { params: Promise.resolve({ token }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.title).toBe('Active Link Dashboard');
    expect(getData.spec.title).toBe('Shared Performance Dashboard');
    expect(getData.allowExport).toBe(false);
  });

  it('Test 4: Missing vs expired/revoked tokens returning identical 404 responses', async () => {
    const nonExistentToken = generateShareToken();
    const getReqMissing = new NextRequest(`http://localhost:3000/api/share/${nonExistentToken}`, {
      method: 'GET',
    });
    const resMissing = await getShareGet(getReqMissing, { params: Promise.resolve({ token: nonExistentToken }) });
    expect(resMissing.status).toBe(404);
    const bodyMissing = await resMissing.json();

    // Create and revoke a link
    const createReq = new NextRequest('http://localhost:3000/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Revokable Dashboard',
        spec: sampleSpec,
      }),
    });
    const createRes = await createSharePost(createReq);
    const createData = await createRes.json();
    const token = createData.shareToken;

    const revokeReq = new NextRequest(`http://localhost:3000/api/share/${token}/revoke`, {
      method: 'POST',
    });
    await revokeSharePost(revokeReq, { params: Promise.resolve({ token }) });

    // Retrieve revoked link
    const getReqRevoked = new NextRequest(`http://localhost:3000/api/share/${token}`, {
      method: 'GET',
    });
    const resRevoked = await getShareGet(getReqRevoked, { params: Promise.resolve({ token }) });
    expect(resRevoked.status).toBe(404);
    const bodyRevoked = await resRevoked.json();

    // Threat model requirement: Identical response for security oracle prevention
    expect(bodyMissing).toEqual(bodyRevoked);
    expect(bodyMissing.error).toBe('Share link not found or expired');
  });

  it('Test 5: Rate limiting on token lookups returning 429', async () => {
    const token = generateShareToken();
    const makeReq = () =>
      new NextRequest(`http://localhost:3000/api/share/${token}`, {
        method: 'GET',
        headers: { 'x-forwarded-for': '10.0.0.99' },
      });

    let lastRes;
    for (let i = 0; i < 65; i++) {
      lastRes = await getShareGet(makeReq(), { params: Promise.resolve({ token }) });
    }

    expect(lastRes?.status).toBe(429);
    expect(lastRes?.headers.get('Retry-After')).toBeDefined();
  });

  it('Test 6: SQL migration syntax and RLS policy verification', () => {
    const possiblePaths = [
      path.resolve(process.cwd(), 'supabase/migrations/20261004000000_phase6_shares_and_templates.sql'),
      path.resolve(process.cwd(), '../../supabase/migrations/20261004000000_phase6_shares_and_templates.sql'),
      path.resolve(__dirname, '../../../../supabase/migrations/20261004000000_phase6_shares_and_templates.sql'),
    ];
    const migrationPath = possiblePaths.find((p) => fs.existsSync(p)) ?? possiblePaths[0]!;
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS templates');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS share_links');
    expect(migrationSql).toContain('ALTER TABLE templates ENABLE ROW LEVEL SECURITY;');
    expect(migrationSql).toContain('ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;');
    expect(migrationSql).toContain('CREATE POLICY "Users can select own templates"');
    expect(migrationSql).toContain('CREATE POLICY "Public read active share links"');
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links (share_token);');
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates (user_id);');
  });
});
