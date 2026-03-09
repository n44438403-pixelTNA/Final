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
      // Adding a recent reward claim date so the daily bonus doesn't pop up!
      lastLoginRewardDate: new Date().toISOString().split('T')[0]
    }));
  });

  await page.reload();
  await page.waitForTimeout(3000); // Wait for initial load

  // Close the 'I AGREE' terms modal
  try {
      await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for(let b of btns) {
              if (b.textContent.includes('AGREE')) b.click();
          }
      });
  } catch(e) {}

  await page.waitForTimeout(2000);

  // Close any Reward Popup if it still shows up
  try {
      await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for(let b of btns) {
              if (b.textContent.toLowerCase().includes('claim later')) b.click();
          }
      });
  } catch(e) {}

  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'student_dashboard_clean7.png' });
  await browser.close();
})();
