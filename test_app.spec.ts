import { test, expect } from '@playwright/test';

test('verify app dashboard and admin', async ({ page }) => {
  // Mock local state to skip auth
  await page.addInitScript(() => {
    localStorage.setItem('nst_current_user', JSON.stringify({
      id: "test1",
      name: "Test User",
      email: "test@example.com",
      role: "admin",
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

  // Wait for load
  await page.waitForTimeout(2000);

  // Screenshot dashboard (should show top header and bottom nav)
  await page.screenshot({ path: 'dashboard_with_header.png' });

  // Navigate to Admin Dashboard (since user is admin, we might need to click the admin button)
  // But wait, the role is "admin". Let's wait.
  // Wait for the Settings/Admin gear icon or just log the console
});
