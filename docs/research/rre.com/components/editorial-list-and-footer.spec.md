# Workspace List & Cutout Footer Specification

## Overview
- **Target files:** `frontend/components/landing/landing-page.tsx`, `frontend/components/landing/footer-launcher.tsx`
- **Screenshot:** `docs/design-references/rre.com/desktop-1440-sec5.png`, `docs/design-references/rre.com/desktop-1440-footer.png`
- **Interaction model:** Hover-driven list rows + interactive form submission

## Computed Styles (from rre.com)
- **Workspace List section (`.rre-latest-section`):** `backgroundColor: rgb(7, 2, 10)` (`#07020A`), `marginLeft: 80px` on desktop, `padding: 112px 80px`
- **Rows:** `borderTop: 1px solid rgba(255, 255, 255, 0.22)`, `display: grid`, `gridTemplateColumns: 92px 1fr auto`, `align-items: center`, `gap: 32px`, `padding: 20px 0`
- **Footer (`.rre-footer`):** `backgroundColor: rgb(7, 2, 10)`, `color: rgb(255, 255, 255)`, `padding: 112px 80px 64px`
- **Cutout Video Window:** Geometric Brigid frame revealing the fixed ambient video behind the dark footer (`aspect-ratio: 16 / 7`, `border: 1px solid rgba(255, 255, 255, 0.16)`)
- **Form bar:** `border: 1px solid rgba(255, 255, 255, 0.35)`, input left, corner-bracket `OPEN IN CHAT` submit button right (`>= 44px` height)

## Assets
- `/media/brigid-demo.webp` preview thumbnail in the Workspace List section (`width={92}`, `height={64}`)

## Responsive Behavior
- **Desktop (>= 1024px):** `marginLeft: 80px` on list section, 2-column footer upper layout, 4-column bottom bar.
- **Mobile (< 640px):** `marginLeft: 0`, `padding: 64px 20px`, list row stacks thumbnail/title/tag cleanly, footer stacks vertically with `>= 44px` tap targets.
