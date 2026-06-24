// Confirm a finished pomo registers credit to its task in BOTH break modes:
//  - no break   (autoStartRest = false)
//  - auto break (autoStartRest = true)
// The credit modal must appear on finish, and Confirm must bump blocks_done by 1.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo, expireTimer } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

const bd = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((t) => t.id === id)?.blocks_done ?? 0, tid);

// The server's running_block/break singletons persist across tests (shared DB);
// clear both so an auto-break left running can't rehydrate into the next test.
test.afterEach(async ({ page }) => {
  await page.evaluate(async () => {
    if (state.activeBlock) { try { await finishBlock(false); } catch {} }
    try { await api("/api/break", { method: "DELETE" }); } catch {}
  });
});

async function finishBlockOn(page, tid) {
  await page.evaluate((id) => { state.selectedTaskId = id; updateTimerControls(); }, tid);
  await page.locator("#timer-btn").click();
  await page.waitForFunction(() => !!state.activeBlock && state.running);
  await expireTimer(page);
  await expect(page.locator("#credit-modal")).toBeVisible();
}

for (const autoStartRest of [false, true]) {
  const label = autoStartRest ? "auto break" : "no break";
  test(`finished pomo credits its task (${label})`, async ({ page }) => {
    await gotoApp(page);
    await setSettings(page, { autoStartRest });

    const { tid } = await addTodo(page, uniq("CR"));
    const before = await bd(page, tid);

    await finishBlockOn(page, tid);
    await page.locator("#credit-confirm").click();

    await expect.poll(() => page.evaluate(() => state.activeBlock)).toBe(null);
    await expect.poll(() => bd(page, tid)).toBe(before + 1);
  });

  // Race: a finished pomo sits in the credit modal; a SECOND tab/device starts a
  // new pomo, whose create_block sweep ends this full-duration leftover as a
  // completed pomo. Then the user clicks Confirm. The /credit POST must still
  // land — not 404 forever and re-open the modal in an endless retry loop.
  test(`finish + concurrent start still credits (${label})`, async ({ page }) => {
    await gotoApp(page);
    await setSettings(page, { autoStartRest });

    const { tid } = await addTodo(page, uniq("CR"));
    const before = await bd(page, tid);

    await finishBlockOn(page, tid);
    // The concurrent start's sweep finalizes this finished pomo: ended + completed.
    await page.evaluate(() => api(`/api/blocks/${state.activeBlock.id}`, {
      method: "PATCH", body: JSON.stringify({ completed: true }),
    }));

    await page.locator("#credit-confirm").click();

    // Confirm must converge: modal closes, block clears, pomo credited once.
    await expect.poll(
      () => page.evaluate(() => state.activeBlock),
      { timeout: 5000 },
    ).toBe(null);
    await expect.poll(() => bd(page, tid)).toBe(before + 1);
  });

  // Terminal case: the block was aborted server-side (a concurrent start swept it
  // mid-pomo, before its full duration). Credit 404s and can never land. Confirm
  // must reset to idle — NOT re-open the modal in an endless retry loop.
  test(`finish + aborted block resets to idle, no loop (${label})`, async ({ page }) => {
    await gotoApp(page);
    await setSettings(page, { autoStartRest });

    const { tid } = await addTodo(page, uniq("CR"));
    const before = await bd(page, tid);

    await finishBlockOn(page, tid);
    // Concurrent start swept this block as aborted (not completed).
    await page.evaluate(() => api(`/api/blocks/${state.activeBlock.id}`, {
      method: "PATCH", body: JSON.stringify({ completed: false }),
    }));

    await page.locator("#credit-confirm").click();

    // Loop must break: block clears, modal closes, no credit, back to pomodoro.
    await expect.poll(
      () => page.evaluate(() => state.activeBlock),
      { timeout: 5000 },
    ).toBe(null);
    await expect(page.locator("#credit-modal")).toBeHidden();
    await expect.poll(() => page.evaluate(() => state.timerMode)).toBe("pomodoro");
    await expect.poll(() => bd(page, tid)).toBe(before);
  });
}
