// Tier 2: a paused pomodoro must survive a reload as paused — restored at the
// same remaining, NOT fast-forwarded to finished by the old started_at+duration
// heuristic (which counted paused time as elapsed).
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

// Shared server singletons persist across the throwaway DB; clear any leftover
// open block / break so this test can't bleed into the next.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    if (state.activeBlock) { try { await finishBlock(false); } catch {} }
    try { await api("/api/break", { method: "DELETE" }); } catch {}
  });
});

test("paused pomodoro survives a reload", async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false });

  const { tid } = await addTodo(page, uniq("PR"));
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);

  // Simulate ~10 min elapsed (600s left), let the ticker catch up, then pause.
  await page.evaluate(() => { state.deadline = Date.now() + 600 * 1000; });
  await expect.poll(() => page.evaluate(() => state.remainingSeconds)).toBeLessThanOrEqual(601);
  await page.locator("#timer-btn").click(); // pause
  await expect.poll(() => page.evaluate(() => state.running)).toBe(false);
  const pausedRemaining = await page.evaluate(() => state.remainingSeconds);

  // Wait for the paused state to reach the server before reloading.
  await expect.poll(() => page.evaluate(async () => {
    const d = await api("/api/dashboard");
    return d.running_block ? d.running_block.paused_remaining_s : null;
  })).toBe(pausedRemaining);

  await page.reload();
  await page.waitForFunction(
    () => typeof state !== "undefined" && state.dashboard !== null,
  );

  // Restored as a paused pomodoro at the same remaining — not finished.
  await expect.poll(() => page.evaluate(() => state.timerMode)).toBe("pomodoro");
  expect(await page.evaluate(() => state.running)).toBe(false);
  expect(await page.evaluate(() => !!state.activeBlock)).toBe(true);
  await expect(page.locator("#credit-modal")).toBeHidden();
  const restored = await page.evaluate(() => state.remainingSeconds);
  expect(Math.abs(restored - pausedRemaining)).toBeLessThanOrEqual(2);
});

test("running pomodoro resumes from the absolute deadline after reload", async ({ page }) => {
  await gotoApp(page);
  await setSettings(page, { autoStartRest: false });

  const { tid } = await addTodo(page, uniq("PR"));
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);

  // 600s left, running. Wait for the deadline to land server-side, then reload.
  await page.evaluate(() => { state.deadline = Date.now() + 600 * 1000; renderTimer(); });
  await expect.poll(() => page.evaluate(async () => {
    const d = await api("/api/dashboard");
    return d.running_block ? d.running_block.deadline_ms : null;
  })).not.toBeNull();

  await page.reload();
  await page.waitForFunction(
    () => typeof state !== "undefined" && state.dashboard !== null,
  );

  await expect.poll(() => page.evaluate(() => state.running)).toBe(true);
  const remaining = await page.evaluate(() => state.remainingSeconds);
  expect(remaining).toBeGreaterThan(550);
  expect(remaining).toBeLessThanOrEqual(601);
});
