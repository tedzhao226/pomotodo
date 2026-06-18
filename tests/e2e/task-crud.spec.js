// Migrated from tests/e2e_task_crud.js — add, select, toggle done/active,
// inline-edit, delete, and the done-sinks-to-bottom behaviour.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo, rowAction, expectState } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
  await stubConfirm(page, true);
});

test("add → select → toggle → edit → delete", async ({ page }) => {
  const name = uniq("CRUD");
  const { item, tid } = await addTodo(page, name);
  expect(Number.isInteger(tid) && tid > 0).toBe(true);

  // VAL-ICON-001: row controls use mono glyphs, no colour emoji.
  const glyph = (a) => item.locator(`[data-action="${a}"]`).innerText();
  expect((await glyph("move")).trim()).toBe("↓");
  expect((await glyph("edit")).trim()).toBe("✎");
  expect((await glyph("delete")).trim()).toBe("✕");
  expect(await item.locator(".row-actions").innerText()).not.toMatch(/🗑|🗒/);

  // activate (clicking the row selects the task)
  await rowAction(item, "activate");
  await expectState(page, () => state.selectedTaskId, tid);
  await expect(item).toHaveClass(/active/);

  // toggle -> done
  await rowAction(item, "toggle");
  await expect(item).toHaveClass(/is-done/);
  await expect
    .poll(() => page.evaluate((id) => state.dashboard.tasks.find((x) => x.id === id)?.status, tid))
    .toBe("done");

  // toggle -> active again
  await rowAction(item, "toggle");
  await expect(item).not.toHaveClass(/is-done/);

  // inline edit the name
  const newName = name + "X";
  await rowAction(item, "edit");
  const nameField = item.locator('[data-field="name"]');
  await expect(nameField).toBeVisible();
  await nameField.fill(newName);
  await rowAction(item, "save");
  await expect(page.locator("#today-list .task-name").filter({ hasText: newName })).toBeVisible();
  // Exact match: newName contains name as a substring, so use an anchored regex.
  await expect(page.locator("#today-list .task-name").filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(0);

  // delete
  await rowAction(item, "delete");
  await expect(item).toHaveCount(0);
});

test("done task sinks to the bottom of Today", async ({ page }) => {
  const sa = uniq("SA");
  const sb = uniq("SB");
  const a = await addTodo(page, sa);
  await addTodo(page, sb);

  await rowAction(a.item, "toggle"); // mark A done
  await expect(a.item).toHaveClass(/is-done/);

  const orderIds = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#today-list .task-row")].map((r) => Number(r.dataset.id)),
    );
  await expect.poll(async () => (await orderIds()).at(-1)).toBe(a.tid);
});
