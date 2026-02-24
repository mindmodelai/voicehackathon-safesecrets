from playwright.sync_api import sync_playwright, expect
import time
import os

def verify_copy_button():
    with sync_playwright() as p:
        # Need to allow clipboard permissions in headless mode?
        # context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'])
        # But chromium headless clipboard access is tricky.
        # However, the button state change happens regardless of actual clipboard success?
        # Actually, navigator.clipboard.writeText usually requires focus and permissions.

        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.grant_permissions(['clipboard-read', 'clipboard-write'])
        page = context.new_page()

        # 1. Arrange: Go to the app
        print("Navigating to app...")
        page.goto("http://localhost:5173/")

        # 2. Wait for ArtifactPanel content to appear (2000ms delay + buffer)
        print("Waiting for ArtifactPanel content to appear...")
        # Since we hardcoded isActive=true, it should appear after 2s.
        # We can also use page.wait_for_selector or expect().to_be_visible() with timeout
        copy_button = page.get_by_test_id("copy-button")
        expect(copy_button).to_be_visible(timeout=5000)

        # Verify initial state
        expect(copy_button).to_have_text("📋")
        expect(copy_button).to_have_attribute("aria-label", "Copy note to clipboard")

        print("Copy button found with correct initial state.")

        # 4. Act: Click the button
        print("Clicking copy button...")
        copy_button.click()

        # 5. Assert: Verify the button state changes
        expect(copy_button).to_have_text("✅")
        expect(copy_button).to_have_attribute("aria-label", "Copied!")

        print("Copy button changed state correctly!")

        # 6. Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/verification.png")

        browser.close()

if __name__ == "__main__":
    try:
        verify_copy_button()
        print("Verification successful!")
    except Exception as e:
        print(f"Verification failed: {e}")
        exit(1)
