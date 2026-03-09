import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('verify dashboard premium styling', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5002/');

    // Inject mock local storage for a premium user to bypass onboarding and logic modals
    await page.evaluate(() => {
        const mockUser = {
            id: 'mock_user_123',
            name: 'Nadim',
            role: 'ADMIN',
            mobile: '1234567890',
            classLevel: '10',
            stream: 'Science',
            board: 'CBSE',
            isPremium: true,
            subscriptionLevel: 'ULTRA',
            subscriptionTier: 'YEARLY',
            subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            credits: 82,
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            mcqHistory: [],
            dailyRoutine: { date: new Date().toDateString() }
        };
        localStorage.setItem('nst_current_user', JSON.stringify(mockUser));

        // Disable various annoying popups
        localStorage.setItem('nst_last_read_update', Date.now().toString());
        localStorage.setItem(`referral_shown_${mockUser.id}`, 'true');
        localStorage.setItem(`last_upsell_${mockUser.id}`, Date.now().toString());
        localStorage.setItem(`last_expiry_warn_${mockUser.id}`, Date.now().toString());
        localStorage.setItem(`first_day_ultra_${mockUser.id}`, 'true');
    });

    // Reload to apply local storage
    await page.reload();

    // Wait for the main dashboard to load
    await page.waitForSelector('.min-h-screen');

    // Ensure we are in a mobile-like viewport as the screenshot looks like a mobile app
    await page.setViewportSize({ width: 390, height: 844 });

    // Wait for content to stabilize
    await page.waitForTimeout(2000);

    // Take screenshot of the result
    await page.screenshot({ path: 'dashboard_premium_style.png', fullPage: true });
    console.log('Saved screenshot to dashboard_premium_style.png');
});
