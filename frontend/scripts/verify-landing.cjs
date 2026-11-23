const { launchBrowser } = require("./browser.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

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
      if (action === "demo") {
        return route.fulfill({
          json: {
            token: "demo-token",
            user: {
              user_id: "user-owner",
              role: "owner",
              business_id: "biz-toko-sari",
              name: "Demo",
            },
          },
        });
      }
      if (action === "me") {
        return route.fulfill({
          json: {
            user_id: "user-owner",
            role: "owner",
            business_id: "biz-toko-sari",
            name: "Demo",
          },
        });
      }
      if (action === "logout") {
        return route.fulfill({ json: { status: "logged_out" } });
      }
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
    for (const label of ["CHAT", "APPROVALS", "MANDATE", "TRY DEMO", "LOGIN"]) {
      assert(
        await drawer.getByRole("link", { name: label, exact: true }).isVisible(),
        `Missing drawer link ${label}`,
      );
    }
    assert.equal(
      await drawer
        .getByRole("link", { name: "CHAT", exact: true })
        .getAttribute("href"),
      "/login?next=%2Fchat",
    );
    assert.equal(
      await drawer
        .getByRole("link", { name: "APPROVALS", exact: true })
        .getAttribute("href"),
      "/login?next=%2Fapprovals",
    );
    assert.equal(
      await drawer
        .getByRole("link", { name: "MANDATE", exact: true })
        .getAttribute("href"),
      "/login?next=%2Fmandate",
    );
    assert.equal(
      await drawer
        .getByRole("link", { name: "TRY DEMO", exact: true })
        .getAttribute("href"),
      "/chat?demo=1",
    );
    await page.keyboard.press("Escape");
    assert.equal(await drawer.count(), 0);
    assert.equal(await menuButton.getAttribute("aria-expanded"), "false");
    assert(
      await menuButton.evaluate((el) => el === document.activeElement),
    );
    check("Mobile drawer opens from Menu, lists auth-gated + TRY DEMO links, closes on Escape and restores focus");

    // Verify unauthenticated direct visit to /chat, /approvals, /mandate redirects to /login
    for (const protectedPath of ["/chat", "/approvals", "/mandate"]) {
      await page.goto(`${origin}${protectedPath}`);
      await page.waitForURL(
        `**/login?next=${encodeURIComponent(protectedPath)}`,
      );
      await page.getByRole("heading", { name: "Welcome Back" }).waitFor();
    }
    check("Unauthenticated access to /chat, /approvals, /mandate redirects to /login");

    // Verify footer prompt launcher redirects through /login?next=... when logged out
    await page.goto(origin);
    await page.locator("#rre-footer-prompt").fill("Review overdue supplier invoices");
    await launcher.getByRole("button", { name: "OPEN CHAT" }).click();
    await page.waitForURL(
      `**/login?next=${encodeURIComponent("/chat?prompt=Review%20overdue%20supplier%20invoices")}`,
    );
    check("Footer launcher preserves encoded prompt across login redirect when logged out");

    // Verify TRY DEMO enters /chat directly without login and sets Demo account on /profile with red Sign out badge
    await page.goto(origin);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "TRY DEMO", exact: true })
      .click();
    await page.waitForURL("**/chat");
    await page.locator("#message-input").waitFor();
    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await page.waitForURL("**/profile");
    await page.getByText("Demo", { exact: true }).waitFor();
    const signOutBtn = page.getByRole("button", { name: "Sign out", exact: true });
    await signOutBtn.waitFor();
    const signOutRgb = await signOutBtn.evaluate((el) => {
      const style = getComputedStyle(el);
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a, borderRadius: style.borderRadius };
    });
    assert(
      signOutRgb.a > 0 &&
        signOutRgb.r > 120 &&
        signOutRgb.r > signOutRgb.g * 2 &&
        signOutRgb.r > signOutRgb.b * 2,
      `Expected red sign out badge, got ${JSON.stringify(signOutRgb)}`,
    );
    await signOutBtn.click();
    await page.waitForURL("**/login");
    check("TRY DEMO enters /chat without login, shows Demo account and red Sign out badge on /profile");

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
