import { test, expect } from '@playwright/test';

async function loadDashboard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Capital_Projects Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Raw Records', exact: true }).getByText('Page 1 of 3')).toBeVisible();
}

test('loads samples and paginates all records', async ({ page }) => {
  await loadDashboard(page);
  const table = page.getByRole('region', { name: 'Raw Records', exact: true });
  await table.getByRole('button', { name: 'Next page' }).click();
  await expect(table.getByText('Page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: /BOQ & Quotes/ }).click();
  await expect(page.getByRole('heading', { name: 'Bill_of_Quantities Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Engine pipeline status' })).toContainText('4. SpecGen');
});

test('filters update totals and reset restores records', async ({ page }) => {
  await loadDashboard(page);
  const table = page.getByRole('region', { name: 'Raw Records', exact: true });
  await page.getByLabel('Stage', { exact: true }).selectOption('Feasibility');
  await expect(table.getByText('Page 1 of 1')).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Execution', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(table.getByText('Page 1 of 3')).toBeVisible();
});

test('Ask AI executes an average and adds its widget', async ({ page }) => {
  await loadDashboard(page);
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ask Your Data' });
  await drawer.getByPlaceholder('Ask a question about your data...').fill('Average approved_budget');
  await drawer.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(drawer.getByText(/3,015,600/).first()).toBeVisible({ timeout: 60000 });
  await drawer.getByRole('button', { name: 'Add to Dashboard', exact: true }).click();
  await expect(drawer.getByText('Added to dashboard!')).toBeVisible();
});

test('CSV export includes values under original headers', async ({ page }) => {
  await loadDashboard(page);
  await page.getByRole('button', { name: 'Export options', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString();
  expect(csv).toContain('Project Code,Project Name');
  expect(csv).toContain('PRJ-01,NextGen Telemetry Grid');
  expect(csv.split('\r\n')).toHaveLength(26);
});

test('navbar upload works with the ingestion panel collapsed', async ({ page }) => {
  await loadDashboard(page);
  await page.getByRole('button', { name: 'Switch dataset / Upload', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New File', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'demo.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Revenue\nNorth,10\nSouth,30') });
  await expect(page.getByRole('heading', { name: 'Sheet1 Dashboard', exact: true })).toBeVisible();
});

test('executes generated SQL in DuckDB without substituting a heuristic answer', async ({ page }) => {
  test.setTimeout(90000);
  await loadDashboard(page);
  await page.route('**/api/query/ask', async route => {
    await route.fulfill({ json: { success: true, interpretedIntent: 'Filtered average', sql: 'SELECT AVG("approved_budget") AS "average_budget" FROM "Capital_Projects" WHERE "approved_budget" > 4000000', explanation: 'Average for budgets above 4 million.' } });
  });
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Ask Your Data' });
  await drawer.getByPlaceholder('Ask a question about your data...').fill('Average budget above 4 million');
  await drawer.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(drawer.getByText(/Result:.*average budget/)).toBeVisible({ timeout: 60000 });
  await expect(drawer.getByRole('button', { name: 'Add to Dashboard', exact: true })).toHaveCount(0);
});

test('refines the dashboard and undo restores its title', async ({ page }) => {
  await loadDashboard(page);
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  await page.getByPlaceholder(/Refine dashboard with AI/).fill('Change title to Interview Demo');
  await page.getByPlaceholder(/Refine dashboard with AI/).press('Enter');
  await expect(page.getByRole('heading', { name: 'Interview Demo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Capital_Projects Dashboard', exact: true })).toBeVisible();
});

test('data explorer searches fields and closes with Escape', async ({ page, isMobile }) => {
  await loadDashboard(page);
  if (isMobile) await page.getByRole('button', { name: 'Toggle sheet and field inspector', exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Sheet and field inspector' });
  await inspector.getByRole('searchbox', { name: 'Search fields' }).fill('Approved Budget');
  await expect(inspector.getByRole('checkbox')).toHaveCount(1);
  await expect(inspector.getByRole('checkbox', { name: 'toggle approved_budget' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
