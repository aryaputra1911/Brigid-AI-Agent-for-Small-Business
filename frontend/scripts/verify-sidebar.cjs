const { launchBrowser } = require("./browser.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

// Click the toggle and read the width CSSTransition the click creates. The
// transition object lives for its whole 240 ms regardless of how many frames the
// browser paints, so this stays deterministic while still failing on a snap.
async function sidebarWidthTransition(page) {
  await page.evaluate(() =>
    document.querySelector('[aria-label="Toggle sidebar"]').click(),
  );
  return page.evaluate(() => {
    const transition = document
      .querySelector(".paper-sidebar")
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === "width",
      );
    if (!transition) return null;
    const keyframes = transition.effect.getKeyframes();
    return {
      from: keyframes[0].width,
      to: keyframes[keyframes.length - 1].width,
    };
  });
}

async function main() {
  const origin = process.env.BRIGID_TEST_ORIGIN || "http://127.0.0.1:3000";
  const output = path.resolve(__dirname, "../test-results");
  await fs.mkdir(output, { recursive: true });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({
      viewport: { width: 1864, height: 836 },
      reducedMotion: "no-preference",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.sessionStorage.setItem("brigid_has_session", "1");
    });
    await page.route("**/api/brigid/**", (route) =>
      route.fulfill({
        json: route.request().url().includes("/me")
          ? {
              user_id: "user-owner",
              role: "owner",
              business_id: "biz-demo",
              name: "Sari",
            }
          : route.request().url().includes("/info")
            ? {
                roles: ["owner"],
                simulation: "Test simulation",
                screening_model: false,
              }
            : { requests: [] },
      }),
    );
    await page.goto(`${origin}/chat`);
    await page.locator(".paper-welcome").waitFor();
    const sidebar = page.locator(".paper-sidebar");
    const toggle = page.getByRole("button", { name: "Toggle sidebar" });
    const collapse = await sidebarWidthTransition(page);
    assert.deepEqual(collapse, { from: "280px", to: "64px" });
    await page.waitForFunction(
      () => document.querySelector(".paper-sidebar").offsetWidth === 64,
    );
    const controls = [
      page.getByRole("button", { name: "New chat", exact: true }),
      ...[
        "Chat",
        "Invoices",
        "Transactions",
        "Approvals",
        "Mandate",
        "Profile",
      ].map((name) => page.getByRole("link", { name, exact: true })),
    ];
    const boxes = await Promise.all(
      controls.map((control) => control.boundingBox()),
    );
    for (const box of boxes) {
      assert.equal(box.width, 44);
      assert.equal(box.height, 44);
      assert.equal(box.x + box.width / 2, 32);
    }
    assert.equal(await page.locator(".paper-nav-count").count(), 0);
    assert.equal(
      await page
        .locator(".paper-nav-active")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgba(211, 231, 241, 0.22)",
    );
    assert.equal(
      await page
        .locator(".paper-nav-active")
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(255, 255, 255)",
    );
    await page.screenshot({ path: path.join(output, "sidebar-collapsed.png") });
    const expand = await sidebarWidthTransition(page);
    assert.deepEqual(expand, { from: "64px", to: "280px" });
    await page.waitForFunction(
      () => document.querySelector(".paper-sidebar").offsetWidth === 280,
    );
    await page.screenshot({ path: path.join(output, "sidebar-expanded.png") });
    await toggle.dispatchEvent("click");
    await toggle.dispatchEvent("click");
    await page.waitForFunction(
      () =>
        document.querySelector(".paper-shell").dataset.sidebar === "open" &&
        document.querySelector(".paper-sidebar").offsetWidth === 280,
    );
    console.log(
      "PASS animated desktop open/close, rapid toggles, equal 44px controls, purple palette and no zero badge",
    );
    await page.setViewportSize({ width: 390, height: 700 });
    await page.waitForFunction(
      () => document.querySelector(".paper-sidebar").inert,
    );
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.waitForFunction(() => {
      const left = document
        .querySelector(".paper-sidebar")
        .getBoundingClientRect().left;
      return left > -280 && left < -1;
    });
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector(".paper-sidebar").getBoundingClientRect().left,
        ) < 0.01,
    );
    assert.equal(await sidebar.evaluate((el) => el.inert), false);
    assert.equal(
      await page.locator(".paper-main").evaluate((el) => el.inert),
      true,
    );
    await page.screenshot({
      path: path.join(output, "sidebar-mobile-open.png"),
    });
    await page
      .getByRole("button", { name: "Close navigation", exact: true })
      .click();
    await page.waitForFunction(() => {
      const left = document
        .querySelector(".paper-sidebar")
        .getBoundingClientRect().left;
      return left > -280 && left < -1;
    });
    assert.equal(await sidebar.evaluate((el) => el.inert), true);
    await page.waitForFunction(
      () =>
        document.querySelector(".paper-sidebar").getBoundingClientRect().left <=
        -279.9,
    );
    assert.equal(await sidebar.getAttribute("aria-hidden"), "true");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    console.log(
      "PASS animated mobile enter/exit, focus isolation during exit and no horizontal overflow",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1864, height: 836 });
    await toggle.click();
    await page.waitForFunction(
      () => document.querySelector(".paper-sidebar").offsetWidth === 64,
    );
    assert(
      await sidebar.evaluate((el) =>
        el
          .getAnimations()
          .every((animation) => animation.playState !== "running"),
      ),
    );
    await page.setViewportSize({ width: 390, height: 700 });
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector(".paper-sidebar").getBoundingClientRect().left,
        ) < 0.01,
    );
    assert(
      await sidebar.evaluate((el) =>
        el
          .getAnimations()
          .every((animation) => animation.playState !== "running"),
      ),
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.querySelector(".paper-sidebar").inert,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS reduced-motion desktop/mobile toggles, Escape and no runtime errors",
    );
    await fs.writeFile(
      path.join(output, "sidebar-results.json"),
      JSON.stringify({ controls: boxes, errors, result: "pass" }, null, 2),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
