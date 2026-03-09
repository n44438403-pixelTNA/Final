const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5000');

  // Set fake local storage to bypass login
  await page.evaluate(() => {
    localStorage.setItem('nst_current_user', JSON.stringify({
      id: "testuser",
      name: "Test User",
      role: "STUDENT",
      mobile: "1234567890",
      classLevel: "10",
      board: "CBSE",
      stream: "Science",
      subscriptionTier: "FREE",
      credits: 100,
      createdAt: new Date().toISOString(),
      lastLoginRewardDate: new Date().toISOString().split('T')[0],
      profileCompleted: true // IMPORTANT: so we don't land on ONBOARDING / board selection!
    }));
    // Explicitly accept terms!
    localStorage.setItem('nst_terms_accepted', 'true');
    localStorage.setItem('nst_has_seen_welcome', 'true');
  });

  await page.reload();
  await page.waitForTimeout(4000); // Wait for initial load

  await page.screenshot({ path: 'student_dashboard_clean8.png' });
  await browser.close();
})();
