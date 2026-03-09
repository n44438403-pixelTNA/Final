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
            localStorage.setItem('nst_current_user', JSON.stringify({
                id: 'mock_user',
                name: 'Test Student',
                role: 'STUDENT',
                profileCompleted: true,
                classLevel: '10',
                board: 'CBSE'
            }));
        """)

        page.goto('http://localhost:5000')

        page.wait_for_timeout(3000)

        # Take a screenshot to verify layout
        page.screenshot(path='/home/jules/verification/fixed_layout.png')

        browser.close()

if __name__ == '__main__':
    run()
