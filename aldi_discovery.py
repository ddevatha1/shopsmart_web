import asyncio
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright


OUTPUT_DIR = Path("aldi_responses")
OUTPUT_DIR.mkdir(exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False
        )

        page = await browser.new_page()

        captured = []

        async def handle_response(response):
            url = response.url

            # Look for API-like requests
            keywords = [
                "api",
                "graphql",
                "search",
                "product",
                "catalog",
                "inventory"
            ]

            if not any(k in url.lower() for k in keywords):
                return

            try:
                content_type = response.headers.get(
                    "content-type",
                    ""
                )

                if "json" not in content_type.lower():
                    return

                data = await response.json()

                text = json.dumps(data).lower()

                if any(
                    word in text
                    for word in [
                        "price",
                        "product",
                        "sku",
                        "upc",
                        "inventory"
                    ]
                ):
                    print("\n==============================")
                    print("POSSIBLE PRODUCT API")
                    print(url)
                    print("==============================")

                    filename = (
                        OUTPUT_DIR /
                        f"response_{int(time.time()*1000)}.json"
                    )

                    filename.write_text(
                        json.dumps(
                            data,
                            indent=2
                        )
                    )

                    print(
                        f"Saved: {filename}"
                    )

                    captured.append({
                        "url": url,
                        "data": data
                    })

            except Exception:
                pass


        page.on(
            "response",
            handle_response
        )


        await page.goto(
            "https://www.aldi.us/",
            wait_until="networkidle",
            timeout=60000
        )


        print("\nBrowser opened.")
        print("Search manually for:")
        print("eggs")
        print()
        print("Waiting for network capture...")


        await page.wait_for_timeout(
            120000
        )


        print(
            f"\nCaptured {len(captured)} possible APIs"
        )


        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())