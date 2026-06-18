// Migrated from tests/e2e_i18n_notes.js — live language switching + safe note
// Markdown rendering (with raw HTML escaped).
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, rowAction } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
  await stubConfirm(page, true);
});

test("language switch updates the UI live", async ({ page }) => {
  // nav.stats actually translates (nav.main is the untranslated brand).
  const { enNav, zhNav } = await page.evaluate(() => ({
    enNav: MESSAGES.en["nav.stats"],
    zhNav: MESSAGES.zh["nav.stats"],
  }));
  expect(typeof enNav).toBe("string");
  expect(enNav).not.toBe(zhNav);

  const navLabel = page.locator('[data-i18n="nav.stats"]');
  // The language <select> lives in the Settings view; open it first.
  await page.locator('[data-view="settings"]').click();

  await page.selectOption("#set-lang", "en");
  await expect(navLabel).toHaveText(enNav);

  await page.selectOption("#set-lang", "zh");
  await expect(navLabel).toHaveText(zhNav);

  await page.selectOption("#set-lang", "en");
  await expect(navLabel).toHaveText(enNav);
});

test("note renders a safe Markdown subset, raw HTML escaped", async ({ page }) => {
  const name = uniq("NOTE");
  await page.fill("#task-input", name);
  await page.press("#task-input", "Enter");

  const byName = page.locator("#today-list .task-item").filter({ hasText: name });
  await expect(byName).toBeVisible();
  const tid = await byName.getAttribute("data-id");
  // Stable handle: hasText stops matching once the name becomes an <input>.
  const row = page.locator(`#today-list .task-item[data-id="${tid}"]`);

  const note =
    "# Title\n\n" +
    "**bold** and a [link](https://example.com)\n\n" +
    "- one\n- two\n\n" +
    "<script>alert(1)</script>";

  await rowAction(row, "edit");
  const noteField = row.locator('[data-field="note"]');
  await expect(noteField).toBeVisible();
  await noteField.fill(note);
  await rowAction(row, "save");
  await expect(noteField).toBeHidden();

  await rowAction(row, "note"); // expand panel
  const panel = page.locator("#today-list .note-panel");
  await expect(panel).toBeVisible();
  const html = await panel.innerHTML();

  expect(html.length).toBeGreaterThan(0);
  expect(html).toContain("<h3>Title</h3>");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<li>one</li>");
  expect(html).toContain("<li>two</li>");
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("<script>");

  await rowAction(row, "delete");
  await expect(row).toBeHidden();
});
