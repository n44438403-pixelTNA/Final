import { chromium, devices } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['Pixel 5'],
  });

  await context.addInitScript(() => {
    const mockUser = {
      uid: 'user123',
      email: 'student@example.com',
      displayName: 'Test Student',
      role: 'STUDENT',
      profileCompleted: true,
      class: 'Class 10',
      board: 'CBSE',
      points: 1250,
      tier: 'FREE'
    };
    window.localStorage.setItem('nst_current_user', JSON.stringify(mockUser));
    window.localStorage.setItem('nst_terms_accepted', 'true');
    window.localStorage.setItem('nst_has_seen_welcome', 'true');
    window.sessionStorage.setItem('app_session_splash', 'true');
  });

  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle' });

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Wait for global header to appear
    await page.waitForSelector('header');

    // Hide popups like update or install prompts to get a clean screenshot
    await page.evaluate(() => {
       const modals = document.querySelectorAll('.fixed.inset-0');
       modals.forEach(el => {
         if (el.style.zIndex && parseInt(el.style.zIndex) > 100) {
           el.style.display = 'none';
         }
       });

       const floatingInstall = document.querySelectorAll('div.fixed.bottom-20');
       floatingInstall.forEach(el => el.style.display = 'none');
    });

    await page.screenshot({ path: 'dashboard_clean_header.png' });
    console.log('Successfully saved screenshot to dashboard_clean_header.png');
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
})();
