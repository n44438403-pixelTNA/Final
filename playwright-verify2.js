import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Wait a bit just in case
  await page.waitForTimeout(1000);

  // Set fake user in local storage to bypass login
  await page.addInitScript(() => {
    window.localStorage.setItem('nst_current_user', JSON.stringify({
        id: 'test_user_123',
        name: 'Test Student',
        role: 'STUDENT',
        mobile: '9999999999',
        isPremium: true,
        credits: 100,
        board: 'CBSE',
        classLevel: '10',
        subscriptionTier: 'LIFETIME'
    }));
    window.localStorage.setItem('nst_has_seen_welcome', 'true');
    window.sessionStorage.setItem('app_session_splash', 'true');
  });

  try {
    await page.goto('http://localhost:5004');
    await page.waitForTimeout(3000);

    // Click on Revision tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const revBtn = buttons.find(b => b.textContent && b.textContent.includes('Revision'));
      if (revBtn) revBtn.click();
    });

    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'revision_hub_test.png' });
  } catch (e) {
    console.log("Could not load localhost:5004", e);
  }

  await browser.close();
})();
