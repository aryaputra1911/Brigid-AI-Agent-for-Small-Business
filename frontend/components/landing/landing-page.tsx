import Image from "next/image";
import Link from "next/link";
import { AmbientVideoBg } from "./ambient-video-bg";
import { CornerButton } from "./corner-button";
import { FooterLauncher } from "./footer-launcher";
import { LandingHeader } from "./landing-interactions";
import { RreAccordions } from "./rre-accordions";
import { RreScenarioSlider } from "./rre-scenario-slider";
import "./landing.css";

const guardrails = [
  {
    kicker: "01 / TOOL BOUNDARY",
    title: "Narrow tool surface",
    detail:
      "The assistant has ten read, calculate, and proposal tools. None can execute a payment, confirm a request, or change a role.",
  },
  {
    kicker: "02 / POLICY ENGINE",
    title: "Deterministic policy guard",
    detail:
      "Every proposed payment is checked against fixed mandate rules, cash buffer limits, duplicate checks, and registered supplier accounts.",
  },
  {
    kicker: "03 / HUMAN CONTROL",
    title: "Out-of-band owner approval",
    detail:
      "Requests above the threshold wait in Approvals with a one-time confirmation token that never passes through the language model.",
  },
];

const capabilityLinks = [
  { label: "RECONCILIATION", href: "/chat" },
  { label: "CASH FORECASTING", href: "/chat" },
  { label: "INVOICE REVIEW", href: "/chat" },
  { label: "RECOMMENDATIONS", href: "/chat" },
  { label: "MANDATE DRAFTING", href: "/mandate" },
  { label: "OWNER APPROVALS", href: "/approvals" },
  { label: "POLICY CHECKS", href: "/mandate" },
  { label: "SYNTHETIC LEDGER", href: "/chat" },
];

const workspaceRows = [
  {
    title: "Interactive Chat Workspace & Ledger Walkthrough",
    tag: "CHAT",
    href: "/chat",
    hasPreview: true,
  },
  {
    title: "Review Pending Payment Requests & Risk Warnings",
    tag: "APPROVALS",
    href: "/approvals",
    hasPreview: false,
  },
  {
    title: "Draft Spending Rules & Owner-Reviewed Mandates",
    tag: "MANDATE",
    href: "/mandate",
    hasPreview: false,
  },
  {
    title: "Explore Synthetic Business Data Without Financial Risk",
    tag: "SIMULATION",
    href: "/chat",
    hasPreview: false,
  },
];

export function LandingPage() {
  return (
    <div className="rre-landing" id="top">
      <a className="rre-skip" href="#landing-main">
        Skip to content
      </a>

      <AmbientVideoBg />
      <LandingHeader />

      <main id="landing-main" className="rre-main" tabIndex={-1}>
        {/* Section 1: Hero */}
        <section className="rre-hero" aria-labelledby="landing-title">
          <div className="rre-hero__grid">
            <h1 id="landing-title" className="rre-hero__title">
              Clearer finances.
              <br />
              Protected by rules.
            </h1>

            <div className="rre-hero__copy">
              <p>
                Running a business means tracking every bank entry, supplier
                invoice, and cash forecast. Raising questions in plain language
                is only the start. What matters most is keeping control over
                every payment.
              </p>
              <p>
                Brigid pairs conversational ledger analysis with deterministic
                mandate rules and out-of-band owner approvals, running locally
                on synthetic business data so you can inspect every step safely.
              </p>
              <div className="rre-hero__actions">
                <CornerButton href="/chat" variant="light">
                  OPEN WORKSPACE
                </CornerButton>
                <CornerButton href="/approvals" variant="light">
                  REVIEW APPROVALS
                </CornerButton>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Ice-Blue Guardrails Panel */}
        <div className="rre-gutter-wrap">
          <section
            id="guardrails"
            className="rre-ice-panel"
            aria-labelledby="guardrails-heading"
          >
            <div className="rre-ice-panel__split">
              <div className="rre-ice-panel__left">
                <h2 id="guardrails-heading" className="rre-h2">
                  The confidence to
                  <br />
                  delegate safely
                </h2>
                <p className="rre-ice-panel__desc">
                  Every proposal goes through fixed policy checks before it ever
                  reaches your approval queue.
                </p>
                <CornerButton href="/approvals" variant="dark">
                  REVIEW APPROVALS
                </CornerButton>
              </div>

              <div className="rre-guardrails">
                {guardrails.map((item) => (
                  <div key={item.kicker} className="rre-guardrail-row">
                    <p className="rre-guardrail-row__kicker">{item.kicker}</p>
                    <h3 className="rre-guardrail-row__title">{item.title}</h3>
                    <p className="rre-guardrail-row__detail">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 3: Capabilities Hairline Grid */}
          <section
            id="workflows"
            className="rre-grid-section"
            aria-labelledby="workflows-heading"
          >
            <div className="rre-grid-section__split">
              <div className="rre-grid-section__left">
                <h2 id="workflows-heading" className="rre-h2">
                  Finance workflows
                </h2>
                <p className="rre-grid-section__desc">
                  Explore reconciliation, cash-flow forecasting, invoice review,
                  and owner-confirmed mandates in one local simulation.
                </p>
              </div>

              <div className="rre-areas-grid">
                {capabilityLinks.map((cell) => (
                  <Link
                    key={cell.label}
                    href={cell.href}
                    className="rre-area-cell"
                  >
                    {cell.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Section 4: Ice-Blue Accordions */}
          <section
            className="rre-ice-panel"
            aria-labelledby="difference-heading"
          >
            <div className="rre-ice-panel__split">
              <div className="rre-ice-panel__left">
                <h2 id="difference-heading" className="rre-h2">
                  How Brigid works.
                  <br />
                  Step by step.
                </h2>
                <p className="rre-ice-panel__desc">
                  Conversation handles analysis and drafting. Policy rules and
                  human owners handle every final decision.
                </p>
                <CornerButton href="/mandate" variant="dark">
                  DRAFT A MANDATE
                </CornerButton>
              </div>

              <RreAccordions />
            </div>
          </section>

          {/* Section 5: Interactive Scenario Slider */}
          <section
            className="rre-slider-section"
            aria-label="Workspace prompt scenarios"
          >
            <RreScenarioSlider />
          </section>

          {/* Section 6: Solid Obsidian Workspace Routes */}
          <section
            className="rre-latest-section"
            aria-labelledby="workspace-heading"
          >
            <div className="rre-latest-header">
              <h2 id="workspace-heading" className="rre-h2">
                Inside the workspace
              </h2>
              <CornerButton href="/chat" variant="light">
                OPEN CHAT
              </CornerButton>
            </div>

            <div className="rre-latest-list">
              {workspaceRows.map((row) => (
                <Link
                  key={row.title}
                  href={row.href}
                  className="rre-latest-row"
                >
                  {row.hasPreview ? (
                    <Image
                      src="/media/brigid-demo.webp"
                      alt="Brigid workspace preview"
                      width={112}
                      height={68}
                      className="rre-latest-row__thumb"
                    />
                  ) : (
                    <span className="rre-latest-row__badge">{row.tag}</span>
                  )}
                  <span className="rre-latest-row__title">{row.title}</span>
                  <span className="rre-latest-row__tag">{row.tag}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Section 7: Footer with geometric cutout video window */}
      <footer className="rre-footer" role="contentinfo">
        <div className="rre-footer__top">
          <div>
            <nav className="rre-footer__nav" aria-label="Footer primary links">
              <Link href="#top" className="rre-footer__big-link">
                Home
              </Link>
              <Link href="/chat" className="rre-footer__big-link">
                Chat
              </Link>
              <Link href="/approvals" className="rre-footer__big-link">
                Approvals
              </Link>
              <Link href="/mandate" className="rre-footer__big-link">
                Mandate
              </Link>
            </nav>

            <div className="rre-footer__sublinks">
              <a href="#guardrails" className="rre-footer__sublink">
                GUARDRAILS
              </a>
              <a href="#workflows" className="rre-footer__sublink">
                WORKFLOWS
              </a>
            </div>
          </div>

          <div>
            <div className="rre-footer__cutout" aria-hidden="true">
              <video
                className="rre-footer__cutout-video"
                width={640}
                height={260}
                poster="/media/brigid-demo.webp"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
              >
                <source src="/media/brigid-demo.mp4" type="video/mp4" />
              </video>
              <div className="rre-footer__cutout-bars">
                <div className="rre-cutout-bar-v" />
                <div className="rre-cutout-bar-h" />
              </div>
            </div>

            <FooterLauncher />
          </div>
        </div>

        <div className="rre-footer__bottom">
          <p className="rre-footer__meta">BRIGID FINANCE WORKSPACE</p>
          <p className="rre-footer__meta">LOCAL SIMULATION MODE</p>
          <p className="rre-footer__meta">SYNTHETIC BUSINESS DATA ONLY</p>
          <div className="rre-footer__bottom-actions">
            <CornerButton href="/chat" variant="light">
              OPEN CHAT
            </CornerButton>
            <CornerButton href="/approvals" variant="light">
              APPROVALS
            </CornerButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
