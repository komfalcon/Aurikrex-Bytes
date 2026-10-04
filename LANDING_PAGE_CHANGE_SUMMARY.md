# Aurikrex Bytes landing-page repair

## What changed

- Replaced the conflicting landing-page CSS tail with one mobile-first layout system.
- Balanced the desktop hero into a readable editorial copy column plus a meaningful story preview.
- Kept the hero preview visible at tablet widths instead of hiding it below 960px.
- Made feature pillars responsive: four columns on desktop, two on tablet, one full-width card on phone.
- Rebuilt the sample-story section as a copy + preview composition on desktop and a stacked layout on smaller screens.
- Made the comparison section show both columns on desktop/tablet and exactly one active panel on phones.
- Added accessible tab/panel semantics to the comparison toggle.
- Removed the landing-page overflow mask and the shared global overflow clipping rules.
- Made hero trust badges independent wrapping items so separators cannot land at the start or end of a line.
- Made the floating mobile CTA safe-area aware, reserved bottom space for it, gave it a 44px dismiss target, and added immediate dismissal behavior.
- Suppressed broken story-image alt-text artifacts while preserving the image aspect-ratio surface.
- Added `client/public/manus-routes.json` for the complete application route set.

## Responsive decisions

| Range | Decision |
|---|---|
| `>= 1101px` | Two-column hero, four feature cards, two comparison columns, desktop sample-story split. |
| `761–1100px` | Balanced two-column hero until `960px`; two feature-card columns. |
| `<= 960px` | Hero preview stacks below the copy but remains visible; sample story stacks below the copy. |
| `<= 760px` | Full-width single-column cards, one comparison panel at a time, mobile comparison toggle and fixed CTA. |
| `<= 480px` | Stacked hero actions, independent trust-badge rows, tighter phone gutters and CTA sizing. |

## Validation

- `pnpm check` — passed.
- `pnpm build` — passed. Vite emitted the existing large-chunk warning; no build failure.
- `pnpm test -- --runInBand` — passed: 13 files, 46 tests.
- Browser overflow sweep — passed at `320, 360, 375, 390, 430, 640, 768, 960, 1024, 1280px`; every viewport reported `document.documentElement.scrollWidth === window.innerWidth`.
- Mobile comparison interaction — passed; clicking Social Feeds leaves exactly one visible comparison panel.
- Floating CTA interaction — passed; it appears after scroll with a 12px bottom safe-area gap and dismisses immediately.

## Screenshots

- Before: `artifacts/landing-before-375.png`, `artifacts/landing-before-768.png`, `artifacts/landing-before-1280.png`
- After: `artifacts/landing-after-375.png`, `artifacts/landing-after-768.png`, `artifacts/landing-after-1280.png`
