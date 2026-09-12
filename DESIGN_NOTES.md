# Aurikrex Bytes design and responsive audit notes

## Auth and newsroom surfaces (F12)

The 50/50 reader-auth and newsroom-auth split layouts are intentional: they create a focused transition into account and editorial workflows while the public site retains its centered editorial grid. Both surfaces inherit the light default theme from `App.tsx`; users may switch theme explicitly. This distinction is a product design decision, not an accidental divergence.

## Responsive overflow audit (F11)

The layout was reviewed at 320, 360, 375, 390, 768, 820, and 1280px widths against long headlines, long email addresses, large images, open menus, admin tabs, and the install toast. Global horizontal clipping is not used to hide defects. Intentional horizontal regions (admin tabs, analytics bars, and tables) own their scrolling, while cards and copy use flexible widths and overflow wrapping.

## Legal review

The privacy policy and terms now include structural controller, address, date, jurisdiction, and provider-policy details. Formal legal review is still required before launch.
