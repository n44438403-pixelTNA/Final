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
      createdAt: new Date().toISOString()
    }));
  });

  await page.reload();
  await page.waitForTimeout(5000); // Wait 5s to bypass loading

  await page.evaluate(() => {
      document.querySelector('button.absolute.top-4.right-4')?.click();
      const claimBtn = document.evaluate("//button[contains(text(), 'CLAIM LATER')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (claimBtn) claimBtn.click();
  });

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'student_dashboard_main4.png' });
  await browser.close();
})();
