// End-to-end test for the stateless-block timer, mirroring docs/timer-states.md.
//
// Run by evaluating this whole file in a browser pointed at a running app
// (a clean test server). It drives the real DOM/state and returns a JSON
// report { passed, failedCount, failed }. Used via cmux browser eval; it does
// NOT depend on browser-harness.
//
//   SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
//
// Assumes the app globals `state`, `api`, `syncNow`, `saveSettings`,
// `updateTimerControls`, `timerIsPaused`, `t` are reachable (app.js is a
// classic script, so its top-level bindings are in scope for eval).

// The run takes ~20s; cmux `browser eval` resolves faster than that, so the
// final report is also stashed on `window.__e2e` (null until done). Callers
// can `browser wait --function "window.__e2e!==null"` then read it.
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

  // Deterministic settings (ignore any persisted localStorage values).
  const setSettings = (over) => {
    state.settings = {
      ...state.settings,
      defaultDuration: 30,
      shortRest: 5,
      longRest: 20,
      longEvery: 3,
      autoStartPomodoros: false,
      autoStartRest: false,
      ...over,
    };
    saveSettings(state.settings);
    state.pendingDuration = state.settings.defaultDuration;
    updateTimerControls();
  };

  // Start a fresh block on a task id (direct select avoids toggle ambiguity).
  const start = async (id) => {
    state.selectedTaskId = id;
    updateTimerControls();
    el("#timer-btn").click();
    await waitFor(() => !!state.activeBlock && state.running);
  };
  // Force the deadline-based timer to expire and wait for the credit modal.
  const expire = async () => {
    state.deadline = Date.now() - 1000;
    await waitFor(() => el("#credit-modal").hidden === false);
  };
  // Confirm the completion checklist, optionally unchecking some task ids;
  // wait until the block is fully cleared (credit POST + sync done).
  const confirmCredit = async (uncheck = []) => {
    for (const id of uncheck) {
      const box = [...document.querySelectorAll("#credit-list input")].find(
        (c) => Number(c.dataset.id) === id,
      );
      if (box) box.checked = false;
    }
    el("#credit-confirm").click();
    await waitFor(() => state.activeBlock === null && el("#credit-modal").hidden === true);
  };
  const abortEsc = async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await waitFor(() => state.activeBlock === null);
  };

  // ---- setup ----
  setSettings();
  window.confirm = () => true;
  const sfx = Date.now().toString().slice(-5);
  const A = "E2E-A-" + sfx;
  const B = "E2E-B-" + sfx;
  const C = "E2E-C-" + sfx;
  for (const nm of [A, B, C]) {
    await api("/api/tasks", { method: "POST", body: JSON.stringify({ raw: nm }) });
  }
  await syncNow();
  // Make the run independent of leftover state: end any open block lingering
  // server-side (from a prior run), then clear client timer state.
  for (let i = 0; i < 5; i++) {
    const rb = state.dashboard && state.dashboard.running_block;
    if (!rb) break;
    await api(`/api/blocks/${rb.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: false }),
    });
    await syncNow();
  }
  state.rehydrated = true;
  clearTimerInterval();
  state.activeBlock = null;
  state.activeTaskId = null;
  state.touchedTaskIds = new Set();
  state.running = false;
  const aId = idOf(A);
  const bId = idOf(B);
  const cId = idOf(C);

  // ---- VAL-13: first-load paused guard (pure logic) ----
  state.selectedTaskId = null;
  state.activeBlock = null;
  state.running = false;
  state.remainingSeconds = 0;
  check("VAL13: remaining 0 is not paused", timerIsPaused() === false);
  state.remainingSeconds = 60;
  check("VAL13: 0<remaining<full is paused", timerIsPaused() === true);
  state.remainingSeconds = 1800;
  check("VAL13: remaining==full is not paused", timerIsPaused() === false);

  // ---- VAL-1: idle, no auto-select (init like a fresh load) ----
  state.activeBlock = null;
  state.running = false;
  state.remainingSeconds = 0;
  state.selectedTaskId = null;
  applySettingsToControls(); // inits the idle clock
  updateTimerControls(); // refreshes the task label
  check("VAL1: no auto-select", state.selectedTaskId === null);
  check("VAL1: START disabled when none", el("#timer-btn").disabled === true);
  check("VAL1: label = no task", el("#current-task").textContent === t("timer.noTask"));
  check("VAL1: clock = full duration", el("#timer-display").textContent === "30:00");

  // ---- VAL-2: select / deselect toggle ----
  clickRow(aId);
  check("VAL2: select sets id", state.selectedTaskId === aId);
  check("VAL2: START enabled", el("#timer-btn").disabled === false);
  check("VAL2: row highlighted", row(aId).classList.contains("active"));
  clickRow(aId);
  check("VAL2: deselect clears", state.selectedTaskId === null);
  check("VAL2: START disabled again", el("#timer-btn").disabled === true);

  // ---- VAL-3: start a block ----
  await start(aId);
  check("VAL3: activeBlock open", !!state.activeBlock);
  check("VAL3: activeTaskId = A", state.activeTaskId === aId);
  check("VAL3: running", state.running === true);
  check("VAL3: touched = {A}", state.touchedTaskIds.size === 1 && state.touchedTaskIds.has(aId));
  check("VAL3: only the active row is highlighted", document.querySelectorAll(".task-item.active").length === 1 && row(aId).classList.contains("active"));

  // ---- VAL-7: pause / resume ----
  el("#timer-btn").click(); // pause
  await sleep(300);
  const pausedRemaining = state.remainingSeconds;
  check("VAL7: pause stops running", state.running === false);
  await sleep(1100);
  check("VAL7: paused clock frozen", state.remainingSeconds === pausedRemaining);
  check("VAL7: block kept while paused", !!state.activeBlock);
  el("#timer-btn").click(); // resume
  await sleep(300);
  check("VAL7: resume runs", state.running === true);
  check("VAL7: resume same block", !!state.activeBlock);

  // ---- VAL-4: switch (decline then accept) ----
  window.confirm = () => false;
  clickRow(bId);
  await sleep(150);
  check("VAL4: declined keeps A", state.activeTaskId === aId);
  check("VAL4: declined touched still 1", state.touchedTaskIds.size === 1);
  window.confirm = () => true;
  const dBefore = state.deadline;
  clickRow(bId);
  await sleep(150);
  check("VAL4: accepted active = B", state.activeTaskId === bId);
  check("VAL4: touched grows to 2", state.touchedTaskIds.size === 2);
  check("VAL4: still running", state.running === true);
  check("VAL4: deadline unchanged", state.deadline === dBefore);

  // ---- VAL-5: chips + remove ----
  clickRow(cId);
  await sleep(150);
  check("VAL5: touched = 3", state.touchedTaskIds.size === 3);
  check("VAL5: only one row highlighted (active), not all touched", document.querySelectorAll(".task-item.active").length === 1 && row(cId).classList.contains("active"));
  check("VAL5: 3 chips", document.querySelectorAll(".touched-chip").length === 3);
  check("VAL5: active chip has no remove", !document.querySelector(".touched-chip.active .chip-x"));
  check("VAL5: 2 removable", document.querySelectorAll(".chip-x").length === 2);
  el(`[data-chip-remove="${bId}"]`).click();
  await sleep(150);
  check("VAL5: removed B from touched", !state.touchedTaskIds.has(bId));
  check("VAL5: touched = 2", state.touchedTaskIds.size === 2);

  // ---- VAL-6: restart (same block, full clock, exact touched {A,C}) ----
  const blockId = state.activeBlock.id;
  el("#restart-btn").click();
  await sleep(200);
  check("VAL6: same block id", state.activeBlock.id === blockId);
  check("VAL6: clock back to full", state.remainingSeconds > 1790);
  check(
    "VAL6: touched preserved {A,C}",
    state.touchedTaskIds.size === 2 &&
      state.touchedTaskIds.has(aId) &&
      state.touchedTaskIds.has(cId) &&
      !state.touchedTaskIds.has(bId),
  );

  // ---- VAL-8: completion credit (checklist defaults checked; uncheck A) ----
  const streakBefore = state.streakBlocks;
  await expire();
  check("VAL8: credit modal shown", el("#credit-modal").hidden === false);
  check("VAL8: checklist lists touched 2", document.querySelectorAll("#credit-list input").length === 2);
  check(
    "VAL8: all boxes checked by default",
    [...document.querySelectorAll("#credit-list input")].every((c) => c.checked),
  );
  await confirmCredit([aId]); // drop A
  check("VAL8: C credited +1", bd(C) === 1);
  check("VAL8: A unchecked -> 0", bd(A) === 0);
  check("VAL8: B removed earlier -> 0", bd(B) === 0);
  check("VAL8: streak +1 once", state.streakBlocks === streakBefore + 1);
  check("VAL8: block cleared", state.activeBlock === null);
  check("VAL8: transitions to short rest", state.timerMode === "shortBreak");

  // ---- VAL-9: abort paths (Esc + Skip) ----
  state.streakBlocks = 0;
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await start(aId);
  const aBeforeEsc = bd(A);
  await abortEsc();
  check("VAL9: Esc clears block", state.activeBlock === null);
  check("VAL9: Esc no credit", bd(A) === aBeforeEsc);
  check("VAL9: exit clears list highlight", document.querySelectorAll(".task-item.active").length === 0);
  check("VAL9: exit clears timer label", el("#current-task").textContent === t("timer.noTask"));

  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await start(aId);
  const aBeforeSkip = bd(A);
  el("#skip-btn").click(); // skip -> confirm (window.confirm true) -> abort to break
  await waitFor(() => state.activeBlock === null);
  check("VAL9: Skip clears block", state.activeBlock === null);
  check("VAL9: Skip no credit", bd(A) === aBeforeSkip);

  // ---- VAL-11: long break when streak hits the interval ----
  setSettings({ longEvery: 1 }); // every completion lands on a long break
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await start(aId);
  await expire();
  await confirmCredit();
  check("VAL11: long break at interval", state.timerMode === "longBreak");

  // ---- VAL-10: auto-start rest, then auto-start next pomodoro ----
  setSettings({ longEvery: 3, autoStartRest: true, autoStartPomodoros: true });
  state.streakBlocks = 0;
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await start(cId);
  await expire();
  await confirmCredit(); // credit C, then auto-start the break
  check("VAL10: auto-started rest", state.timerMode === "shortBreak" && state.running === true);
  // finish the break -> auto-start next pomodoro (rest completion has no modal)
  state.deadline = Date.now() - 1000;
  await waitFor(() => state.timerMode === "pomodoro" && !!state.activeBlock);
  check("VAL10: auto-started next pomodoro", state.timerMode === "pomodoro" && !!state.activeBlock);

  // cleanup: abort any running block and restore quiet settings
  if (state.activeBlock) await abortEsc();
  setSettings();

  // ---- VAL-BRK: a running break survives a refresh ----
  // (drives state + the load-time rehydrate path directly; no real reload.)
  clearTimerInterval();
  state.activeBlock = null;
  state.timerMode = "shortBreak";
  startCountdown(300, advanceAfterComplete); // 5:00 break -> running + deadline
  const brkSaved = JSON.parse(localStorage.getItem("pomotodo.break") || "null");
  check(
    "VAL-BRK-001: running break persisted",
    !!brkSaved && brkSaved.mode === "shortBreak" && typeof brkSaved.deadline === "number",
  );

  // simulate reload: drop live timer state, no server block, re-run rehydrate.
  // Mimic init's idle-pomodoro render firing BEFORE the async rehydrate — it
  // must not wipe the saved break key.
  clearTimerInterval();
  state.activeBlock = null;
  state.running = false;
  state.deadline = null;
  state.remainingSeconds = 0;
  state.rehydrated = false;
  state.dashboard.running_block = null;
  state.timerMode = "pomodoro";
  renderTimer(); // pre-rehydrate idle render
  check(
    "VAL-BRK-002: break key survives pre-rehydrate render",
    localStorage.getItem("pomotodo.break") !== null,
  );
  maybeRehydrateTimer();
  await sleep(50);
  check(
    "VAL-BRK-002: break restored on reload",
    state.timerMode === "shortBreak" &&
      state.running === true &&
      state.remainingSeconds > 0,
  );

  await switchMode("pomodoro", { auto: false });
  check(
    "VAL-BRK-003: break key cleared on pomodoro",
    localStorage.getItem("pomotodo.break") === null,
  );

  // pomodoro wins over a stale saved break
  localStorage.setItem(
    "pomotodo.break",
    JSON.stringify({ mode: "shortBreak", deadline: Date.now() + 300000 }),
  );
  clearTimerInterval();
  state.activeBlock = null;
  state.running = false;
  state.timerMode = "shortBreak";
  state.rehydrated = false;
  state.dashboard.running_block = {
    id: 999999,
    task_id: aId,
    duration_min: 30,
    started_at: new Date().toISOString(),
  };
  maybeRehydrateTimer();
  await sleep(50);
  check(
    "VAL-BRK-004: pomodoro wins over stale break",
    state.timerMode === "pomodoro" && !!state.activeBlock,
  );

  // cleanup the break probe (the 999999 block is fake/server-less, so clear
  // state directly instead of an abort that would 404)
  clearTimerInterval();
  state.activeBlock = null;
  state.activeTaskId = null;
  state.running = false;
  state.deadline = null;
  localStorage.removeItem("pomotodo.break");
  state.dashboard.running_block = null;
  setSettings();

  // ---- VAL-TAB: tab title is a pure projection of timer state ----
  // Self-contained: drives state directly (no server). The app.js classic-script
  // globals updateTabTitle/formatTime/t/timerIsPaused are in eval scope; full
  // pomodoro duration here is pendingDuration*60 = 1800 after setSettings().
  state.timerMode = "pomodoro";
  state.activeTaskId = aId;
  state.running = true;
  state.remainingSeconds = 1234; // 20:34
  updateTabTitle();
  check(
    "VAL-TAB-001: work title = timer · Work: task",
    document.title === formatTime(1234) + " · " + t("tab.work") + ": " + A,
  );

  const tabT1 = document.title;
  state.remainingSeconds = 1233; // one second elapsed
  updateTabTitle();
  check(
    "VAL-TAB-005: title tracks the countdown",
    document.title !== tabT1 &&
      document.title ===
        formatTime(state.remainingSeconds) + " · " + t("tab.work") + ": " + A,
  );

  state.timerMode = "shortBreak";
  state.remainingSeconds = 240; // 04:00
  updateTabTitle();
  check(
    "VAL-TAB-002: rest title = timer · Rest, no task",
    document.title === formatTime(240) + " · " + t("tab.rest") &&
      !document.title.includes(": "),
  );

  state.timerMode = "pomodoro";
  state.running = false;
  state.remainingSeconds = 723; // 0 < remaining < full(1800) -> paused
  check("VAL-TAB-003 precondition: paused", timerIsPaused() === true);
  updateTabTitle();
  check(
    "VAL-TAB-003: paused title is marked and frozen",
    document.title === "⏸ " + formatTime(723) + " · " + t("tab.work") + ": " + A,
  );

  state.running = false;
  state.remainingSeconds = 0; // no active run -> idle
  updateTabTitle();
  check("VAL-TAB-004: idle restores default title", document.title === "Pomotodo");

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((r) => r.name),
  });
  return window.__e2e;
})();
