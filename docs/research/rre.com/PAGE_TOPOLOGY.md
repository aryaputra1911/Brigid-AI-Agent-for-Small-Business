# RRE.com Page Topology & Brigid Antislop Adaptation

Target URL: `https://rre.com/?ref=lapaninja`
Total desktop height (1440px): `4842px`
Antislop Mode: `DURING` (ENERGY 3 / RHYTHM 3 / MOTION 2)

## Visual & Structural Architecture

1. **Fixed Full-Viewport Background (`z-index: 0`)**
   - `rre.com`: Full-bleed fluid ink texture behind the entire upper page; left `80px` gutter remains transparent across Sections 1–5 so the backdrop flows continuously down the left edge.
   - **Brigid adaptation**: Fixed `<video>` (`/media/brigid-demo.mp4`, derived from `13820343_3840_2160_30fps-compressed.mp4`) with `poster="/media/brigid-demo.webp"`, dark scrim (`rgba(7, 2, 10, 0.56)`), `prefers-reduced-motion: reduce` fallback to static `.webp`, and a keyboard-accessible Pause/Play control (R-39).

2. **Section 0: Fixed Header (`z-index: 40`)**
   - `rre.com`: Brand mark left, uppercase `15px` nav links right (`PORTFOLIO`, `TEAM`). Gains subtle frosted backdrop on scroll.
   - **Brigid adaptation**: Brigid logo + wordmark left, real routes right (`CHAT`, `APPROVALS`, `MANDATE` -> `/chat`, `/approvals`, `/mandate` per R-24). Mobile collapses to a labeled `"Menu"` button (`>= 44x44px` target) opening a full-height accessible drawer with Escape and focus return (R-03, R-32).

3. **Section 1: Hero (`section_home-hero`)**
   - `rre.com`: `128px 80px` padding, `min-height: 620px`, 2-column split: left `<h1>` (`80px / 88px`, `-4px` tracking), right two editorial paragraphs (`20px / 28px`).
   - **Brigid adaptation**: `clamp(2.5rem, 5.5vw, 5rem)` `<h1>`, two crisp paragraphs with zero em dashes (R-02) and zero buzzwords (R-16), plus a corner-bracket CTA (`OPEN WORKSPACE` -> `/chat`, R-15).

4. **Section 2: Ice-Blue Guardrails Panel (`#D3E7F1` surface, `#07020A` ink)**
   - `rre.com`: `padding-left: 80px` (revealing left video gutter), `background-color: rgb(211, 231, 241)`, left column `<h2>` + paragraph + corner-bracket CTA; right column 3 stacked rows separated by `1px` dark hairlines.
   - **Brigid adaptation**: Preserves exact `#D3E7F1` surface and 3-row hairline structure, replacing VC stats (`$2.5B+`, `125+`, `400+`) with Brigid's 3 real architectural guardrails (`01 Narrow tool surface`, `02 Deterministic policy guard`, `03 Owner-confirmed approvals`) to satisfy R-17 and R-36.

5. **Section 3: Capabilities Hairline Grid (Transparent over video)**
   - `rre.com`: `padding-left: 80px`, `border-left: 1px solid rgba(255,255,255,0.35)`, left `<h2>` + intro, right 2-column × 5-row hairline-bordered grid of sectors.
   - **Brigid adaptation**: 2-column × 4-row hairline grid of Brigid's real capabilities (`RECONCILIATION`, `CASH FORECASTING`, `INVOICE REVIEW`, `RECOMMENDATIONS`, `MANDATE DRAFTING`, `OWNER APPROVALS`, `POLICY CHECKS`, `SYNTHETIC LEDGER`) linking to real routes (`/chat`, `/mandate`, `/approvals`).

6. **Section 4: Depth / Workflow Accordions (`#D3E7F1` surface, `#07020A` ink)**
   - `rre.com`: `padding-left: 80px`, left `<h2>` + paragraph + corner-bracket CTA, right 4 expandable accordion rows with `+` indicator.
   - **Brigid adaptation**: 4 keyboard-accessible `<button aria-expanded>` accordions explaining how Brigid works (`Start in Chat`, `Policy Guardrails`, `Owner-Reviewed Mandates`, `Out-of-Band Approvals`).

7. **Section 5: Interactive Scenario Slider (Transparent over video)**
   - `rre.com`: `padding-left: 80px`, `border-left: 1px solid rgba(255,255,255,0.35)`, left corner-bracket `< >` slider controls, right large `36px` quote block + attribution.
   - **Brigid adaptation**: Replaces external/unverified testimonials (forbidden by R-18) with 4 interactive Brigid example prompt scenarios users can cycle through with `< >` buttons and launch directly in `/chat`.

8. **Section 6: Workspace Routes & Live Preview (`#07020A` obsidian surface)**
   - `rre.com`: `padding-left: 80px`, solid `rgb(7, 2, 10)`, `<h2>`, full-width hairline-separated rows with thumbnail/preview, title, and category label on the right.
   - **Brigid adaptation**: Displays Brigid's real workspace modules (`Chat Workspace`, `Approval Queue`, `Mandate Rules`, `Walkthrough Preview` with `/media/brigid-demo.webp`) linking to `/chat`, `/approvals`, `/mandate`.

9. **Section 7: Footer (`#07020A` obsidian with cutout video window)**
   - `rre.com`: Left large navigation links + secondary links; right geometric cutout revealing the fixed background + email subscribe bar + bottom info & corner-bracket login buttons.
   - **Brigid adaptation**: Left navigation to real routes (`Home`, `Chat`, `Approvals`, `Mandate`); right geometric Brigid cutout window revealing the live background video + interactive prompt launcher form (navigates to `/chat` with validation feedback, R-26) + bottom local simulation notice & corner-bracket links (`OPEN CHAT`, `REVIEW APPROVALS`).
