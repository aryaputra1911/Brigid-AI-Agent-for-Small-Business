const { launchBrowser } = require("./browser.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const origin = process.env.BRIGID_TEST_ORIGIN || "http://127.0.0.1:3000";
  const output = path.resolve(__dirname, "../test-results");
  await fs.mkdir(output, { recursive: true });
  const browser = await launchBrowser();
  const results = [];
  try {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        reducedMotion,
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let receiveChat;
      const nextChat = () =>
        new Promise((resolve) => {
          receiveChat = resolve;
        });
      await context.route("**/api/brigid/**", async (route) => {
        const action = new URL(route.request().url()).pathname
          .split("/")
          .at(-1);
        if (action === "chat") {
          receiveChat(route);
          return;
        }
        await route.fulfill({
          json:
            action === "info"
              ? {
                  roles: ["owner"],
                  simulation: "Test simulation",
                  screening_model: false,
                }
              : { requests: [] },
        });
      });
      await page.goto(`${origin}/chat`);
      await page.locator(".paper-welcome").waitFor();
      const input = page.getByRole("textbox", { name: "Message Brigid" });
      const waiting = page.locator('.paper-message[role="status"]');
      const request = nextChat();
      await input.fill("Review invoices");
      await input.press("Enter");
      const heldRoute = await request;
      await waiting.waitFor();
      const logo = waiting.locator(".paper-assistant-mark");
      assert(await logo.isVisible());
      assert.equal(await logo.getAttribute("aria-hidden"), "true");
      if (reducedMotion === "no-preference") {
        await page.waitForFunction(() => {
          const el = document.querySelector(
            '.paper-message[role="status"] .brigid-logo',
          );
          return (
            el.dataset.playback === "playing" &&
            getComputedStyle(el.querySelector(".brigid-logo-mark"))
              .animationName === "brigid-processing"
          );
        });
        // the pulse must actually move the mark, not just declare an animation
        const moves = await logo.evaluate(async (el) => {
          const mark = el.querySelector(".brigid-logo-mark");
          const before = getComputedStyle(mark).transform;
          await new Promise((resolve) => setTimeout(resolve, 400));
          return (
            before !== getComputedStyle(mark).transform &&
            el.dataset.playback === "playing"
          );
        });
        assert(moves);
        const loop = await logo.evaluate(async (el) => {
          const mark = el.querySelector(".brigid-logo-mark");
          const name = getComputedStyle(mark).animationName;
          await new Promise((resolve) => setTimeout(resolve, 1600));
          return (
            el.dataset.playback === "playing" &&
            getComputedStyle(mark).animationName === name
          );
        });
        assert(loop);
        await page.screenshot({ path: path.join(output, "chat-loading.png") });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(
          () =>
            document.querySelector('.paper-message[role="status"] .brigid-logo')
              .dataset.playback === "static",
        );
        assert.equal(
          await logo.evaluate(
            (el) =>
              getComputedStyle(el.querySelector(".brigid-logo-mark"))
                .animationName === "none",
          ),
          true,
        );
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.waitForFunction(() => {
          const el = document.querySelector(
            '.paper-message[role="status"] .brigid-logo',
          );
          return (
            el.dataset.playback === "playing" &&
            getComputedStyle(el.querySelector(".brigid-logo-mark"))
              .animationName === "brigid-processing"
          );
        });
      } else {
        assert.equal(await logo.getAttribute("data-playback"), "static");
        assert.equal(await logo.locator("img").count(), 1);
      }
      await heldRoute.fulfill({
        json: {
          reply: "Test response complete.",
          blocked: false,
          new_requests: [],
        },
      });
      await waiting.waitFor({ state: "detached" });
      await page.getByText("Test response complete.").waitFor();
      const replyLogo = page.locator(".paper-assistant-mark");
      if (reducedMotion === "no-preference") {
        await page.waitForFunction(() => {
          const el = document.querySelector(
            ".paper-message-assistant .brigid-logo",
          );
          return (
            el.dataset.playback === "playing" &&
            getComputedStyle(el.querySelector(".brigid-logo-mark"))
              .animationName === "brigid-reply"
          );
        });
        // one pulse, then the mark settles back to its static transform
        await page.waitForFunction(() => {
          const el = document.querySelector(
            ".paper-message-assistant .brigid-logo",
          );
          return (
            el.dataset.playback === "playing" &&
            getComputedStyle(el.querySelector(".brigid-logo-mark"))
              .transform === "none"
          );
        });
      } else
        assert.equal(await replyLogo.getAttribute("data-playback"), "static");
      await page.screenshot({
        path: path.join(output, `chat-logo-reply-${reducedMotion}.png`),
      });
      assert.equal(
        await page.locator(".paper-brand-logo").getAttribute("data-playback"),
        "static",
      );
      assert(
        await page
          .locator('link[rel="icon"][href="/brand/brigid.svg"]')
          .count(),
      );
      assert.equal(
        (await context.request.get(`${origin}/brand/brigid.svg`)).status(),
        200,
      );
      assert.equal(
        (await context.request.get(`${origin}/brand/brigid-180.png`)).status(),
        200,
      );
      assert.equal(
        (await context.request.get(`${origin}/favicon.ico`)).status(),
        200,
      );
      const failingRequest = nextChat();
      await input.fill("Retain this draft");
      await input.press("Enter");
      const failure = await failingRequest;
      await waiting.waitFor();
      await failure.fulfill({
        status: 503,
        json: { detail: "Test model unavailable" },
      });
      await page
        .getByRole("alert")
        .filter({ hasText: "Message not completed" })
        .waitFor();
      await waiting.waitFor({ state: "detached" });
      assert.equal(await input.inputValue(), "Retain this draft");
      assert.deepEqual(errors, []);
      results.push(
        `${reducedMotion}: Logo processing pulse, reply settle, header/favicon, preference changes, success/failure cleanup, no runtime errors`,
      );
      console.log(`PASS ${results.at(-1)}`);
      await context.close();
    }
    await fs.writeFile(
      path.join(output, "loading-results.json"),
      JSON.stringify({ results }, null, 2),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
