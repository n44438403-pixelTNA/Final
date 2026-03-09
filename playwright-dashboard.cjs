const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12 Pro size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
  });

  await context.addInitScript(() => {
    localStorage.setItem('nst_current_user', JSON.stringify({
      id: 'test_user_123',
      role: 'STUDENT',
      email: 'test@example.com',
      displayName: 'Test Student',
      name: 'Test Student',
      profileCompleted: true,
      classId: 'class_10',
      boardId: 'cbse',
      isPremium: true,
      subscriptionTier: 'PRO',
      subscriptionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionLevel: 'ULTRA',
      credits: 50,
      board: 'CBSE'
    }));
    // Try to trick the app so popups don't show
    localStorage.setItem('nst_terms_accepted', 'true');
    localStorage.setItem('nst_has_seen_welcome', 'true');
    sessionStorage.setItem('app_session_splash', 'true');
  });

  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5000', { waitUntil: 'load' });
    await page.waitForTimeout(4000);

    // Click ALL claim later buttons and close buttons
    const claimButtons = page.locator('button:has-text("CLAIM LATER")');
    const count = await claimButtons.count();
    for (let i = 0; i < count; i++) {
        await claimButtons.nth(i).click({ force: true });
    }

    await page.waitForTimeout(1000);

    const closeButtons = page.locator('button:has(svg.lucide-x)');
    const xCount = await closeButtons.count();
    for (let i = 0; i < xCount; i++) {
        if (await closeButtons.nth(i).isVisible()) {
            await closeButtons.nth(i).click({ force: true });
        }
    }

    await page.waitForTimeout(1000);

    // Extra force hide any modal overlay that might cover our top header
    await page.evaluate(() => {
         const modals = document.querySelectorAll('div[class*="fixed inset-0"]');
         modals.forEach(m => {
            m.style.setProperty('opacity', '0', 'important');
            m.style.setProperty('pointer-events', 'none', 'important');
            m.style.setProperty('z-index', '-1', 'important');
         });

         // Fix spacing on header if it wraps
         const headerItems = document.querySelectorAll('header .flex.items-center.gap-2');
         headerItems.forEach(hi => {
             hi.style.setProperty('flex-wrap', 'wrap', 'important');
             hi.style.setProperty('justify-content', 'flex-end', 'important');
         });
    });

    await page.waitForTimeout(500);

    await page.screenshot({ path: 'dashboard_clean7.png', fullPage: false });
    console.log('Clean screenshot saved as dashboard_clean7.png');

  } catch (error) {
    console.error('Error during Playwright execution:', error);
  } finally {
    await browser.close();
  }
})();
