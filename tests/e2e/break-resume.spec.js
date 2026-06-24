// A break keeps the just-worked task selected so the next pomodoro resumes it.
// The carry detaches only when the task is marked done. Models skip.spec.js.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo, rowAction } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

// Start a work block on a task, then freeze the countdown at a given elapsed
// fraction (clear the tick so remainingSeconds stays put).
async function startBlockAt(page, tid, elapsedFrac) {
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
  await page.evaluate((frac) => {
    clearTimerInterval();
    state.remainingSeconds = Math.round(state.activeBlock.durationMin * 60 * (1 - frac));
  }, elapsedFrac);
}
const selected = (page) => page.evaluate(() => state.selectedTaskId);
const activeTask = (page) => page.evaluate(() => state.activeTaskId);
const mode = (page) => page.evaluate(() => state.timerMode);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false });
  await stubConfirm(page, true);
});

// The server's running_block/break singletons persist across tests (shared DB),
// so a test that ends mid-block would rehydrate into the next one. Clear both.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    if (state.activeBlock) { try { await finishBlock(false); } catch {} }
    try { await api("/api/break", { method: "DELETE" }); } catch {}
  });
});

test("VAL-BREAK-001: completed pomo keeps its task; next pomo resumes it", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("BR"));
  await startBlockAt(page, tid, 0.6); // ≥1/3 → credit

  await page.locator("#skip-btn").click();
  await expect(page.locator("#credit-modal")).toBeVisible();
  await page.locator("#credit-confirm").click();

  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  await expect.poll(() => mode(page)).toBe("shortBreak");
  expect(await selected(page)).toBe(tid); // carried through the break

  // Back to a pomodoro and start → resumes the same task.
  await page.locator('.timer-tab[data-mode="pomodoro"]').click();
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock);
  expect(await activeTask(page)).toBe(tid);
});

test("VAL-BREAK-002: skip <1/3 discards but still keeps the task selected", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("BR"));
  await startBlockAt(page, tid, 0.1); // <1/3 → discard (confirm=true)

  await page.locator('.timer-tab[data-mode="shortBreak"]').click();
  await expect(page.locator("#credit-modal")).toBeHidden();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  await expect.poll(() => mode(page)).toBe("shortBreak");
  expect(await selected(page)).toBe(tid);
});

test("VAL-BREAK-003: marking the carried task done detaches it", async ({ page }) => {
  const { item, tid } = await addTodo(page, uniq("BR"));
  await startBlockAt(page, tid, 0.6);
  await page.locator("#skip-btn").click();
  await page.locator("#credit-confirm").click();
  await expect.poll(() => selected(page)).toBe(tid); // carried

  await rowAction(item, "toggle"); // mark done
  await expect.poll(() => selected(page)).toBe(null);
});

test("VAL-BREAK-004: a taskless block carries nothing", async ({ page }) => {
  await page.evaluate(() => { state.selectedTaskId = null; updateTimerControls(); });
  await page.locator("#timer-btn").click(); // taskless start
  await page.waitForFunction(() => !!state.activeBlock && state.activeTaskId === null);
  await page.evaluate(() => {
    clearTimerInterval();
    state.remainingSeconds = Math.round(state.activeBlock.durationMin * 60 * 0.4);
  });

  await page.locator("#skip-btn").click();
  await expect(page.locator("#credit-modal")).toBeVisible(); // untethered credit
  await page.locator("#credit-confirm").click();

  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await selected(page)).toBe(null);
});
