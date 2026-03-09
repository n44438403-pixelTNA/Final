import { chromium, devices } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['Pixel 5'],
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto('http://localhost:5000');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'current_mobile.png' });

  await browser.close();
})();
