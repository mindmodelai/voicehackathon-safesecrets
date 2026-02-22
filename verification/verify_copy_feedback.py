import os
import time
from playwright.sync_api import sync_playwright

def verify_copy_feedback():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant clipboard permissions for verification
        context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'])

        page = context.new_page()

        try:
            # Navigate to the app (default Vite port is 5173)
            print("Navigating to http://localhost:5173")
            page.goto("http://localhost:5173")

            # Wait for "Start Conversation" button
            start_btn = page.get_by_test_id("start-conversation-button")
            start_btn.wait_for()

            # Click Start Conversation to trigger ArtifactPanel activation
            print("Clicking Start Conversation...")
            start_btn.click()

            # Wait for ArtifactPanel content to appear (2000ms delay + buffer)
            # The copy button has aria-label="Copy note to clipboard" initially
            copy_btn = page.get_by_label("Copy note to clipboard")

            print("Waiting for Copy button to appear (ArtifactPanel delay)...")
            # We need to wait for it to be visible. The timeout in ArtifactPanel is 2000ms.
            # Playwright auto-waits, so this should be fine if we set a timeout or just wait.
            copy_btn.wait_for(timeout=10000)

            print("Copy button found.")

            # Initial screenshot
            os.makedirs("verification", exist_ok=True)
            page.screenshot(path="verification/initial_state.png")
            print("Screenshot 'initial_state.png' taken.")

            print("Clicking Copy button...")
            copy_btn.click()

            # Verify feedback state: aria-label should change to "Copied!"
            # And text content to ✅

            # Wait for text update
            page.wait_for_timeout(500) # Give React a moment to render

            # Take screenshot of "Copied!" state
            page.screenshot(path="verification/copied_state.png")
            print("Screenshot 'copied_state.png' taken.")

            # Verify text content
            text = copy_btn.text_content()
            label = copy_btn.get_attribute("aria-label")
            print(f"Current text: '{text}', label: '{label}'")

            assert "✅" in text, f"Expected ✅, got {text}"
            assert label == "Copied!", f"Expected 'Copied!', got '{label}'"
            print("Verification PASSED: Button shows checkmark and 'Copied!' label.")

            # Wait for revert (2000ms delay)
            print("Waiting for revert (2.5s)...")
            time.sleep(2.5)

            # Verify revert state
            text_reverted = copy_btn.text_content()
            label_reverted = copy_btn.get_attribute("aria-label")
            print(f"Reverted text: '{text_reverted}', label: '{label_reverted}'")

            assert "📋" in text_reverted, f"Expected 📋, got {text_reverted}"
            assert label_reverted == "Copy note to clipboard", f"Expected 'Copy note to clipboard', got '{label_reverted}'"
            print("Verification PASSED: Button reverted to clipboard icon and label.")

            # Take screenshot of reverted state
            page.screenshot(path="verification/reverted_state.png")
            print("Screenshot 'reverted_state.png' taken.")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_copy_feedback()
