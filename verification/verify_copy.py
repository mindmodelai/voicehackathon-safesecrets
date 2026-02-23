from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    context.grant_permissions(['clipboard-read', 'clipboard-write'])
    page = context.new_page()
    page.goto('http://localhost:5173')

    # Click Start Conversation
    page.click('text=Start Conversation')

    # Wait for ArtifactPanel delay (2s) + animation
    time.sleep(3)

    # Locate copy button
    copy_btn = page.locator('button[aria-label="Copy note to clipboard"]')

    # Click it
    copy_btn.click()

    # Check for feedback (it changes label immediately)
    page.locator('button[aria-label="Copied!"]').wait_for()

    # Screenshot
    page.screenshot(path='verification/copied_state.png')

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
