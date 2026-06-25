// A finished pomo credits the task you ENDED ON (the active task at finish), not
// the task it started on. Other touched/checked tasks enrich the note only — one
// pomo is still one block, one task. VAL-CREDIT-ACTIVE-001..003.
// Case 001 is red before the fix (the start anchor wrongly keeps the pomo).
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo, expireTimer, rowAction } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;
const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);
const bucketOf = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.bucket, tid);

async function startTaskless(page) {
  await page.evaluate(() => { state.selectedTaskId = null; updateTimerControls(); });
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
}

async function startOn(page, tid) {
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
}

async function switchTo(page, item, tid) {
  await rowAction(item, "activate");
  await page.waitForFunction((id) => state.activeTaskId === id, tid);
}

async function finishToModal(page) {
  await expireTimer(page);
  await expect(page.locator("#credit-modal")).toBeVisible();
}

const modalIds = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#credit-list input")].map((cb) => Number(cb.dataset.id)));

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false, autoStartPomodoros: false });
  await page.evaluate(() => { window.confirm = () => true; }); // auto-accept switch confirm
});

// Shared server singleton: end any block/break this spec leaves open.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    if (state.activeBlock) { try { await finishBlock(false); } catch {} }
    try { await api("/api/break", { method: "DELETE" }); } catch {}
  });
});

test("VAL-CREDIT-ACTIVE-001: a mid-block switch credits the task you ended on", async ({ page }) => {
  const a = await addTodo(page, uniq("A-"));
  const b = await addTodo(page, uniq("B-"));
  const a0 = await bd(page, a.tid);
  const b0 = await bd(page, b.tid);

  await startOn(page, a.tid);
  await switchTo(page, b.item, b.tid); // assign/switch to B mid-block
  await finishToModal(page);
  await page.locator("#credit-confirm").click(); // default selection (both checked)
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);

  expect(await bd(page, b.tid), "switched-to B credited").toBe(b0 + 1);
  expect(await bd(page, a.tid), "start anchor A not credited").toBe(a0);
});

test("VAL-CREDIT-ACTIVE-001b: unchecking the active task credits the one left checked", async ({ page }) => {
  const a = await addTodo(page, uniq("A-"));
  const b = await addTodo(page, uniq("B-"));
  const a0 = await bd(page, a.tid);
  const b0 = await bd(page, b.tid);

  await startOn(page, a.tid);
  await switchTo(page, b.item, b.tid);
  await finishToModal(page);
  // Uncheck the active task B → the remaining checked task A owns the pomo.
  await page.locator(`#credit-list input[data-id="${b.tid}"]`).uncheck();
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);

  expect(await bd(page, a.tid), "A credited when B unchecked").toBe(a0 + 1);
  expect(await bd(page, b.tid), "B not credited").toBe(b0);
});

test("VAL-CREDIT-ACTIVE-002: taskless start + assign a TODAY task credits it", async ({ page }) => {
  const t = await addTodo(page, uniq("today-"));
  const before = await bd(page, t.tid);
  await startTaskless(page);
  await switchTo(page, t.item, t.tid);
  await finishToModal(page);
  expect(await modalIds(page), "assigned task shown in modal").toContain(t.tid);
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, t.tid)).toBe(before + 1);
});

test("VAL-CREDIT-ACTIVE-002b: taskless start + assign a BACKLOG task shows + credits it", async ({ page }) => {
  const t = await addTodo(page, uniq("bk-"));
  await rowAction(t.item, "move"); // → backlog
  await expect.poll(() => bucketOf(page, t.tid)).toBe("backlog");
  const before = await bd(page, t.tid);

  await startTaskless(page);
  const bkItem = page.locator(`#backlog-list .task-item[data-id="${t.tid}"]`);
  await switchTo(page, bkItem, t.tid);
  await finishToModal(page);
  // The Backlog task must appear in the modal (was filtered out before the fix).
  expect(await modalIds(page), "backlog task shown in modal").toContain(t.tid);
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, t.tid)).toBe(before + 1);
});

test("VAL-CREDIT-ACTIVE-003: switch credit works with auto-break on", async ({ page }) => {
  await setSettings(page, { autoStartRest: true, autoStartPomodoros: false });
  const a = await addTodo(page, uniq("A-"));
  const b = await addTodo(page, uniq("B-"));
  const a0 = await bd(page, a.tid);
  const b0 = await bd(page, b.tid);

  await startOn(page, a.tid);
  await switchTo(page, b.item, b.tid);
  await finishToModal(page);
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);

  expect(await bd(page, b.tid), "B credited once").toBe(b0 + 1);
  expect(await bd(page, a.tid), "A not credited").toBe(a0);
  // The break auto-started — no double credit, clean transition.
  await expect.poll(() => page.evaluate(() => state.timerMode)).toMatch(/Break$/);
});
