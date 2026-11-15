const { chromium } = require("playwright");
const assert = require("node:assert/strict");

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
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.setDefaultNavigationTimeout(120_000);
    const errors = [];
    const calls = [];
    page.on("pageerror", (error) => errors.push(error.message));
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

    const prompt = "Review <img src=x onerror=alert(1)> and overdue invoices";
    await page.goto(`${origin}/chat?prompt=${encodeURIComponent(prompt)}`);
    await page.locator("#message-input").waitFor();

    const value = await page.locator("#message-input").inputValue();
    assert.equal(value, prompt);
    // The composer holds the text as a plain value: nothing was injected as markup.
    assert.equal(await page.locator("img[src='x']").count(), 0);
    // A prefill never sends anything on its own.
    assert.equal(calls.filter((action) => action === "chat").length, 0);
    assert.equal(await page.locator(".paper-message").count(), 0);
    await page.locator(".paper-welcome").waitFor();
    assert.deepEqual(errors, []);

    await page.goto(`${origin}/chat`);
    await page.locator("#message-input").waitFor();
    assert.equal(await page.locator("#message-input").inputValue(), "");

    const long = "ab".repeat(2500);
    await page.goto(`${origin}/chat?prompt=${encodeURIComponent(long)}`);
    await page.locator("#message-input").waitFor();
    const clipped = await page.locator("#message-input").inputValue();
    assert.equal(clipped.length, 4000, `seeded draft length ${clipped.length}`);

    console.log(
      "PASS chat prefill: plain text value, no markup injection, never auto-sent, clipped to 4000, empty without a prompt, no page errors",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
