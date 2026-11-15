const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    // Some machines have no Chrome channel; Playwright's bundled chromium behaves the same.
    return await chromium.launch({ headless: true });
  }
}

async function main() {
  const origin = process.env.BRIGID_TEST_ORIGIN || "http://127.0.0.1:3000";
  const output = path.resolve(__dirname, "../test-results");
  await fs.mkdir(output, { recursive: true });
  const browser = await launchBrowser();
  const checks = [];
  const check = (name) => {
    checks.push(name);
    console.log(`PASS ${name}`);
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.setDefaultNavigationTimeout(120_000);
    const consoleErrors = [];
    const pageErrors = [];
    const calls = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/brigid/**", (route) => {
      const action = new URL(route.request().url()).pathname.split("/").at(-1);
      calls.push(action);
      assert(["info", "pending"].includes(action), `Unexpected API ${action}`);
      return route.fulfill({
        json:
          action === "info"
            ? {
                roles: ["owner", "bookkeeper", "staff"],
                simulation: "Test simulation",
                screening_model: false,
              }
            : { requests: [] },
      });
    });

    const response = await page.goto(origin);
    assert.equal(response.status(), 200);
    assert.equal(new URL(page.url()).pathname, "/");
    assert.match(
      await page.locator("h1").innerText(),
      /Clearer finances\.\s*Protected by rules\./,
    );
    assert.match(await page.title(), /Brigid/);
    assert.equal(await page.locator(".paper-shell").count(), 0);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Skip to content",
    );
    await page.keyboard.press("Enter");
    assert(
      await page
        .locator("#landing-main")
        .evaluate((el) => el === document.activeElement),
    );
    check("Hero copy, metadata, skip link and main focus target");

    const videoControl = page.locator(".rre-video-control");
    assert(await videoControl.isVisible());
    const box = await videoControl.boundingBox();
    assert(box.height >= 44 && box.width >= 44, `video control ${box.width}x${box.height}`);
    assert.equal(await videoControl.getAttribute("aria-pressed"), "true");
    assert.match(
      await videoControl.getAttribute("aria-label"),
      /Pause background video/,
    );
    await videoControl.click();
    assert.equal(await videoControl.getAttribute("aria-pressed"), "false");
    assert.match(
      await videoControl.getAttribute("aria-label"),
      /Play background video/,
    );
    await videoControl.click();
    assert.equal(await videoControl.getAttribute("aria-pressed"), "true");
    check("Ambient video pause/play toggles aria-pressed on a 44px target");

    const guardrail = page.getByRole("button", {
      name: "Deterministic policy guard",
    });
    assert.equal(await guardrail.getAttribute("aria-expanded"), "false");
    await guardrail.click();
    assert.equal(await guardrail.getAttribute("aria-expanded"), "true");
    assert(
      await page.locator("#acc-panel-guardrails").locator("p").isVisible(),
    );
    const first = page.getByRole("button", { name: "Start in Chat" });
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    await first.click();
    assert.equal(await first.getAttribute("aria-expanded"), "true");
    assert.equal(await guardrail.getAttribute("aria-expanded"), "false");
    check("Accordions toggle aria-expanded and open a single panel");

    const counter = page.locator(".rre-slider__counter");
    const count = async () =>
      (await counter.innerText()).replace(/\s+/g, " ").trim();
    assert.equal(await count(), "01 / 04");
    await page
      .getByRole("button", { name: "Next workflow scenario" })
      .click();
    assert.equal(await count(), "02 / 04");
    await page
      .getByRole("button", { name: "Previous workflow scenario" })
      .click();
    assert.equal(await count(), "01 / 04");
    check("Scenario slider moves the counter in both directions");

    const launcher = page.locator(".rre-footer-form");
    await launcher.getByRole("button", { name: "OPEN CHAT" }).click();
    const alert = launcher.locator(".rre-footer-form__error");
    assert(await alert.isVisible());
    assert.equal(
      await alert.textContent(),
      "Enter a finance question to open in Chat.",
    );
    check("Footer launcher shows an error message on an empty submit");

    assert.equal(calls.length, 0, "Landing must never request Brigid API");

    const viewports = [
      [1440, 900, "desktop"],
      [768, 1024, "tablet"],
      [390, 844, "mobile"],
    ];
    for (const [width, height, name] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(origin);
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= window.innerWidth,
        null,
        { timeout: 30_000 },
      );
      await page.screenshot({
        path: path.join(output, `landing-${name}-${width}.png`),
        fullPage: true,
      });
      check(`No horizontal overflow at ${name} ${width}x${height}`);
    }

    const menuButton = page.getByRole("button", { name: "Menu", exact: true });
    const menuBox = await menuButton.boundingBox();
    assert(menuBox.height >= 44 && menuBox.width >= 44);
    await menuButton.click();
    const drawer = page.locator("#rre-mobile-drawer");
    assert(await drawer.isVisible());
    assert.equal(await menuButton.getAttribute("aria-expanded"), "true");
    assert(
      await drawer
        .getByRole("navigation", { name: "Mobile navigation" })
        .isVisible(),
    );
    await page.keyboard.press("Escape");
    assert.equal(await drawer.count(), 0);
    assert.equal(await menuButton.getAttribute("aria-expanded"), "false");
    assert(
      await menuButton.evaluate((el) => el === document.activeElement),
    );
    check("Mobile drawer opens from Menu, closes on Escape and restores focus");

    await page.locator("#rre-footer-prompt").fill("Review overdue supplier invoices");
    await launcher.getByRole("button", { name: "OPEN CHAT" }).click();
    await page.waitForURL("**/chat?prompt=Review%20overdue%20supplier%20invoices");
    await page.locator("#message-input").waitFor();
    check("Footer launcher opens Chat with the encoded prompt query");

    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
    assert.deepEqual(
      consoleErrors,
      [],
      `console errors: ${consoleErrors.join("; ")}`,
    );
    check("Zero console errors and zero page errors across all loads");

    await fs.writeFile(
      path.join(output, "landing-results.json"),
      JSON.stringify({ checks, mockedWorkspaceCalls: calls }, null, 2),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
