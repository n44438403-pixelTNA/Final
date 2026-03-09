from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 412, "height": 915})
        page = context.new_page()

        # Inject mock user and bypass onboarding
        context.add_init_script("""
            localStorage.setItem('nst_terms_accepted', 'true');
            localStorage.setItem('nst_has_seen_welcome', 'true');
            sessionStorage.setItem('app_session_splash', 'true');

            // Set login reward date to prevent popup
            localStorage.setItem('nst_current_user', JSON.stringify({
                id: 'mock_user',
                name: 'Test Student',
                role: 'STUDENT',
                profileCompleted: true,
                classLevel: '10',
                board: 'CBSE',
                lastLoginRewardDate: new Date().toISOString()
            }));

            // Auto close reward popup if it appears
            setInterval(() => {
                const claimLater = document.evaluate("//button[contains(text(), 'CLAIM LATER')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (claimLater) claimLater.click();
            }, 500);
        """)

        page.goto('http://localhost:5000')

        page.wait_for_timeout(3000)

        # Scroll down to ensure headers and footers are sticky
        page.mouse.wheel(0, 500)
        page.wait_for_timeout(1000)

        # Take a screenshot to verify layout
        page.screenshot(path='/home/jules/verification/scrolled_layout2.png')

        browser.close()

if __name__ == '__main__':
    run()
