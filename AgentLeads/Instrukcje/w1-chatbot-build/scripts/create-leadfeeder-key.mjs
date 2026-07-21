import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const { LEADFEEDER_LOGIN, LEADFEEDER_PASSWORD, LEADFEEDER_KEY_OUTPUT } = process.env;
if (!LEADFEEDER_LOGIN || !LEADFEEDER_PASSWORD || !LEADFEEDER_KEY_OUTPUT) {
  throw new Error("Missing Leadfeeder bootstrap environment variables");
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.goto("https://app.leadfeeder.com/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: /email/i }).fill(LEADFEEDER_LOGIN);
  await page.getByLabel(/password/i).fill(LEADFEEDER_PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(/app\.leadfeeder\.com\/f\/\d+/, { timeout: 30000 });
  await page.goto("https://app.leadfeeder.com/f/settings/personal/517319/api-keys", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("Settings URL:", page.url());
  console.log("Settings page:", (await page.locator("body").innerText()).slice(0, 1200));
  if ((await page.locator("body").innerText()).includes("AgentLeads automation")) {
    const existingRow = page.getByRole("row", { name: /AgentLeads automation/i });
    console.log("Existing key row:", (await existingRow.innerText()).replace(/[A-Za-z0-9_-]{20,}/g, "[SECRET]"));
    console.log("Existing row buttons:", await existingRow.getByRole("button").allTextContents());
    console.log("Existing row button attrs:", await existingRow.getByRole("button").evaluateAll((els) => els.map((e) => ({ title: e.getAttribute("title"), aria: e.getAttribute("aria-label"), test: [...e.attributes].filter((a) => a.name.startsWith("data-test")).map((a) => a.name) }))));
    await existingRow.locator('[data-test-delete-api-key-button]').click();
    await page.getByRole("button", { name: /delete|remove/i }).last().click();
    await existingRow.waitFor({ state: "detached" });
    console.log("Unrecoverable bootstrap key removed; generating replacement.");
  }
  await page.getByRole("button", { name: "Create a new API key" }).click();
  await page.waitForTimeout(1000);
  const dialog = page.locator('[role="dialog"], [data-test-modal], form').last();
  console.log("After create click:", (await page.locator("body").innerText()).slice(-1200));
  const inputs = page.locator('input:visible, textarea:visible');
  console.log("Visible fields:", await inputs.count());
  await page.getByLabel("Name", { exact: true }).fill("AgentLeads automation");
  const description = page.getByLabel("Description", { exact: true });
  if (await description.count()) await description.fill("Read-only website visitor lead qualification");
  await dialog.getByRole("button", { name: /create|generate/i }).click();
  await page.waitForTimeout(1000);
  const values = await page.locator("input:visible, textarea:visible").evaluateAll((els) => els.map((e) => e.value));
  const bodyText = await page.locator("body").innerText();
  let keyText = values.find((v) => /^[A-Za-z0-9_-]{32,}$/.test(v) && !v.includes("*")) || "";
  if (!keyText) keyText = bodyText.match(/\b[A-Fa-f0-9]{40,}\b/)?.[0] || "";
  if (!keyText) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://app.leadfeeder.com" });
    const copyButton = page.locator('[data-test-ui-tooltip-trigger]').last();
    if (await copyButton.count()) {
      await copyButton.click();
      keyText = await page.evaluate(() => navigator.clipboard.readText());
    }
  }
  if (!keyText) throw new Error("API key was created but could not be read");
  await writeFile(LEADFEEDER_KEY_OUTPUT, keyText, { encoding: "utf8", mode: 0o600 });
  console.log("Leadfeeder API key created successfully.");
} finally {
  await browser.close();
}
