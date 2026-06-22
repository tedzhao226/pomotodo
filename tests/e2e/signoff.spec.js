// Sign-off countdown feature — the setting persists across reload, and the Today
// line renders/hides per the configured time. App ships globals (classic script,
// no exports), so internals are reached via page.evaluate. See CLAUDE.md.
import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers.js";

// VAL-SIGNOFF-001
test("sign-off time persists across reload", async ({ page }) => {
  await gotoApp(page);
  expect(await page.evaluate(() => state.settings.signOffTime)).toBe("18:00");

  await page.locator('button[data-view="settings"]').click();
  await page.fill("#set-signoff", "23:30");
  await page.locator('#settings-form button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => state.settings.signOffTime)).toBe("23:30");

  await page.reload();
  await gotoApp(page);
  expect(await page.evaluate(() => state.settings.signOffTime)).toBe("23:30");

  await page.locator('button[data-view="settings"]').click();
  await expect(page.locator("#set-signoff")).toHaveValue("23:30");
});

// VAL-SIGNOFF-003
test("Today sign-off line renders and hides", async ({ page }) => {
  await gotoApp(page);

  // 90-min-ahead future time, midnight-safe (falls back to 23:59 only in the
  // last 90 min of the day — a known ceiling, fine for CI).
  const future = await page.evaluate(() => {
    const pad = (x) => String(x).padStart(2, "0");
    const n = new Date();
    const f = new Date(n.getTime() + 90 * 60000);
    return f.getDate() !== n.getDate() ? "23:59" : pad(f.getHours()) + ":" + pad(f.getMinutes());
  });

  await page.evaluate((future) => {
    state.settings.signOffTime = future;
    renderSignoff();
  }, future);
  await expect(page.locator("#signoff-countdown")).toBeVisible();
  await expect(page.locator("#signoff-countdown")).toContainText("until sign-off");

  await page.evaluate(() => {
    state.settings.signOffTime = "00:00";
    renderSignoff();
  });
  await expect(page.locator("#signoff-countdown")).toBeVisible();
  await expect(page.locator("#signoff-countdown")).toContainText("Past sign-off");

  await page.evaluate(() => {
    state.settings.signOffTime = "";
    renderSignoff();
  });
  await expect(page.locator("#signoff-countdown")).toBeHidden();
});
