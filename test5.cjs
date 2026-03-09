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
  await page.waitForTimeout(4000); // Wait for initial load

  // Click any 'I AGREE & CONTINUE' button
  try {
      await page.evaluate(() => {
          const agreeBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('AGREE'));
          if (agreeBtn) agreeBtn.click();
      });
      await page.waitForTimeout(1000);
  } catch(e) {}

  // Click 'CLAIM LATER' button
  try {
      await page.evaluate(() => {
          const claimBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('CLAIM LATER'));
          if (claimBtn) claimBtn.click();

          // Also try clicking the close 'X' on modals
          const xBtns = document.querySelectorAll('button');
          for(let btn of xBtns) {
             if(btn.innerHTML.includes('lucide-x') || btn.innerHTML.includes('<line') || btn.innerHTML.includes('path') ) {
                if(btn.className.includes('absolute')) {
                   btn.click();
                }
             }
          }
      });
      await page.waitForTimeout(1000);
  } catch(e) {}

  await page.screenshot({ path: 'student_dashboard_main5.png' });
  await browser.close();
})();
