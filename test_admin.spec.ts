import { test, expect } from '@playwright/test';

test('verify app dashboard and admin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nst_current_user', JSON.stringify({
      id: "admin1",
      name: "Admin User",
      email: "test@example.com",
      role: "admin",
      isAdmin: true,
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
  await page.waitForTimeout(1000);

  // Dashboard screenshot
  await page.screenshot({ path: 'dashboard_with_header.png' });

  // Click admin button (it is a shield or gear icon if admin)
  // Let's just evaluate JS to change state or click
  const adminBtn = await page.$('.lucide-shield-alert');
  if (adminBtn) {
    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Click Content tab
    await page.getByText('Content', { exact: true }).click();
    await page.waitForTimeout(500);

    // Switch to MCQ
    await page.evaluate(() => {
       const buttons = Array.from(document.querySelectorAll('button'));
       const contentBtn = buttons.find(b => b.textContent?.includes('Content'));
       if (contentBtn) contentBtn.click();
    });

    await page.waitForTimeout(500);

    await page.evaluate(() => {
       const buttons = Array.from(document.querySelectorAll('button'));
       const mcqBtn = buttons.find(b => b.textContent === 'MCQs');
       if (mcqBtn) mcqBtn.click();
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'admin_mcq.png' });
  }
});
