// Live panel refresh: the main page reflects new data (add task, finish pomo)
// without a page reload — including the History panel once it's been opened.
// VAL-LIVE-001..004. Case 003 is red before the syncNow→history wiring (T2).
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo, expireTimer } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;
const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);

// A sentinel that a full page reload would wipe — proves no navigation happened.
async function markNoReload(page) {
  await page.evaluate(() => { window.__noReload = true; });
}
const stillNoReload = (page) => page.evaluate(() => window.__noReload === true);

// Start a pomo on a task and finish it through the credit modal.
async function finishPomoOn(page, tid) {
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
  await expireTimer(page);
  await expect(page.locator("#credit-modal")).toBeVisible();
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false, autoStartPomodoros: false });
});

test("VAL-LIVE-001: new task appears with no page reload", async ({ page }) => {
  await markNoReload(page);
  const name = uniq("live-");
  const { item } = await addTodo(page, name);
  await expect(item).toBeVisible();
  expect(await stillNoReload(page), "no navigation").toBe(true);
});

test("VAL-LIVE-002: finished pomo updates today-log/blocks without reload", async ({ page }) => {
  await markNoReload(page);
  const { tid } = await addTodo(page, uniq("done-"));
  const before = await bd(page, tid);
  await finishPomoOn(page, tid);
  await expect.poll(() => bd(page, tid)).toBe(before + 1);
  await expect(page.locator("#today-log")).toContainText("1");
  expect(await stillNoReload(page), "no navigation").toBe(true);
});

test("VAL-LIVE-003: finished pomo reaches open History without re-opening it", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("hist-"));
  // Prime the History panel (load state.history), then return to the timer.
  await page.evaluate(() => openHistory());
  await expect.poll(() => page.evaluate(() => !!state.history)).toBe(true);
  const before = await page.evaluate(() => state.history.pomos.length);
  await markNoReload(page);

  await finishPomoOn(page, tid);

  // The finished pomo must reach state.history.pomos via the normal sync path —
  // no re-open of the History tab, no reload.
  await expect.poll(() => page.evaluate(() => state.history.pomos.length)).toBe(before + 1);
  expect(await stillNoReload(page), "no navigation").toBe(true);
});

test("VAL-LIVE-004: live history refresh preserves the current page", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("page-"));
  await page.evaluate(() => openHistory());
  await expect.poll(() => page.evaluate(() => !!state.history)).toBe(true);
  // Pretend the user paged forward; a live refresh must keep this page (it uses
  // reloadHistory(), not openHistory() which resets to 0).
  await page.evaluate(() => { state.history.pomoPage = 1; });

  await finishPomoOn(page, tid);

  // Give the fire-and-forget history refresh time to settle, then assert the page
  // was preserved (would be 0 if the sync path called openHistory()).
  await expect.poll(() => page.evaluate(() => state.history.pomoPage)).toBe(1);
});
