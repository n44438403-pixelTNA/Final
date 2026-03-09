import { test, expect } from '@playwright/test';

test('verify dashboard loads correctly', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nst_current_user', JSON.stringify({
      id: "test1",
      name: "Test User",
      email: "test@example.com",
      role: "student",
      classLevel: "10",
      board: "CBSE",
      stream: "Science",
      language: "en",
      credits: 100,
      profileCompleted: true
    }));
    localStorage.setItem('nst_terms_accepted', 'true');
    localStorage.setItem('nst_has_seen_welcome', 'true');
    sessionStorage.setItem('app_session_splash', 'true');
  });

  await page.goto('http://localhost:5000');
  await page.waitForTimeout(2000);

  // Verify bottom nav exists on Home
  const bottomNav = page.locator('.fixed.bottom-0.z-\\[9990\\]');
  await expect(bottomNav).toBeVisible();

  // Take screenshot of the loaded dashboard
  await page.screenshot({ path: 'dashboard.png' });
});
