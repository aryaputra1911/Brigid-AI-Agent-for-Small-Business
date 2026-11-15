# Ice-Blue Guardrails Panel & Capabilities Hairline Grid Specification

## Overview
- **Target files:** `frontend/components/landing/landing-page.tsx`, `frontend/components/landing/landing.css`
- **Screenshot:** `docs/design-references/rre.com/desktop-1440-sec1.png`, `docs/design-references/rre.com/desktop-1440-sec2-3.png`
- **Interaction model:** Static / hover-driven grid links

## Computed Styles (from rre.com)
- **Left gutter wrapper:** `paddingLeft: 80px` on desktop (`40px` tablet, `0px` mobile)
- **Ice-Blue Panel (`.rre-ice-panel`):** `backgroundColor: rgb(211, 231, 241)` (`#D3E7F1`), `color: rgb(7, 2, 10)` (`#07020A`), `padding: 88px 80px`
- **H2:** `fontSize: 56px` (`clamp(2rem, 3.8vw, 3.5rem)`), `lineHeight: 1.04`, `letterSpacing: -0.035em`, `fontWeight: 400`
- **Right 3-row stack:** `borderTop: 1px solid rgba(7, 2, 10, 0.25)`, each row `padding: 32px 0`, `borderBottom: 1px solid rgba(7, 2, 10, 0.25)`
- **Capabilities Grid (`.rre-grid-section`):** Transparent over video, `borderLeft: 1px solid rgba(255, 255, 255, 0.35)`, 2-column grid cells (`padding: 24px 32px`, `border: 1px solid rgba(255, 255, 255, 0.28)`, `fontSize: 15px`, `textTransform: uppercase`)

## Hover States
- Grid cells: `background-color` `transparent` -> `rgba(255, 255, 255, 0.1)`, `transition: background-color 0.25s ease`

## Responsive Behavior
- **Desktop (>= 1024px):** `80px` left gutter, 2-column split (`1fr 1fr`).
- **Tablet (640px – 1023px):** `40px` left gutter, 2-column split or stacked below `900px`.
- **Mobile (< 640px):** `0px` left gutter, `padding: 56px 20px`, single-column stack, grid cells `>= 44px` height.
