import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


FONT_ROOT = Path(__file__).resolve().parent.parent / 'node_modules' / 'lxgw-wenkai-screen-webfont'
FONT_CDN = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/'


def serve_font(route):
    relative = route.request.url.removeprefix(FONT_CDN)
    content_type = 'text/css' if relative.endswith('.css') else 'font/woff2'
    route.fulfill(path=FONT_ROOT / relative, content_type=content_type,
                  headers={'Access-Control-Allow-Origin': '*'})


FIT = """() => {
    const layout = document.querySelector('.layout');
    const copy = document.querySelector('.copy');
    const heading = copy.querySelector('h1');
    const text = copy.querySelector('.text');
    const kicker = copy.querySelector('.kicker');
    const cover = Boolean(kicker);
    const sizes = [heading, text, kicker].filter(Boolean).map(element => ({
        element,
        size: parseFloat(getComputedStyle(element).fontSize)
    }));
    const minimums = cover ? [110, 40, 25] : [52, 40];
    for (let step = 0; step <= 50; step++) {
        sizes.forEach(({ element, size }, index) => {
            element.style.fontSize = Math.max(minimums[index], size - step * 2) + 'px';
        });
        const bounds = layout.getBoundingClientRect();
        const rect = copy.getBoundingClientRect();
        if (rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5 &&
            rect.left >= bounds.left && rect.right <= bounds.right &&
            copy.scrollWidth <= copy.clientWidth) return true;
    }
    return false;
}"""


def main():
    output = Path(sys.argv[1])
    pages = json.loads((output / 'pages.json').read_text(encoding='utf-8'))
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1080, "height": 1440}, device_scale_factor=1)
        page.route(FONT_CDN + '**', serve_font)
        for index, html in enumerate(pages, 1):
            page.set_content(html)
            page.evaluate("document.fonts.ready")
            if not page.evaluate("""() => {
                const text = document.querySelector('.text').textContent;
                const faces = [...document.fonts].filter(face => face.status === 'loaded');
                return faces.length > 0 && document.fonts.check('40px "LXGW WenKai Screen R"', text);
            }"""):
                raise ValueError(f"第 {index} 张卡片未加载霞鹜文楷")
            if not page.evaluate(FIT):
                raise ValueError(f"第 {index} 张卡片缩至最小字号仍溢出，请缩短文案")
            page.screenshot(path=output / f"{index:02d}.png")
        browser.close()


if __name__ == "__main__":
    main()
