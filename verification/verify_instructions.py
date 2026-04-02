import asyncio
import os
from playwright.async_api import async_playwright

async def verify_customization():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        file_path = f"file://{os.getcwd()}/babylog.html"
        await page.goto(file_path)
        await page.click("#customize-events-button")
        await page.wait_for_selector("#settings-modal.active")
        await page.screenshot(path="verification/verification.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_customization())
