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
      soundEnabled: false,
      tickEnabled: false,
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
    // completeBlockWithCredit clears activeBlock before its trailing syncNow();
    // wait for the dashboard to reflect the credit so bd() reads are fresh.
    await syncNow();
  };
  const abortEsc = async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await waitFor(() => state.activeBlock === null);
    // The abort's sync + re-render run after activeBlock clears; let them settle
    // so the list highlight and timer label are updated before assertions.
    await syncNow();
    await sleep(60);
  };

  // ---- setup ----
  setSettings();
  check("VAL-SOUND-001: sound off in tests", state.settings.soundEnabled === false);
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
  check("VAL-FREE-001: START enabled when none", el("#timer-btn").disabled === false);
  check("VAL1: label = no task", el("#current-task").textContent === t("timer.noTask"));
  check("VAL1: clock = full duration", el("#timer-display").textContent === "30:00");

  // ---- VAL-2: select / deselect toggle ----
  clickRow(aId);
  check("VAL2: select sets id", state.selectedTaskId === aId);
  check("VAL2: START enabled", el("#timer-btn").disabled === false);
  check("VAL2: row highlighted", row(aId).classList.contains("active"));
  clickRow(aId);
  check("VAL2: deselect clears", state.selectedTaskId === null);
  check("VAL2: START enabled again after deselect", el("#timer-btn").disabled === false);


  // ---- VAL-FREE: taskless pomodoro start + Today-list credit ----
  const startTaskless = async () => {
    // Always start from a clean pomodoro tab: a prior completion may have left
    // the timer in break mode, where #timer-btn would start a break (no block).
    el('.timer-tab[data-mode="pomodoro"]').click();
    await sleep(150);
    state.selectedTaskId = null;
    updateTimerControls();
    el("#timer-btn").click();
    await waitFor(() => !!state.activeBlock && state.running);
  };

  state.activeBlock = null;
  state.running = false;
  state.selectedTaskId = null;
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await startTaskless();
  check("VAL-FREE-002: activeBlock open", !!state.activeBlock);
  check("VAL-FREE-002: activeTaskId null", state.activeTaskId === null);
  check("VAL-FREE-002: running", state.running === true);
  await syncNow();
  check(
    "VAL-FREE-002: server running_block has null task_id",
    state.dashboard.running_block && state.dashboard.running_block.task_id == null,
  );
  await abortEsc();

  await startTaskless();
  await expire();
  check("VAL-FREE-004: credit modal shown", el("#credit-modal").hidden === false);
  const freeBoxes = [...document.querySelectorAll("#credit-list input")];
  check(
    "VAL-FREE-004: Today tasks listed",
    freeBoxes.length >= 3 &&
      freeBoxes.some((c) => Number(c.dataset.id) === aId) &&
      freeBoxes.some((c) => Number(c.dataset.id) === bId),
  );
  check(
    "VAL-FREE-004: nothing pre-checked",
    freeBoxes.every((c) => c.checked === false),
  );
  // confirm with none checked completes the block without crediting
  el("#credit-confirm").click();
  await waitFor(() => state.activeBlock === null);

  const aBeforeFree = bd(A);
  await startTaskless();
  await expire();
  const boxA = [...document.querySelectorAll("#credit-list input")].find(
    (c) => Number(c.dataset.id) === aId,
  );
  boxA.checked = true;
  await confirmCredit();
  check("VAL-FREE-005: credited task +1", bd(A) === aBeforeFree + 1);

  await startTaskless();
  clickRow(bId);
  await sleep(150);
  await expire();
  const touchedBox = [...document.querySelectorAll("#credit-list input")].find(
    (c) => Number(c.dataset.id) === bId,
  );
  check("VAL-FREE-006: touched task pre-checked", touchedBox && touchedBox.checked === true);
  const untouchedBox = [...document.querySelectorAll("#credit-list input")].find(
    (c) => Number(c.dataset.id) === aId,
  );
  check("VAL-FREE-006: untouched unchecked", untouchedBox && untouchedBox.checked === false);
  await confirmCredit([aId]);

  // restore clean idle for VAL-3 onward
  state.activeBlock = null;
  state.running = false;
  state.selectedTaskId = null;
  state.touchedTaskIds = new Set();
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);

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
  // Pin the streak so the break type is deterministic regardless of how many
  // blocks earlier sections credited (VAL-FREE legitimately credits A and B).
  state.streakBlocks = 0;
  const streakBefore = state.streakBlocks;
  const c8 = bd(C), a8 = bd(A), b8 = bd(B); // baselines: VAL8 asserts deltas
  await expire();
  check("VAL8: credit modal shown", el("#credit-modal").hidden === false);
  check("VAL8: checklist lists touched 2", document.querySelectorAll("#credit-list input").length === 2);
  check(
    "VAL8: all boxes checked by default",
    [...document.querySelectorAll("#credit-list input")].every((c) => c.checked),
  );
  await confirmCredit([aId]); // drop A
  check("VAL8: C credited +1", bd(C) === c8 + 1);
  check("VAL8: A unchecked -> +0", bd(A) === a8);
  check("VAL8: B removed earlier -> +0", bd(B) === b8);
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

  // ---- VAL-BSYNC: a running break syncs to the server (cross-device) ----
  const breakState = async () => (await api("/api/dashboard")).break_state;
  const pollBreak = async (want) => {
    for (let i = 0; i < 25; i++) {
      const bs = await breakState();
      if (want ? !!bs : !bs) return bs || null;
      await sleep(80);
    }
    return await breakState();
  };
  setSettings();
  state.rehydrated = true;
  await switchMode("pomodoro", { auto: false }); // baseline: syncBreak -> "none"
  await api("/api/break", { method: "DELETE" }).catch(() => {});
  clearTimerInterval();
  state.activeBlock = null;
  // End any open server block lingering from earlier sections so the
  // "second device" rehydrate below sees only the break, not a stale pomodoro
  // (which would win precedence, complete, and pop a credit modal).
  for (let i = 0; i < 5; i++) {
    await syncNow();
    const rb = state.dashboard && state.dashboard.running_block;
    if (!rb) break;
    await api(`/api/blocks/${rb.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: false }),
    });
  }
  state.activeBlock = null;
  state.rehydrated = true;

  // 001: starting a break writes server break state
  state.timerMode = "shortBreak";
  startCountdown(300, advanceAfterComplete); // running + deadline -> syncBreak PUT
  const bs1 = await pollBreak(true);
  check(
    "VAL-BSYNC-001: break synced to server",
    !!bs1 && bs1.mode === "shortBreak" && typeof bs1.deadline === "number",
  );

  // 002: a second device (fresh load) resumes the break from the server
  clearTimerInterval();
  state.activeBlock = null;
  state.running = false;
  state.deadline = null;
  state.remainingSeconds = 0;
  state.timerMode = "pomodoro";
  state.rehydrated = false; // fresh load -> syncNow rehydrates from dashboard
  await syncNow();
  await sleep(50);
  check(
    "VAL-BSYNC-002: second device resumes the break",
    state.timerMode === "shortBreak" &&
      state.running === true &&
      state.remainingSeconds > 0,
  );

  // 004: switching to a pomodoro clears the server break
  await switchMode("pomodoro", { auto: false }); // syncBreak -> DELETE
  const bs4 = await pollBreak(false);
  check("VAL-BSYNC-004: pomodoro clears server break", bs4 === null);

  // 003: a running pomodoro block wins over a break on rehydrate (precedence)
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
  state.dashboard.break_state = {
    mode: "shortBreak",
    deadline: Date.now() + 300000,
  };
  maybeRehydrateTimer();
  await sleep(50);
  check(
    "VAL-BSYNC-003: pomodoro wins over break",
    state.timerMode === "pomodoro" && !!state.activeBlock,
  );

  // cleanup: the 999999 block is fake/server-less, so fully reset the timer to a
  // pristine idle state (no leftover interval/onComplete/deadline that would make
  // the next section's block complete early).
  clearTimerInterval();
  state.activeBlock = null;
  state.activeTaskId = null;
  state.running = false;
  state.onComplete = null;
  state.deadline = null;
  state.remainingSeconds = 0;
  state.touchedTaskIds = new Set();
  state.selectedTaskId = null;
  state.timerMode = "pomodoro";
  state.dashboard.running_block = null;
  state.dashboard.break_state = null;
  state.rehydrated = true;
  await api("/api/break", { method: "DELETE" }).catch(() => {});
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

  // ---- VAL-REC: editable work-block record ----
  setSettings();
  window.confirm = () => true;
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(150);
  await start(aId); // block on A, touched {A}
  clickRow(bId); // switch active -> B, touched {A,B}
  await sleep(150);
  await expire(); // credit modal opens with A + B checked
  const rec = el("#credit-record");
  check("VAL-REC-001: record seeded from checked tasks", rec.value === A + " + " + B);

  const boxB = [...document.querySelectorAll("#credit-list input")].find(
    (c) => Number(c.dataset.id) === bId,
  );
  boxB.checked = false;
  boxB.dispatchEvent(new Event("change", { bubbles: true }));
  check("VAL-REC-002: re-seeds on uncheck", rec.value === A);

  const customNote = "custom record " + sfx;
  rec.value = customNote;
  rec.dispatchEvent(new Event("input", { bubbles: true }));
  boxB.checked = true;
  boxB.dispatchEvent(new Event("change", { bubbles: true }));
  check("VAL-REC-003: manual edit preserved across toggle", rec.value === customNote);

  el("#credit-confirm").click();
  await waitFor(
    () => state.activeBlock === null && el("#credit-modal").hidden === true,
  );
  await syncNow();
  await openHistory();
  // De-dup: one timer block = ONE finished pomo carrying the combined record.
  // Both A and B were checked, but the session is attributed to the anchor A
  // (A was credited) and B does NOT get a separate pomo row.
  const recPomos = state.history.pomos.filter((p) => p.note === customNote);
  check("VAL-REC-005: exactly one finished pomo carries the record", recPomos.length === 1);
  check(
    "VAL-DEDUP-001: no duplicate pomo — attributed to A, no separate B pomo",
    recPomos.length === 1 &&
      recPomos[0].task_id === aId &&
      !state.history.pomos.some((p) => p.task_id === bId && p.note === customNote),
  );
  const histHtml = el("#history-pomos").innerHTML;
  check("VAL-REC-005: record text rendered in History", histHtml.includes(customNote));

  // VAL-REC-007 (regression): start on C, switch active to A, then credit ONLY
  // A. The record must ride the finished pomo (A), never the abandoned anchor
  // (C), which stays incomplete and never reaches history.
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(100);
  await start(cId); // block on C, touched {C}
  clickRow(aId); // switch active -> A, touched {C, A}
  await sleep(150);
  await expire(); // modal opens, C + A checked
  const note2 = "switched only " + sfx;
  const recC = el("#credit-record");
  recC.value = note2;
  recC.dispatchEvent(new Event("input", { bubbles: true }));
  await confirmCredit([cId]); // uncheck the anchor C -> credit only A
  await syncNow();
  await openHistory();
  const withNote2 = state.history.pomos.filter((p) => p.note === note2);
  check(
    "VAL-REC-007: switched-only record lands on the credited finished pomo (A)",
    withNote2.length === 1 && withNote2[0].task_id === aId,
  );
  check(
    "VAL-REC-007: uncredited anchor (C) is not a finished pomo with the record",
    !state.history.pomos.some((p) => p.task_id === cId && p.note === note2),
  );

  // ---- VAL-DEL: permanently delete a pomo and a todo from History ----
  // Create a fresh, uniquely-noted pomo, then delete it via its History button.
  el('.timer-tab[data-mode="pomodoro"]').click();
  await sleep(100);
  await start(aId);
  await sleep(120);
  await expire();
  const delNote = "to delete " + sfx;
  el("#credit-record").value = delNote;
  el("#credit-record").dispatchEvent(new Event("input", { bubbles: true }));
  el("#credit-confirm").click();
  await waitFor(
    () => state.activeBlock === null && el("#credit-modal").hidden === true,
  );
  await syncNow();
  await openHistory();
  const target = state.history.pomos.find((p) => p.note === delNote);
  check("VAL-DEL: pomo exists before delete", !!target);
  const delPomoBtn =
    target &&
    el(`#history-pomos [data-action="delete-pomo"][data-id="${target.id}"]`);
  check("VAL-UI-001: delete-pomo button present in History", !!delPomoBtn);
  if (delPomoBtn) {
    delPomoBtn.click();
    await waitFor(() => !state.history.pomos.some((p) => p.id === target.id));
  }
  check(
    "VAL-PDEL-001: permanently deleted pomo leaves History",
    !!target && !state.history.pomos.some((p) => p.id === target.id),
  );

  // Permanently delete a todo from History (hard delete: the row is removed).
  const delTodoBtn = el('#history-todos [data-action="delete-todo"]');
  check("VAL-UI-001: delete-todo button present in History", !!delTodoBtn);
  if (delTodoBtn) {
    const tId = Number(delTodoBtn.dataset.id);
    delTodoBtn.click();
    await waitFor(() => !state.history.todos.some((t) => t.id === tId));
    check(
      "VAL-UI-001: permanently deleted todo leaves History",
      !state.history.todos.some((t) => t.id === tId),
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((r) => r.name),
  });
  return window.__e2e;
})();
