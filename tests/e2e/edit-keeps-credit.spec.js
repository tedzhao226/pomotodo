// Regression: editing a task must NOT freeze its pomo count. The old editor
// carried a "done" field pre-filled with the current count and saved it every
// time, latching blocks_override so later completed pomos could never move the
// displayed count ("no credit after pomo"). The override is gone; blocks_done is
// always the live completed-block count. VAL-EDIT-CREDIT-001.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo, rowAction, expireTimer } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;
const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false, autoStartPomodoros: false });
  await stubConfirm(page, true);
});

// Shared server singleton: end any block this spec leaves open.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    if (state.activeBlock) { try { await finishBlock(false); } catch {} }
  });
});

test("VAL-EDIT-CREDIT-001: editing a task does not freeze its pomo count", async ({ page }) => {
  const { item, tid } = await addTodo(page, uniq("edit-"));
  expect(await bd(page, tid)).toBe(0);

  // Edit the task (set an estimate) and save — this is what used to latch the
  // current count (0) into a permanent blocks_override.
  await rowAction(item, "edit");
  const est = item.locator('[data-field="estimate_blocks"]');
  await expect(est).toBeVisible();
  await est.fill("4");
  await rowAction(item, "save");
  await expect(est).toHaveCount(0); // editor closed

  // Finish a pomo on the edited task.
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
  await expireTimer(page);
  await expect(page.locator("#credit-modal")).toBeVisible();
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);

  // The pomo credits the task: the edit didn't freeze the count at 0.
  await expect.poll(() => bd(page, tid)).toBe(1);
});
