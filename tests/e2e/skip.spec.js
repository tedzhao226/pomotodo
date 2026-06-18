// Skip a running work block into a break: ≥1/3 elapsed credits it (credit
// checklist, like a natural end); <1/3 discards (confirmed). Break = chosen tab.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo } from "./_helpers.js";

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
const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);
const streak = (page) => page.evaluate(() => state.streakBlocks);
const mode = (page) => page.evaluate(() => state.timerMode);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false });
  await stubConfirm(page, true);
});

test("VAL-SKIP-001/003: skip ≥1/3 via Long Break tab credits the block, goes to long break", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("SK"));
  const before = await bd(page, tid);
  const s0 = await streak(page);
  await startBlockAt(page, tid, 0.6); // past 1/3

  await page.locator('.timer-tab[data-mode="longBreak"]').click();
  await expect(page.locator("#credit-modal")).toBeVisible(); // natural-end credit checklist
  await page.locator("#credit-confirm").click();

  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, tid)).toBe(before + 1);
  expect(await streak(page)).toBe(s0 + 1);
  expect(await mode(page)).toBe("longBreak");
});

test("VAL-SKIP-002: skip <1/3 discards (confirmed), no credit, goes to chosen break", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("SK"));
  const before = await bd(page, tid);
  await startBlockAt(page, tid, 0.1); // under 1/3

  await page.locator('.timer-tab[data-mode="shortBreak"]').click(); // confirm=true (stub)
  await expect(page.locator("#credit-modal")).toBeHidden(); // discard path, no credit modal
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, tid)).toBe(before); // not credited
  expect(await mode(page)).toBe("shortBreak");
});

test("VAL-SKIP-004: ⏭ button ≥1/3 credits to a short break", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("SK"));
  const before = await bd(page, tid);
  await startBlockAt(page, tid, 0.5);

  await page.locator("#skip-btn").click();
  await expect(page.locator("#credit-modal")).toBeVisible();
  await page.locator("#credit-confirm").click();

  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, tid)).toBe(before + 1);
  expect(await mode(page)).toBe("shortBreak");
});
