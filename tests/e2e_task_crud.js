// End-to-end test: task CRUD in the Todos panel — add a todo, select it,
// toggle done/active, inline-edit the name, and soft-delete it.
//
// Run by evaluating this whole file in a browser pointed at a running app
// (a clean test server). Drives the real DOM/state and returns a JSON report
// { passed, failedCount, failed }. Used via cmux browser eval; it does NOT
// depend on browser-harness.
//
//   SCRIPT=$(cat tests/e2e_task_crud.js); cmux browser eval --surface <id> "$SCRIPT"
//
// cmux eval may resolve before the run finishes, so the report is also stashed
// on window.__e2e (null until done):
//   cmux browser wait --surface <id> --function "window.__e2e!==null"
(async () => {
  window.__e2e = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (cond, ms = 5000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (cond()) return true;
      await sleep(80);
    }
    return false;
  };
  const results = [];
  const check = (name, cond) => results.push({ name, ok: !!cond });

  const inToday = (name) =>
    [...document.querySelectorAll("#today-list .task-row .task-name")].some(
      (x) => x.textContent === name,
    );
  const rowId = (name) => {
    const r = [...document.querySelectorAll("#today-list .task-row")].find(
      (x) => x.querySelector(".task-name").textContent === name,
    );
    return r ? Number(r.dataset.id) : null;
  };
  const statusOf = (tid) => {
    const task = state.dashboard.tasks.find((x) => x.id === tid);
    return task ? task.status : null;
  };
  const action = (tid, act) =>
    document
      .querySelector(`#today-list .task-item[data-id='${tid}'] [data-action='${act}']`)
      .click();

  window.confirm = () => true; // auto-accept the delete confirmation
  const name = "CRUD" + Date.now().toString().slice(-5);

  // ---- add (via the real form) ----
  const input = document.getElementById("task-input");
  input.value = name;
  input.closest("form").requestSubmit();
  await waitFor(() => inToday(name));
  check("add: task appears in Today", inToday(name) === true);

  const tid = rowId(name);
  check("add: task has a server id", Number.isInteger(tid) && tid > 0);

  // ---- VAL-ICON-001: row controls use the mono glyph set, no colour emoji ----
  const rowEl = document.querySelector(`#today-list .task-row[data-id='${tid}']`);
  const glyph = (act) =>
    (rowEl.querySelector(`[data-action='${act}']`) || {}).textContent?.trim();
  check("icons: move glyph is ↓ (today→backlog)", glyph("move") === "↓");
  check("icons: edit glyph is ✎", glyph("edit") === "✎");
  check("icons: delete glyph is ✕", glyph("delete") === "✕");
  check(
    "icons: no colour emoji in row controls",
    !/🗑|🗒/.test(rowEl.querySelector(".row-actions").textContent),
  );

  // ---- activate (clicking the row selects the task) ----
  document.querySelector(`#today-list .task-row[data-id='${tid}']`).click();
  await waitFor(() => state.selectedTaskId === tid);
  check("activate: task is selected", state.selectedTaskId === tid);

  // ---- toggle -> done ----
  action(tid, "toggle");
  await waitFor(() => statusOf(tid) === "done");
  check("toggle: status is done", statusOf(tid) === "done");
  check(
    "toggle: row shows done state",
    document
      .querySelector(`#today-list .task-item[data-id='${tid}']`)
      .classList.contains("is-done") === true,
  );

  // ---- toggle -> active ----
  action(tid, "toggle");
  await waitFor(() => statusOf(tid) === "active");
  check("toggle: status is active again", statusOf(tid) === "active");

  // ---- inline edit the name ----
  const newName = name + "X";
  action(tid, "edit");
  await waitFor(
    () => !!document.querySelector(`#today-list .task-item[data-id='${tid}'] [data-field='name']`),
  );
  const li = document.querySelector(`#today-list .task-item[data-id='${tid}']`);
  li.querySelector("[data-field='name']").value = newName;
  li.querySelector("[data-action='save']").click();
  await waitFor(() => inToday(newName));
  check("edit: new name shown", inToday(newName) === true);
  check("edit: old name gone", inToday(name) === false);

  // ---- delete ----
  action(tid, "delete");
  await waitFor(() => !inToday(newName));
  check("delete: task removed from Today", inToday(newName) === false);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((r) => r.name),
  });
  return window.__e2e;
})();
