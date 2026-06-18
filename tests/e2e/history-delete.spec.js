// Migrated from tests/e2e_history_delete.js — permanent (hard) delete of history
// entries: cancel is a no-op, confirmed pomo delete decrements, todo delete
// cascades to its pomos.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, evalApi } from "./_helpers.js";

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
});

test("history hard-delete: cancel no-op, pomo delete decrements, todo delete cascades", async ({ page }) => {
  const sfx = Date.now().toString().slice(-6);
  const T = "E2E-DEL-" + sfx;
  await stubConfirm(page, true);

  // seed: one todo with two completed pomos (via the app's api()).
  await evalApi(page, "/api/tasks", { method: "POST", body: JSON.stringify({ raw: T }) });
  await page.evaluate(() => syncNow());
  const tId = await page.evaluate((n) => (state.dashboard.tasks.find((x) => x.name === n) || {}).id, T);
  expect(tId).toBeTruthy();
  for (let i = 0; i < 2; i++) {
    const block = await evalApi(page, `/api/tasks/${tId}/blocks`, { method: "POST", body: JSON.stringify({ duration_min: 25 }) });
    await evalApi(page, `/api/blocks/${block.id}/credit`, { method: "POST", body: JSON.stringify({ task_ids: [tId], note: "rec " + sfx }) });
  }
  await page.evaluate(() => syncNow());
  await page.locator('.nav-btn[data-view="history"]').click();
  await page.evaluate(() => openHistory()); // load history and await it (like the original)
  await page.waitForFunction(
    (id) => state.history && state.history.pomos.filter((p) => p.task_id === id).length === 2,
    tId,
  );

  const pomoCount = () => page.evaluate((id) => state.history.pomos.filter((p) => p.task_id === id).length, tId);
  const hasTodo = () => page.evaluate((id) => !!state.history.todos.find((x) => x.id === id), tId);
  const pomosTotal = () => page.evaluate(() => state.history.pomosTotal);
  const todosTotal = () => page.evaluate(() => state.history.todosTotal);
  const firstPomoId = await page.evaluate((id) => state.history.pomos.filter((p) => p.task_id === id)[0].id, tId);
  const pomoDel = (id) => page.locator(`#view-history .row-delete[data-action="delete-pomo"][data-id="${id}"]`);
  const todoDel = (id) => page.locator(`#view-history .row-delete[data-action="delete-todo"][data-id="${id}"]`);

  // seed assertions
  expect(await pomoCount()).toBe(2);
  expect(await hasTodo()).toBe(true);
  expect(await page.evaluate((id) => state.history.pomos.filter((p) => p.task_id === id).every((p) => Number.isInteger(p.id)), tId)).toBe(true);

  // VAL-ICON-002: delete glyphs are ✕, no 🗑
  expect((await pomoDel(firstPomoId).innerText()).trim()).toBe("✕");
  expect((await todoDel(tId).innerText()).trim()).toBe("✕");
  expect(await page.locator("#view-history").innerText()).not.toMatch(/🗑/);

  // VAL-VIS-001: delete buttons visible at rest (opacity > 0)
  expect(await pomoDel(firstPomoId).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);
  expect(await todoDel(tId).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);

  // VAL-HD-004: cancel is a no-op
  await stubConfirm(page, false);
  const totalBefore = await pomosTotal();
  await pomoDel(firstPomoId).dispatchEvent("click");
  await page.waitForTimeout(600);
  expect(await pomoCount()).toBe(2);
  expect(await pomosTotal()).toBe(totalBefore);

  // VAL-HD-004: confirmed pomo delete removes the row + decrements total
  await stubConfirm(page, true);
  await pomoDel(firstPomoId).dispatchEvent("click");
  await expect.poll(pomoCount).toBe(1);
  expect(await pomosTotal()).toBe(totalBefore - 1);
  await expect(pomoDel(firstPomoId)).toHaveCount(0);

  // VAL-HD-004 / VAL-HD-002: confirmed todo delete cascades to its pomos
  const todosBefore = await todosTotal();
  await todoDel(tId).dispatchEvent("click");
  await expect.poll(hasTodo).toBe(false);
  expect(await todosTotal()).toBe(todosBefore - 1);
  expect(await pomoCount()).toBe(0);
});
