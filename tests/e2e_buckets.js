// End-to-end test: bucket interactions — move a todo between Today and Backlog,
// and drag-reorder within Today (order persists to the server).
//
// Run by evaluating this whole file in a browser pointed at a running app
// (a clean test server). Drives the real DOM/state and returns a JSON report
// { passed, failedCount, failed }. Used via cmux browser eval; it does NOT
// depend on browser-harness.
//
//   SCRIPT=$(cat tests/e2e_buckets.js); cmux browser eval --surface <id> "$SCRIPT"
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

  const idIn = (listSel, name) => {
    const r = [...document.querySelectorAll(`${listSel} .task-row`)].find(
      (x) => x.querySelector(".task-name").textContent === name,
    );
    return r ? Number(r.dataset.id) : null;
  };
  const inList = (listSel, name) =>
    [...document.querySelectorAll(`${listSel} .task-row .task-name`)].some(
      (x) => x.textContent === name,
    );
  const bucketOf = (tid) => {
    const task = state.dashboard.tasks.find((x) => x.id === tid);
    return task ? task.bucket : null;
  };
  const action = (tid, act) =>
    document
      .querySelector(`.task-item[data-id='${tid}'] [data-action='${act}']`)
      .click();
  const todayOrder = (i1, i2) =>
    [...document.querySelectorAll("#today-list .task-item")]
      .map((x) => Number(x.dataset.id))
      .filter((id) => id === i1 || id === i2)
      .join(",");
  const addTask = async (name) => {
    const i = document.getElementById("task-input");
    i.value = name;
    i.closest("form").requestSubmit();
    await waitFor(() => inList("#today-list", name));
  };

  window.confirm = () => true;
  const sfx = Date.now().toString().slice(-5);

  // ============ move Today <-> Backlog ============
  const mv = "MOVE" + sfx;
  await addTask(mv);
  const mvId = idIn("#today-list", mv);
  check("move: starts in Today list", inList("#today-list", mv) === true);
  check("move: starts in today bucket", bucketOf(mvId) !== "backlog");

  action(mvId, "move"); // -> backlog
  await waitFor(() => bucketOf(mvId) === "backlog" && inList("#backlog-list", mv));
  check("move: now in Backlog list", inList("#backlog-list", mv) === true);
  check("move: gone from Today list", inList("#today-list", mv) === false);
  check("move: bucket is backlog", bucketOf(mvId) === "backlog");

  action(mvId, "move"); // -> today
  await waitFor(() => bucketOf(mvId) !== "backlog" && inList("#today-list", mv));
  check("move: back in Today list", inList("#today-list", mv) === true);
  check("move: bucket no longer backlog", bucketOf(mvId) !== "backlog");

  // ============ drag-reorder within Today ============
  const a = "ORDA" + sfx;
  const b = "ORDB" + sfx;
  await addTask(a);
  await addTask(b);
  const ia = idIn("#today-list", a);
  const ib = idIn("#today-list", b);
  const before = todayOrder(ia, ib);
  check(
    "reorder: two new todos present in Today",
    before === `${ia},${ib}` || before === `${ib},${ia}`,
  );

  // Drag whichever is first to below the second, so their relative order flips.
  const [first, second] = before === `${ia},${ib}` ? [ia, ib] : [ib, ia];
  const items = [...document.querySelectorAll("#today-list .task-item")];
  const A = items.find((x) => Number(x.dataset.id) === first);
  const B = items.find((x) => Number(x.dataset.id) === second);
  const dt = new DataTransfer();
  A.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
  const r = B.getBoundingClientRect();
  B.dispatchEvent(
    new DragEvent("dragover", {
      bubbles: true,
      dataTransfer: dt,
      clientX: r.left + 5,
      clientY: r.top + r.height - 3,
    }),
  );
  B.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  A.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));

  const expected = `${second},${first}`;
  await waitFor(() => todayOrder(ia, ib) === expected);
  check("reorder: DOM order flipped", todayOrder(ia, ib) === expected);

  // Persisted to the server: force a fresh sync and re-check the order holds.
  await syncNow();
  check("reorder: order persisted after sync", todayOrder(ia, ib) === expected);

  // ---- cleanup ----
  for (const tid of [idIn("#today-list", mv), ia, ib]) {
    if (Number.isInteger(tid)) {
      action(tid, "delete");
      await waitFor(() => !document.querySelector(`.task-item[data-id='${tid}']`));
    }
  }

  const passed = results.filter((res) => res.ok).length;
  const failed = results.filter((res) => !res.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((res) => res.name),
  });
  return window.__e2e;
})();
