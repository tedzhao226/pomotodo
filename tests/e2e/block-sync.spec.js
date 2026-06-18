// Mid-block task changes (switch, chip-remove) persist server-side and survive a
// rehydrate — the touched set is no longer client-only.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo, rowAction } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

const serverRunning = (page) =>
  page.evaluate(async () => (await api("/api/dashboard")).running_block);
const localTouched = (page) =>
  page.evaluate(() => [...state.touchedTaskIds].sort((x, y) => x - y));

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
  await stubConfirm(page, true); // auto-accept the switch confirm
});

// End any block this spec left open so the shared server doesn't poison later
// specs (a leaked running block rehydrates + pops a credit modal).
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    const rb = (await api("/api/dashboard")).running_block;
    if (rb) {
      await api(`/api/blocks/${rb.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: false }),
      });
    }
  });
});

test("VAL-SYNC-001/002/003: switches + chip-remove persist and rehydrate", async ({ page }) => {
  const a = await addTodo(page, uniq("A"));
  const b = await addTodo(page, uniq("B"));
  const c = await addTodo(page, uniq("C"));
  const sorted = [a.tid, b.tid, c.tid].sort((x, y) => x - y);

  // start a block on A
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, a.tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);

  // switch A -> B -> C (each persists active + touched)
  await rowAction(b.item, "activate");
  await expect.poll(() => page.evaluate(() => state.activeTaskId), {}).toBe(b.tid);
  await rowAction(c.item, "activate");
  await expect.poll(() => page.evaluate(() => state.activeTaskId)).toBe(c.tid);

  // VAL-SYNC-001: server has the full touched set; task_id is the anchor (A).
  await expect.poll(async () => (await serverRunning(page))?.task_id).toBe(a.tid);
  expect((await serverRunning(page)).touched_task_ids.sort((x, y) => x - y)).toEqual(sorted);

  // VAL-SYNC-002: force a fresh rehydrate — the full touched set is restored
  // (active resolves to the anchor on reload).
  await page.evaluate(async () => {
    state.activeBlock = null;
    state.activeTaskId = null;
    state.touchedTaskIds = new Set();
    state.rehydrated = false;
    await syncNow();
  });
  await expect.poll(() => page.evaluate(() => state.activeTaskId)).toBe(a.tid);
  expect(await localTouched(page)).toEqual(sorted);

  // VAL-SYNC-003: removing B's chip persists ({A,C})
  await page.locator(`[data-chip-remove="${b.tid}"]`).dispatchEvent("click");
  await expect
    .poll(async () => (await serverRunning(page)).touched_task_ids.sort((x, y) => x - y))
    .toEqual([a.tid, c.tid].sort((x, y) => x - y));
});
