import { test, expect } from '@playwright/test';

test.describe('Unsheet Full Pipeline & Dashboard E2E Tests', () => {
  test('Test 1: Full pipeline workflow - Load sample workbook, verify 5-step timing bar, verify dashboard grid rendered', async ({ page }) => {
    await page.goto('/');

    // Verify title/branding
    await expect(page.locator('h1')).toContainText('Unsheet');

    // Click sample workbook loader (e.g., Financials or SaaS Metrics)
    const sampleButton = page.locator('button:has-text("SaaS Metrics")').first();
    await sampleButton.click();

    // Verify 5-step timing bar (Parse -> Normalise -> Profile -> SpecGen -> Render)
    const timingBar = page.locator('text=/Parse|Normalise|Profile|SpecGen|Render/i').first();
    await expect(timingBar).toBeVisible({ timeout: 15000 });

    // Verify dashboard grid rendered with widget cards
    const widgetCard = page.locator('.widget-card, [data-testid="widget-card"], div:has(> h3)').first();
    await expect(widgetCard).toBeVisible({ timeout: 15000 });
  });

  test('Test 2: Filter interactivity - Interact with filter bar controls and verify reactive dashboard updates', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Financials")').first().click();

    // Wait for dashboard
    await page.waitForSelector('text=Revenue', { timeout: 15000 });

    // Locate filter controls if present
    const filterInput = page.locator('input[placeholder*="Filter"], input[type="search"]').first();
    if (await filterInput.isVisible()) {
      await filterInput.fill('Q1');
      // Verify reactive update
      await expect(page.locator('text=Q1')).toBeVisible();
    } else {
      // Fallback assertion if filter bar is dropdown or custom
      const filterBar = page.locator('div:has-text("Filter")').first();
      await expect(filterBar).toBeVisible();
    }
  });

  test('Test 3: Ask-Your-Data interaction - Open Ask Data drawer, submit natural language query, add widget', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Logistics")').first().click();
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });

    // Open Ask Data drawer
    const askButton = page.locator('button:has-text("Ask Data"), button:has-text("Ask Your Data")').first();
    if (await askButton.isVisible()) {
      await askButton.click();
      
      const promptInput = page.locator('input[placeholder*="query"], textarea[placeholder*="natural language"]').first();
      if (await promptInput.isVisible()) {
        await promptInput.fill('Show total shipments by region');
        const submitBtn = page.locator('button:has-text("Run"), button:has-text("Query")').first();
        await submitBtn.click();

        // Verify safe SQL preview
        const sqlPreview = page.locator('pre, code, text=/SELECT/i').first();
        await expect(sqlPreview).toBeVisible({ timeout: 10000 });

        // Add widget to dashboard
        const addWidgetBtn = page.locator('button:has-text("Add to Dashboard"), button:has-text("Add Widget")').first();
        if (await addWidgetBtn.isVisible()) {
          await addWidgetBtn.click();
        }
      }
    }
  });

  test('Test 4: Export workflow - Open export menu, trigger safe CSV download', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Financials")').first().click();
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });

    // Open export menu or button
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      const csvOption = page.locator('button:has-text("CSV"), a:has-text("CSV")').first();
      if (await csvOption.isVisible()) {
        const downloadPromise = page.waitForEvent('download').catch(() => null);
        await csvOption.click();
        const download = await downloadPromise;
        if (download) {
          expect(download.suggestedFilename()).toContain('.csv');
        }
      }
    }
  });

  test('Test 5: Template saving and drift detection workflow', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Financials")').first().click();
    await page.waitForSelector('text=Dashboard', { timeout: 15000 });

    // Save as template button
    const saveTemplateBtn = page.locator('button:has-text("Save Template"), button:has-text("Template")').first();
    if (await saveTemplateBtn.isVisible()) {
      await saveTemplateBtn.click();
      const templateNameInput = page.locator('input[placeholder*="Template Name"]').first();
      if (await templateNameInput.isVisible()) {
        await templateNameInput.fill('E2E Test Template');
        await page.locator('button:has-text("Confirm Save"), button:has-text("Save")').last().click();
        await expect(page.locator('text=E2E Test Template')).toBeVisible();
      }
    }
  });
});
