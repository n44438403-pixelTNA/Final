const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
    localStorage.setItem('nst_terms_accepted', 'true');
    localStorage.setItem('nst_has_seen_welcome', 'true');
    sessionStorage.setItem('app_session_splash', 'true');
  });

  const page = await context.newPage();
  await page.goto('http://localhost:5000', { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  const headerHTML = await page.evaluate(() => {
     const h = document.querySelector('header');
     return h ? h.outerHTML : 'NO HEADER FOUND';
  });
  console.log("HEADER:", headerHTML);

  const mainPadding = await page.evaluate(() => {
     const m = document.querySelector('main');
     if (!m) return 'NO MAIN';
     return { pt: m.style.paddingTop, classes: m.className, offsetTop: m.offsetTop };
  });
  console.log("MAIN:", mainPadding);

  await browser.close();
})();
