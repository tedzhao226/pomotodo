// Regression: adding a task via the top bar while an inline editor is open must
// still surface the new task in the list — without clobbering the editor's
// unsaved input or stealing its focus/caret.
//
// Root cause: renderTaskList() short-circuited whenever an editor was open (to
// stop a background sync from rebuilding the editor and wiping typed text). The
// post-create syncNow() hit that same guard, so a task added while editing
// never appeared until the editor closed. Fix: reuse the live editor node
// across the re-render and restore focus, so the list refreshes either way.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, addTodo, rowAction } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
});

test("a task added while editing another appears, editor input survives", async ({
  page,
}) => {
  const existing = uniq("EDIT");
  const { item } = await addTodo(page, existing);

  // Open the inline editor and type unsaved text into the name field.
  await rowAction(item, "edit");
  const nameField = item.locator('[data-field="name"]');
  await expect(nameField).toBeVisible();
  await nameField.click();
  await nameField.fill("HALF-TYPED");

  // Add a new task via the top bar while the editor is still open.
  const added = uniq("ADDED");
  await page.fill("#task-input", added);
  await page.press("#task-input", "Enter");

  // New task shows up in the list...
  await expect(
    page.locator("#today-list .task-item").filter({ hasText: added }),
  ).toBeVisible();
  // ...and the editor is intact: still open with its unsaved text (the re-render
  // reused the live node instead of rebuilding it from the saved task name).
  await expect(nameField).toBeVisible();
  await expect(nameField).toHaveValue("HALF-TYPED");
});
