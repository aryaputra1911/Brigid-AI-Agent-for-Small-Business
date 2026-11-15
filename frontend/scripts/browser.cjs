const { chromium } = require("playwright");

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    // Some machines have no Chrome channel; Playwright's bundled chromium behaves the same.
    return await chromium.launch({ headless: true });
  }
}

module.exports = { launchBrowser };
