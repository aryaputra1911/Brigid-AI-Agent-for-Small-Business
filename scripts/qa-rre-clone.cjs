const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.resolve(root, "docs/design-references/rre.com");

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Server timed out");
}

async function main() {
  const server = spawn("npx", ["next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
    cwd: path.resolve(root, "frontend"),
    stdio: "ignore",
  });

  try {
    await waitForServer("http://127.0.0.1:3100/");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });

    // Desktop screenshots
    await page.screenshot({ path: path.join(outDir, "clone-1440-hero.png") });
    await page.screenshot({ path: path.join(outDir, "clone-1440-full.png"), fullPage: true });

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    // Click-through checks on desktop
    // 1. Accordion toggle
    const accBtn = page.getByRole("button", { name: "Deterministic policy guard" });
    await accBtn.click();
    const accExpanded = await accBtn.getAttribute("aria-expanded");

    // 2. Scenario slider next
    const nextBtn = page.getByRole("button", { name: "Next workflow scenario" });
    await nextBtn.click();
    const counterText = await page.locator(".rre-slider__counter").textContent();

    // 3. Video pause/play control
    const videoBtn = page.locator(".rre-video-control");
    const pressedBefore = await videoBtn.getAttribute("aria-pressed");
    await videoBtn.click();
    const pressedAfter = await videoBtn.getAttribute("aria-pressed");

    // 4. Footer empty form validation
    await page.getByRole("button", { name: "OPEN CHAT" }).click();
    const formError = await page.locator(".rre-footer-form__error").textContent();

    // Tablet 768px overflow check
    await page.setViewportSize({ width: 768, height: 1024 });
    const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    // Mobile 390px overflow + screenshot + drawer check
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await page.screenshot({ path: path.join(outDir, "clone-390-full.png"), fullPage: true });

    const menuBtn = page.getByRole("button", { name: "Menu" });
    await menuBtn.click();
    const drawerVisible = await page.getByRole("dialog", { name: "Site navigation" }).isVisible();
    await page.keyboard.press("Escape");
    const drawerAfterEsc = await page.getByRole("dialog", { name: "Site navigation" }).count();

    console.log(JSON.stringify({
      errors,
      desktopOverflow,
      tabletOverflow,
      mobileOverflow,
      accExpanded,
      counterText: counterText?.trim(),
      videoToggle: `${pressedBefore} -> ${pressedAfter}`,
      formError: formError?.trim(),
      drawerVisible,
      drawerClosedOnEscape: drawerAfterEsc === 0,
    }, null, 2));

    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
