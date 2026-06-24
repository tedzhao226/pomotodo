// Credit-on-finish bug fixes:
//  - BUG-3: the Today log shows the credit record (note), not just the task name.
//  - BUG-2: a failed credit POST keeps the finished block and re-opens the modal
//    so the user can retry, instead of stranding (and later losing) the pomo.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo, expireTimer } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

// Start a work block on a task and let its countdown elapse → credit modal opens.
async function finishBlockOn(page, tid) {
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
  await expireTimer(page);
  await expect(page.locator("#credit-modal")).toBeVisible();
}

const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false });
});

test("VAL-BUG3-001: Today log shows the credit record on an assigned pomo", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("B3"));
  const record = uniq("shipped-the-release ");
  await finishBlockOn(page, tid);

  await page.fill("#credit-record", record);
  await page.locator("#credit-confirm").click();

  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  await expect(page.locator("#today-log")).toContainText(record);
});

test("VAL-BUG2-001: a failed credit keeps the block and re-opens the modal to retry", async ({ page }) => {
  const { tid } = await addTodo(page, uniq("B2"));
  const before = await bd(page, tid);

  // Fail only the first /credit POST, then let the retry through.
  let failedOnce = false;
  await page.route("**/blocks/*/credit", (route) => {
    if (!failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"boom"}' });
    }
    return route.continue();
  });

  await finishBlockOn(page, tid);
  await page.locator("#credit-confirm").click();

  // Failure must not strand the pomo: block stays, modal re-opens for the retry.
  await expect(page.locator("#credit-modal")).toBeVisible();
  expect(await page.evaluate(() => state.activeBlock)).not.toBeNull();

  // Retry succeeds → credited exactly once.
  await page.locator("#credit-confirm").click();
  await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
  expect(await bd(page, tid)).toBe(before + 1);
});
