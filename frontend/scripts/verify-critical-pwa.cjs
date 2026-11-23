const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = process.env.BRIGID_TEST_ORIGIN || "http://127.0.0.1:3000";

const MOCK_USER = {
  user_id: "usr_owner",
  role: "owner",
  business_id: "biz_demo",
  name: "Sari",
};

const MOCK_INVOICES = [
  {
    id: "inv_001",
    kind: "payable",
    counterparty_id: "sup_001",
    counterparty_name: "PT Kopi Nusantara",
    number: "INV-2026-001",
    amount: "4500000.00",
    currency: "IDR",
    issue_date: "2026-11-01",
    due_date: "2026-11-20",
    status: "open",
    late_fee_bearing: false,
    stated_account: "•••• 4821",
    document_text: "Monthly roasted coffee beans supply.",
    needs_review: false,
  },
];

const MOCK_TRANSACTIONS = [
  {
    id: "tx_001",
    date: "2026-11-12",
    amount: "1250000.00",
    direction: "out",
    counterparty: "PT Listrik Mandiri",
    memo: "Electricity bill November",
    reference: "REF-8821",
    needs_review: false,
  },
];

async function installMocks(context) {
  await context.route("**/api/brigid/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/brigid/, "");

    if (path === "/info") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          simulation: "Local simulation.",
          roles: ["owner", "bookkeeper", "staff"],
          screening_model: true,
        }),
      });
    }
    if (path === "/login") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "demo-tok", user: MOCK_USER }),
      });
    }
    if (path === "/logout") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "logged_out" }),
      });
    }
    if (path === "/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      });
    }
    if (path === "/pending") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ requests: [] }),
      });
    }
    if (path === "/invoices") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invoices: MOCK_INVOICES }),
      });
    }
    if (path === "/invoices/inv_001") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invoice: MOCK_INVOICES[0],
          supplier: {
            id: "sup_001",
            name: "PT Kopi Nusantara",
            account_verified: true,
            verified_account: "•••• 4821",
          },
        }),
      });
    }
    if (path === "/transactions") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transactions: MOCK_TRANSACTIONS }),
      });
    }
    if (path === "/transactions/tx_001") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transaction: MOCK_TRANSACTIONS[0] }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not found." }),
    });
  });
}

async function main() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    await installMocks(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 1. PWA manifest, sw.js, offline.html
    const manifestRes = await page.request.get(`${BASE}/manifest.webmanifest`);
    assert.equal(manifestRes.status(), 200, "manifest.webmanifest must return 200");
    const manifest = await manifestRes.json();
    assert.equal(manifest.name, "Brigid");
    assert.ok(manifest.icons.length >= 3, "manifest must include PWA icons");

    const swRes = await page.request.get(`${BASE}/sw.js`);
    assert.equal(swRes.status(), 200, "sw.js must return 200");

    const offlineRes = await page.request.get(`${BASE}/offline.html`);
    assert.equal(offlineRes.status(), 200, "offline.html must return 200");

    // 2. Login page -> submit credentials -> redirects to /chat
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const manifestLink = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    assert.equal(manifestLink, "/manifest.webmanifest");

    await page.getByLabel("Email Address").fill("owner@brigid.demo");
    await page.getByLabel("Password").fill("brigid123");
    await page.getByRole("button", { name: /^Sign In$/i }).click();
    await page.waitForURL("**/chat");

    // 3. Liquid Glass Bottom Nav (5 items, tap targets >= 44px, swipe sideways to hide)
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await nav.waitFor({ state: "visible" });
    const items = nav.locator("a.brigid-bnav-item");
    assert.equal(await items.count(), 5, "Bottom nav must have 5 items");
    for (let i = 0; i < 5; i++) {
      const box = await items.nth(i).boundingBox();
      assert.ok(box && box.height >= 44 && box.width >= 44, "Tap target >= 44px");
    }

    // Swipe left to hide
    const navBox = await nav.boundingBox();
    assert.ok(navBox);
    const startX = navBox.x + navBox.width * 0.6;
    const y = navBox.y + navBox.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 130, y, { steps: 10 });
    await page.mouse.up();

    const leftHandle = page.locator(".brigid-bnav-handle.is-left");
    await leftHandle.waitFor({ state: "visible" });

    // Tap handle to restore
    await leftHandle.click();
    await leftHandle.waitFor({ state: "hidden" });
    await page.waitForTimeout(300);

    // Swipe right to hide
    const navBox2 = await nav.boundingBox();
    assert.ok(navBox2);
    const startX2 = navBox2.x + navBox2.width * 0.4;
    const y2 = navBox2.y + navBox2.height / 2;
    await page.mouse.move(startX2, y2);
    await page.mouse.down();
    await page.mouse.move(startX2 + 130, y2, { steps: 10 });
    await page.mouse.up();

    const rightHandle = page.locator(".brigid-bnav-handle.is-right");
    await rightHandle.waitFor({ state: "visible" });
    await rightHandle.click();
    await rightHandle.waitFor({ state: "hidden" });

    // 4. Invoices list -> detail -> Ask Brigid to pay
    await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle" });
    await page.getByText("PT Kopi Nusantara").click();
    await page.waitForURL("**/invoices/inv_001");
    await page.getByText("Verified", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("link", { name: "Ask Brigid to pay" }).click();
    await page.waitForURL("**/chat?prompt=*");

    // 5. Transactions list -> detail
    await page.goto(`${BASE}/transactions`, { waitUntil: "networkidle" });
    await page.getByText("PT Listrik Mandiri").click();
    await page.waitForURL("**/transactions/tx_001");
    await page.getByText("Electricity bill November").waitFor({ state: "visible" });

    // 6. Profile page + zero horizontal overflow at 320px
    await page.setViewportSize({ width: 320, height: 700 });
    for (const routePath of ["/login", "/invoices", "/transactions", "/profile"]) {
      await page.goto(`${BASE}${routePath}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(overflow, false, `No horizontal overflow on ${routePath} at 320px`);
    }
    const signOutButton = page.getByRole("button", { name: "Sign out", exact: true });
    await signOutButton.waitFor({ state: "visible" });
    const signOutRgb = await signOutButton.evaluate((el) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = getComputedStyle(el).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a };
    });
    assert.ok(
      signOutRgb.a > 0 &&
        signOutRgb.r > 120 &&
        signOutRgb.r > signOutRgb.g * 2 &&
        signOutRgb.r > signOutRgb.b * 2,
      `Sign out badge must be styled red, got: ${JSON.stringify(signOutRgb)}`,
    );

    assert.deepEqual(errors, [], `Unexpected page errors: ${errors.join("; ")}`);
    console.log("PASS: Critical PWA, pages, list->detail, and Liquid Glass swipe nav verified.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
