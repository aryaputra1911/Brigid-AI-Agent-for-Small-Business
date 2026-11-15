# RRE.com Interaction & Behavior Bible

## Scroll & Viewport Behaviors
- **Header scroll state**: Fixed top header (`z-index: 40`). At `scrollY === 0`, transparent background. Past `scrollY > 40`, transitions (`0.25s ease`) to `rgba(7, 2, 10, 0.78)` with `backdrop-filter: blur(12px)` and `1px solid rgba(255, 255, 255, 0.12)` bottom border.
- **Fixed ambient backdrop**: Stays pinned to viewport (`position: fixed; inset: 0`). Left `80px` gutter on desktop (`>= 1024px`) exposes the backdrop beside `#D3E7F1` and `#07020A` sections.
- **No scroll-jacking**: `rre.com` uses native browser scrolling (`hasLenis: false`).

## Click-Driven Interactions
- **Accordions (Section 4)**: Click-to-toggle each row (`aria-expanded`), rotating `+` into `−` (or `45deg` close) and smoothly revealing the detail panel. Keyboard operable via `<button>` (`Enter` / `Space`).
- **Scenario Slider (Section 5)**: Click `<` and `>` corner-bracket buttons (`aria-label="Previous scenario"` / `"Next scenario"`) to cycle through slides with smooth opacity/translate transition and live slide counter (`01 / 04`).
- **Mobile Navigation Drawer**: Click `"Menu"` button (`>= 44x44px`) to open full-screen obsidian overlay menu; `Escape` or close button dismisses and returns focus to trigger.
- **Background Video Control**: Click Pause/Play toggle (`>= 44x44px`) to pause or resume `/media/brigid-demo.mp4` (R-39).
- **Footer Quick-Launch Form**: Submitting an empty input shows inline validation message; submitting a prompt navigates to `/chat` (R-26).

## Hover States
- **Nav links & footer links**: Opacity `0.78 -> 1` and subtle underline/color shift (`transition: color 0.2s, opacity 0.2s`).
- **Corner-bracket buttons**: Background transitions from transparent to subtle tint (`rgba(255,255,255,0.08)` on dark, `rgba(7,2,10,0.06)` on ice-blue) and corner ticks expand slightly (`2px`, `transition: 0.25s ease`).
- **Grid cells (Section 3)**: `background-color` shifts from `transparent` to `rgba(255, 255, 255, 0.08)` over `0.3s`.
- **Editorial rows (Section 6)**: Subtle horizontal nudge (`translateX(6px)`) on title and background highlight `rgba(255, 255, 255, 0.04)` over `0.25s`.

## Responsive Breakpoints
- **Desktop (`>= 1024px`)**: `80px` left gutter (`padding-left: 80px`), 2-column splits (`1fr 1fr` or `5fr 7fr`), `80px` `h1`, `56px` `h2`.
- **Tablet (`640px – 1023px`)**: `40px` left gutter (`padding-left: 40px`), 2-column grid collapses cleanly where needed, `h1` scales fluidly via `clamp()`, mobile menu trigger active below `768px`.
- **Mobile (`< 640px`)**: `0px` left gutter (full-width sections with `20px` horizontal padding), single-column stacking, `2-col` capability grid becomes `1-col` or `2-col` compact without overflow, `>= 44x44px` tap targets everywhere, zero horizontal overflow (`overflow-x: clip`).
