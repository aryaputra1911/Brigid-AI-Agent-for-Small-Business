# Accordions & Interactive Scenario Slider Specification

## Overview
- **Target files:** `frontend/components/landing/rre-accordions.tsx`, `frontend/components/landing/rre-scenario-slider.tsx`
- **Screenshot:** `docs/design-references/rre.com/desktop-1440-sec2-3.png`, `docs/design-references/rre.com/desktop-1440-sec4.png`
- **Interaction model:** Click-driven accordion & click-driven carousel

## Computed Styles (from rre.com)
- **Accordions container:** Inside `#D3E7F1` panel, right column, 4 rows separated by `1px solid rgba(7, 2, 10, 0.25)`
- **Accordion trigger (`<button>`):** `width: 100%`, `min-height: 64px`, `padding: 20px 0`, `display: flex`, `justify-content: space-between`, `align-items: center`, `fontSize: 22px`, `color: rgb(7, 2, 10)`, `cursor: pointer`
- **Scenario Slider section:** Transparent over video, `paddingLeft: 80px`, `borderLeft: 1px solid rgba(255, 255, 255, 0.35)`, `padding: 112px 80px`
- **Slider controls:** Corner-bracket `<` and `>` `<button>`s (`48px × 48px`, `>= 44px` tap target) on the left column
- **Scenario quote/prompt text:** `fontSize: clamp(1.5rem, 2.5vw, 2.25rem)`, `lineHeight: 1.25`, `letterSpacing: -0.02em`, `color: rgb(255, 255, 255)`

## States & Behaviors
- Accordion: `aria-expanded` toggles `false <-> true`; panel reveals smoothly; `+` icon rotates `45deg` or switches to `−`.
- Scenario Slider: Previous/Next buttons cycle 4 real Brigid financial workflow scenarios, updating active index and slide content immediately with keyboard support.
