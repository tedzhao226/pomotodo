// Migrated from tests/e2e_buckets.js — move Today<->Backlog, drag-reorder, pin
// to top, and pin hidden under a tag filter.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings, stubConfirm, addTodo, rowAction } from "./_helpers.js";

const sfx = () => Date.now().toString().slice(-5);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
  await stubConfirm(page, true);
});

const bucketOf = (page, tid) =>
  page.evaluate((id) => state.dashboard.tasks.find((x) => x.id === id)?.bucket, tid);
const inList = (page, list, name) =>
  page.locator(`${list} .task-name`).filter({ hasText: new RegExp(`^${name}$`) });
const order = (page, i1, i2) =>
  page.evaluate(([a, b]) =>
    [...document.querySelectorAll("#today-list .task-item")]
      .map((x) => Number(x.dataset.id))
      .filter((id) => id === a || id === b)
      .join(","), [i1, i2]);
// Re-sync until the server reflects the expected order (matches the old syncUntil).
async function syncUntilOrder(page, i1, i2, expected) {
  await expect
    .poll(async () => {
      await page.evaluate(() => syncNow());
      return order(page, i1, i2);
    }, { timeout: 7_000 })
    .toBe(expected);
}

test("move a task between Today and Backlog", async ({ page }) => {
  const mv = "MOVE" + sfx();
  const { tid } = await addTodo(page, mv);
  const item = page.locator(`.task-item[data-id="${tid}"]`);
  await expect(inList(page, "#today-list", mv)).toHaveCount(1);
  expect(await bucketOf(page, tid)).not.toBe("backlog");

  await rowAction(item, "move"); // -> backlog
  await expect(inList(page, "#backlog-list", mv)).toHaveCount(1);
  await expect(inList(page, "#today-list", mv)).toHaveCount(0);
  expect(await bucketOf(page, tid)).toBe("backlog");

  await rowAction(item, "move"); // -> today
  await expect(inList(page, "#today-list", mv)).toHaveCount(1);
  expect(await bucketOf(page, tid)).not.toBe("backlog");
});

test("drag-reorder within Today, persisted", async ({ page }) => {
  const a = "ORDA" + sfx();
  const b = "ORDB" + sfx();
  const ra = await addTodo(page, a);
  const rb = await addTodo(page, b);
  const [ia, ib] = [ra.tid, rb.tid];

  const before = await order(page, ia, ib);
  expect([`${ia},${ib}`, `${ib},${ia}`]).toContain(before);
  const [first, second] = before === `${ia},${ib}` ? [ia, ib] : [ib, ia];

  // The app's reorder is HTML5 DnD; dispatch the synthetic drag sequence in-page
  // (a real mouse drag won't fire the drag events the app listens to).
  await page.evaluate(({ first, second }) => {
    const items = [...document.querySelectorAll("#today-list .task-item")];
    const A = items.find((x) => Number(x.dataset.id) === first);
    const B = items.find((x) => Number(x.dataset.id) === second);
    const dt = new DataTransfer();
    A.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    const r = B.getBoundingClientRect();
    B.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientX: r.left + 5, clientY: r.top + r.height - 3 }));
    B.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
    A.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  }, { first, second });

  const expected = `${second},${first}`;
  await expect.poll(() => order(page, ia, ib)).toBe(expected);
  await syncUntilOrder(page, ia, ib, expected);
});

test("pin a task to the top; pin hidden under a tag filter", async ({ page }) => {
  const p1 = "PINA" + sfx();
  const p2 = "PINB" + sfx();
  const r1 = await addTodo(page, p1);
  const r2 = await addTodo(page, p2);
  const [ip1, ip2] = [r1.tid, r2.tid];

  const before = await order(page, ip1, ip2);
  expect([`${ip1},${ip2}`, `${ip2},${ip1}`]).toContain(before);
  const secondId = before === `${ip1},${ip2}` ? ip2 : ip1;
  const expected = `${secondId},${secondId === ip1 ? ip2 : ip1}`;

  await rowAction(page.locator(`.task-item[data-id="${secondId}"]`), "pin");
  await expect.poll(() => order(page, ip1, ip2)).toBe(expected);
  await syncUntilOrder(page, ip1, ip2, expected);

  // VAL-PIN-004: clicking the task's tag filters; pin must vanish under a filter.
  const tagChip = page.locator(`.task-item[data-id="${secondId}"] .tag-chip`);
  if (await tagChip.count()) {
    await tagChip.first().dispatchEvent("click");
    await expect(page.locator(`.task-item[data-id="${secondId}"] [data-action="pin"]`)).toHaveCount(0);
    await page.locator(".filter-indicator").dispatchEvent("click"); // clear filter
  }
});
