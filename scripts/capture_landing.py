from pathlib import Path
from time import sleep
from playwright.sync_api import sync_playwright

ROOT = Path('/home/ubuntu/aurikrex-bytes')
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
WIDTHS = (375, 768, 1280)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for label, base_url in (('before', 'http://127.0.0.1:3001'), ('after', 'http://127.0.0.1:3000')):
        for width in WIDTHS:
            page = browser.new_page(viewport={'width': width, 'height': 900}, device_scale_factor=1)
            page.goto(f'{base_url}/', wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(2200)
            measurement = page.evaluate('''() => ({
                viewport: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                overflow: document.documentElement.scrollWidth > window.innerWidth,
                heroPreviewVisible: (() => {
                    const el = document.querySelector('.hero-side-showcase');
                    return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
                })(),
                comparisonPanels: [...document.querySelectorAll('.comparison-col')].map(el => ({
                    hidden: getComputedStyle(el).display === 'none',
                    ariaHidden: el.getAttribute('aria-hidden')
                })),
                headerWidth: document.querySelector('.site-header')?.getBoundingClientRect().width ?? null,
                ctaRendered: !!document.querySelector('.floating-mobile-cta')
            })''')
            print(f'{label} {width}px {measurement}')
            page.screenshot(path=str(ARTIFACTS / f'landing-{label}-{width}.png'), full_page=True)
            page.close()
    browser.close()
