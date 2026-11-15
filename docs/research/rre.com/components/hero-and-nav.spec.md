# Hero, Ambient Video & Header Specification

## Overview
- **Target files:** `frontend/components/landing/ambient-video-bg.tsx`, `frontend/components/landing/landing-interactions.tsx`, `frontend/components/landing/corner-button.tsx`
- **Screenshot:** `docs/design-references/rre.com/desktop-1440-hero.png`
- **Interaction model:** Scroll-driven header backdrop + click-driven video pause/play & mobile menu drawer

## Computed Styles (from rre.com)
- **Hero Section:** `padding: 128px 80px`, `min-height: 620px`, `display: flex`, `align-items: flex-end`, `color: rgb(255, 255, 255)`
- **H1:** `fontSize: 80px` (`clamp(2.625rem, 5.5vw, 5rem)`), `lineHeight: 88px` (`1.08`), `letterSpacing: -0.045em`, `fontWeight: 400`, `maxWidth: 580px`
- **Body copy:** `fontSize: 20px` (`clamp(1.0625rem, 1.3vw, 1.25rem)`), `lineHeight: 28px` (`1.45`), `color: rgba(255, 255, 255, 0.92)`
- **Nav links:** `fontSize: 15px`, `lineHeight: 21px`, `letterSpacing: 0.04em`, `textTransform: uppercase`, `color: rgb(255, 255, 255)`
- **CornerButton:** `height: 45px` (min `44px`), `padding: 12px 18px`, `fontSize: 15px`, `textTransform: uppercase`, 4 SVG/CSS corner bracket ticks (`8px × 8px`)

## Assets
- Background `<video>`: `/media/brigid-demo.mp4` (`poster="/media/brigid-demo.webp"`, `width={1920}`, `height={1080}`)
- Brand mark: `/brand/brigid.svg`

## Responsive Behavior
- **Desktop (>= 1024px):** 2-column hero split (`1fr 1fr`), inline desktop nav links (`CHAT`, `APPROVALS`, `MANDATE`).
- **Tablet (640px – 1023px):** `padding: 112px 40px 80px`, 2-column or stacked hero depending on width.
- **Mobile (< 640px):** `padding: 104px 20px 64px`, single-column stack, labeled `"Menu"` button (`>= 44x44px`) opens full-screen drawer.
