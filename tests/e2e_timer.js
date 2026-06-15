// End-to-end test for the stateless-block timer, mirroring docs/timer-states.md.
//
// Run by evaluating this whole file in a browser pointed at a running app
// (e.g. a clean test server). It drives the real DOM/state and returns a JSON
// report { passed, failed, results }. Used via cmux browser eval; it does not
// depend on browser-harness.
//
//   SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
//
// Assumes the app globals `state`, `api`, `syncNow` are reachable (app.js is a
// classic script, so its top-level consts are in scope for eval).

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  const check = (name, cond) => results.push({ name, ok: !!cond });

  const tasks = () => (state.dashboard ? state.dashboard.tasks : []);
  const byName = (n) => tasks().find((t) => t.name === n);
  const idOf = (n) => (byName(n) || {}).id;
  const bd = (n) => (byName(n) || {}).blocks_done;
  const row = (id) =>
    [...document.querySelectorAll(".task-item")].find(
      (li) => Number(li.dataset.id) === id,
    );
  const clickRow = (id) => row(id).querySelector(".task-row").click();
  const el = (s) => document.querySelector(s);

  // ---- setup: deterministic settings, fresh tasks ----
  state.settings.autoStartRest = false;
  state.settings.autoStartPomodoros = false;
  const sfx = Date.now().toString().slice(-5);
  const A = "E2E-A-" + sfx;
  const B = "E2E-B-" + sfx;
  const C = "E2E-C-" + sfx;
  for (const nm of [A, B, C]) {
    await api("/api/tasks", { method: "POST", body: JSON.stringify({ raw: nm }) });
  }
  await syncNow();
  const aId = idOf(A);
  const bId = idOf(B);
  const cId = idOf(C);

  // ---- 1. no auto-select; START disabled with nothing picked ----
  state.selectedTaskId = null;
  updateTimerControls();
  check("idle: no auto-select", state.selectedTaskId === null);
  check("idle: START disabled when none", el("#timer-btn").disabled === true);
  check("idle: label says no task", el("#current-task").textContent === t("timer.noTask"));
  check("idle: clock shows full duration", el("#timer-display").textContent === "30:00");

  // ---- 2. select toggles on ----
  clickRow(aId);
  check("select: selectedTaskId set", state.selectedTaskId === aId);
  check("select: START enabled", el("#timer-btn").disabled === false);
  check("select: row highlighted", row(aId).classList.contains("active"));

  // ---- 3. deselect toggles off ----
  clickRow(aId);
  check("deselect: cleared", state.selectedTaskId === null);
  check("deselect: START disabled again", el("#timer-btn").disabled === true);

  // ---- 4. start a block on A ----
  clickRow(aId);
  el("#timer-btn").click();
  await sleep(900);
  check("start: activeBlock open", !!state.activeBlock);
  check("start: activeTaskId = A", state.activeTaskId === aId);
  check("start: running", state.running === true);
  check("start: touched = {A}", state.touchedTaskIds.size === 1 && state.touchedTaskIds.has(aId));

  // ---- 5. switch declined -> no change ----
  window.confirm = () => false;
  clickRow(bId);
  await sleep(200);
  check("switch declined: still A", state.activeTaskId === aId);
  check("switch declined: touched still 1", state.touchedTaskIds.size === 1);

  // ---- 6. switch accepted -> active moves, timer continues ----
  window.confirm = () => true;
  const dBefore = state.deadline;
  clickRow(bId);
  await sleep(200);
  check("switch: active = B", state.activeTaskId === bId);
  check("switch: touched grows to 2", state.touchedTaskIds.size === 2);
  check("switch: still running", state.running === true);
  check("switch: deadline unchanged (timer continues)", state.deadline === dBefore);

  // ---- 7. switch to C, chip rendering ----
  clickRow(cId);
  await sleep(200);
  check("switch: touched = 3", state.touchedTaskIds.size === 3);
  check("chips: 3 rendered", document.querySelectorAll(".touched-chip").length === 3);
  check("chips: active has no remove", !document.querySelector(".touched-chip.active .chip-x"));
  check("chips: 2 removable", document.querySelectorAll(".chip-x").length === 2);

  // ---- 8. remove a touched chip (B) ----
  el(`[data-chip-remove="${bId}"]`).click();
  await sleep(200);
  check("remove chip: B dropped", !state.touchedTaskIds.has(bId));
  check("remove chip: touched = 2", state.touchedTaskIds.size === 2);

  // ---- 9. restart -> same block, clock reset, touched kept ----
  const blockId = state.activeBlock.id;
  el("#restart-btn").click();
  await sleep(200);
  check("restart: same block id", state.activeBlock.id === blockId);
  check("restart: clock back to full", state.remainingSeconds > 1790);
  check("restart: touched preserved (A,C)", state.touchedTaskIds.size === 2 && state.touchedTaskIds.has(cId));

  // ---- 10. complete -> credit checklist; uncheck A, confirm -> only C ----
  state.deadline = Date.now() - 1000; // deadline-based timer: force expiry
  await sleep(1600);
  check("complete: credit modal shown", el("#credit-modal").hidden === false);
  check("complete: checklist lists 2", document.querySelectorAll("#credit-list input").length === 2);
  const aBox = [...document.querySelectorAll("#credit-list input")].find(
    (c) => Number(c.dataset.id) === aId,
  );
  if (aBox) aBox.checked = false; // drop A from credit
  el("#credit-confirm").click();
  await sleep(1600);
  check("credit: C +1", bd(C) === 1);
  check("credit: A unchecked -> 0", bd(A) === 0);
  check("credit: B removed earlier -> 0", bd(B) === 0);
  check("credit: block cleared", state.activeBlock === null);

  // ---- 11. abort (Esc) -> no credit ----
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  clickRow(aId);
  el("#timer-btn").click();
  await sleep(900);
  const aBeforeAbort = bd(A);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await sleep(1200);
  check("abort: block cleared", state.activeBlock === null);
  check("abort: A not credited", bd(A) === aBeforeAbort);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((r) => r.name),
  });
})();
