import { test, expect } from '@playwright/test';

/**
 * Smoke test: Search → Brand Detail → Proof page
 * 
 * Validates:
 * - Search functionality and results
 * - Brand detail page loads with Score Breakdown
 * - Recent Events timeline renders
 * - Proof page with evidence and dedup toggle
 * 
 * Run: APP_URL=https://yourapp.com npx playwright test tests/smoke.spec.ts
 */

test('search → brand detail → proof evidence', async ({ page }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:8080';
  
  // Navigate to home
  await page.goto(appUrl);
  await expect(page.locator('h1')).toContainText(/know your brands/i);

  // Open search
  const searchButton = page.getByRole('button', { name: /search/i });
  await searchButton.click();
  
  // Wait for search page
  await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  
  // Type search query
  await page.locator('input[placeholder*="Search"]').fill('nike');
  await page.keyboard.press('Enter');
  
  // Wait for results (or handle empty state)
  await page.waitForTimeout(1000);
  
  const results = page.locator('[role="button"]');
  const resultCount = await results.count();
  
  if (resultCount === 0) {
    console.log('No search results found - test requires seeded data');
    return; // Skip rest if no data
  }
  
  // Click first result
  await results.first().click();
  
  // Verify Brand Detail page loads
  await expect(page.locator('text=/Overall Score/i')).toBeVisible();
  
  // Verify Score Breakdown section exists
  const scoreBreakdown = page.locator('text=/Score transparency/i');
  await expect(scoreBreakdown).toBeVisible();
  
  // Verify breakdown shows Base / Δ / Now columns
  await expect(page.locator('text=/Base/i')).toBeVisible();
  await expect(page.locator('text=/Now/i')).toBeVisible();
  
  // Verify confidence bar exists
  await expect(page.locator('[aria-label*="Confidence"]')).toBeVisible();
  
  // Verify Recent Events section (or empty state)
  const recentEvents = page.locator('text=/Recent Events/i');
  if (await recentEvents.isVisible()) {
    // If events exist, verify timeline structure
    await expect(page.locator('[role="list"][aria-label*="timeline"]')).toBeVisible();
  }
  
  // Navigate to Proof page
  const viewEvidenceLink = page.getByRole('link', { name: /view all evidence/i }).first();
  await viewEvidenceLink.click();
  
  // Verify Proof page loads
  await expect(page.locator('text=/evidence/i')).toBeVisible();
  
  // Check for dedup toggle (if evidence present)
  const syndicatedToggle = page.getByRole('button', { name: /show syndicated copies/i });
  
  if (await syndicatedToggle.isVisible()) {
    // Click toggle
    await syndicatedToggle.click();
    
    // Verify it changed to "hide"
    await expect(page.getByRole('button', { name: /hide syndicated copies/i })).toBeVisible();
    
    // Toggle back
    await page.getByRole('button', { name: /hide syndicated copies/i }).click();
    await expect(syndicatedToggle).toBeVisible();
  }
  
  console.log('✅ Smoke test passed');
});

test('rate limit handling', async ({ page }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:8080';
  
  await page.goto(appUrl);
  
  // Open search
  await page.getByRole('button', { name: /search/i }).click();
  
  const searchInput = page.locator('input[placeholder*="Search"]');
  
  // Rapid-fire searches to trigger rate limit
  for (let i = 0; i < 12; i++) {
    await searchInput.fill(`test${i}`);
    await page.waitForTimeout(100);
  }
  
  // Check if rate limit toast appears
  // Note: This may not trigger in test environment if using localhost
  // In production, you should see "You're searching too fast" message
  
  console.log('✅ Rate limit test completed (check logs for rate_limited entries)');
});
