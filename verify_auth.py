from playwright.sync_api import sync_playwright

def verify_auth_page():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 375, "height": 812}) # mobile viewport

        # Navigate to the local server
        page.goto("http://localhost:5000")

        # Wait for the page to load
        page.wait_for_selector("text=Continue with Google")

        # Take a screenshot
        page.screenshot(path="auth_page_verification.png")
        print("Screenshot saved to auth_page_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_auth_page()