const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`));

  // Capture page errors
  page.on('pageerror', error => console.error(`BROWSER ERROR: ${error.message}`));

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
  await page.waitForTimeout(5000); // Wait for initial load

  // Close modals using specific logic
  await page.evaluate(() => {
      // 1. Agree button
      const agreeBtns = Array.from(document.querySelectorAll('button')).filter(el => el.textContent.includes('AGREE'));
      if(agreeBtns.length) agreeBtns[0].click();
  });

  await page.waitForTimeout(1000);

  await page.evaluate(() => {
      // 2. Claim later
      const claimBtns = Array.from(document.querySelectorAll('button')).filter(el => el.textContent.includes('CLAIM LATER') || el.textContent.includes('Claim Later'));
      if(claimBtns.length) claimBtns[0].click();

      // 3. Any close X buttons
      const closeBtns = document.querySelectorAll('button');
      for (const btn of closeBtns) {
          if (btn.innerHTML.includes('lucide-x')) {
              btn.click();
          }
      }
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'student_dashboard_debug.png' });
  await browser.close();
})();
