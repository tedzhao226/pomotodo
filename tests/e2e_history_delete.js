// End-to-end test for permanent (hard) delete of history entries.
//
// Run by evaluating this whole file in a browser pointed at a clean test
// server. Drives the real DOM/state and returns a JSON report
// { passed, failedCount, failed }. Used via cmux browser eval; mirrors the
// tests/e2e_timer.js pattern (no browser-harness dependency).
//
//   SCRIPT=$(cat tests/e2e_history_delete.js); cmux browser eval --surface <id> "$SCRIPT"
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

  const sfx = Date.now().toString().slice(-6);
  const T = "E2E-DEL-" + sfx;
  let confirmAnswer = true;
  window.confirm = () => confirmAnswer;

  // ---- seed: one todo with two completed pomos (via API) ----
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ raw: T }) });
  await syncNow();
  const tId = (state.dashboard.tasks.find((x) => x.name === T) || {}).id;
  check("seed: task created", !!tId);
  for (let i = 0; i < 2; i++) {
    const block = await api(`/api/tasks/${tId}/blocks`, {
      method: "POST",
      body: JSON.stringify({ duration_min: 25 }),
    });
    await api(`/api/blocks/${block.id}/credit`, {
      method: "POST",
      body: JSON.stringify({ task_ids: [tId], note: "rec " + sfx }),
    });
  }
  await syncNow();
  await openHistory();

  const ourPomos = () => state.history.pomos.filter((p) => p.task_id === tId);
  const ourTodo = () => state.history.todos.find((x) => x.id === tId);
  const delBtn = (action, id) =>
    document.querySelector(
      `#view-history .row-delete[data-action="${action}"][data-id="${id}"]`,
    );

  check("seed: two pomos in history", ourPomos().length === 2);
  check("seed: todo in history", !!ourTodo());
  check("seed: pomos carry block id", ourPomos().every((p) => Number.isInteger(p.id)));

  // ---- VAL-ICON-002: history delete controls render ✕, no 🗑 ----
  check("VAL-ICON-002: pomo delete glyph is ✕", delBtn("delete-pomo", ourPomos()[0].id).textContent.trim() === "✕");
  check("VAL-ICON-002: todo delete glyph is ✕", delBtn("delete-todo", tId).textContent.trim() === "✕");
  check(
    "VAL-ICON-002: no 🗑 in history view",
    !/🗑/.test(document.getElementById("view-history").textContent),
  );

  // ---- VAL-VIS-001: delete buttons are visible at rest (not opacity 0) ----
  const restOpacity = Number(
    getComputedStyle(delBtn("delete-pomo", ourPomos()[0].id)).opacity,
  );
  check("VAL-VIS-001: pomo delete button visible at rest (opacity > 0)", restOpacity > 0);
  const todoRestOpacity = Number(
    getComputedStyle(delBtn("delete-todo", tId)).opacity,
  );
  check("VAL-VIS-001: todo delete button visible at rest (opacity > 0)", todoRestOpacity > 0);

  // ---- VAL-HD-004: cancel is a no-op ----
  confirmAnswer = false;
  const pomosTotalBefore = state.history.pomosTotal;
  const firstPomoId = ourPomos()[0].id;
  delBtn("delete-pomo", firstPomoId).click();
  await sleep(600); // give any (unexpected) request + re-render time to land
  check(
    "VAL-HD-004: cancelled pomo delete leaves both pomos",
    ourPomos().length === 2 && state.history.pomosTotal === pomosTotalBefore,
  );

  // ---- VAL-HD-004: confirmed pomo delete removes the row + decrements total ----
  confirmAnswer = true;
  delBtn("delete-pomo", firstPomoId).click();
  await waitFor(() => ourPomos().length === 1);
  check("VAL-HD-004: confirmed pomo delete removes one pomo", ourPomos().length === 1);
  check(
    "VAL-HD-004: pomo delete decrements the section total",
    state.history.pomosTotal === pomosTotalBefore - 1,
  );
  check(
    "VAL-HD-004: deleted pomo row is gone from the DOM",
    delBtn("delete-pomo", firstPomoId) === null,
  );

  // ---- VAL-HD-004 / VAL-HD-002: confirmed todo delete cascades to its pomos ----
  const todosTotalBefore = state.history.todosTotal;
  delBtn("delete-todo", tId).click();
  await waitFor(() => !ourTodo());
  check("VAL-HD-004: confirmed todo delete removes the todo", !ourTodo());
  check(
    "VAL-HD-004: todo delete decrements the todo total",
    state.history.todosTotal === todosTotalBefore - 1,
  );
  check(
    "VAL-HD-002: deleting the todo cascades away its remaining pomo",
    ourPomos().length === 0,
  );

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((r) => r.name),
  });
  return window.__e2e;
})();
