// End-to-end test: language switching translates the UI live, and task notes
// render a safe Markdown subset (with raw HTML escaped).
//
// Run by evaluating this whole file in a browser pointed at a running app
// (a clean test server). Drives the real DOM/state and returns a JSON report
// { passed, failedCount, failed }. Used via cmux browser eval; it does NOT
// depend on browser-harness.
//
//   SCRIPT=$(cat tests/e2e_i18n_notes.js); cmux browser eval --surface <id> "$SCRIPT"
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

  const setLang = async (code) => {
    const s = document.getElementById("set-lang");
    s.value = code;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(120);
  };
  // Use a nav label that actually translates (nav.main is the brand "Pomotodo",
  // identical in en/zh, so it can't detect a language switch).
  const navText = () =>
    document.querySelector('[data-i18n="nav.stats"]').textContent.trim();
  const idIn = (listSel, name) => {
    const r = [...document.querySelectorAll(`${listSel} .task-row`)].find(
      (x) => x.querySelector(".task-name").textContent === name,
    );
    return r ? Number(r.dataset.id) : null;
  };
  const action = (tid, act) =>
    document
      .querySelector(`.task-item[data-id='${tid}'] [data-action='${act}']`)
      .click();

  window.confirm = () => true;

  // ============ language switch ============
  const enNav = MESSAGES.en["nav.stats"];
  const zhNav = MESSAGES.zh["nav.stats"];
  check("i18n: en/zh strings differ", typeof enNav === "string" && enNav !== zhNav);

  await setLang("en");
  check("i18n: English label applied", navText() === enNav);

  await setLang("zh");
  check("i18n: Chinese label applied", navText() === zhNav);

  await setLang("en");
  check("i18n: switches back to English", navText() === enNav);

  // ============ note Markdown rendering + XSS safety ============
  const nn = "NOTE" + Date.now().toString().slice(-5);
  const input = document.getElementById("task-input");
  input.value = nn;
  input.closest("form").requestSubmit();
  await waitFor(() =>
    [...document.querySelectorAll("#today-list .task-row .task-name")].some(
      (x) => x.textContent === nn,
    ),
  );
  const tid = idIn("#today-list", nn);

  const note =
    "# Title\n\n" +
    "**bold** and a [link](https://example.com)\n\n" +
    "- one\n- two\n\n" +
    "<script>alert(1)</script>";
  action(tid, "edit");
  await waitFor(
    () => !!document.querySelector(`.task-item[data-id='${tid}'] [data-field='note']`),
  );
  const li = document.querySelector(`.task-item[data-id='${tid}']`);
  li.querySelector("[data-field='note']").value = note;
  li.querySelector("[data-action='save']").click();
  await waitFor(
    () => !document.querySelector(`.task-item[data-id='${tid}'] [data-field='note']`),
  );

  action(tid, "note"); // expand the note panel
  await waitFor(() => {
    const p = document.querySelector("#today-list .note-panel");
    return p && p.innerHTML.length > 0;
  });
  const panel = document.querySelector("#today-list .note-panel");
  const html = panel ? panel.innerHTML : "";
  check("note: panel rendered", typeof html === "string" && html.length > 0);
  check("note: heading rendered", html.includes("<h3>Title</h3>"));
  check("note: bold rendered", html.includes("<strong>bold</strong>"));
  check(
    "note: list rendered",
    html.includes("<li>one</li>") && html.includes("<li>two</li>"),
  );
  check(
    "note: safe link rendered",
    html.includes('href="https://example.com"') &&
      html.includes('rel="noopener noreferrer"'),
  );
  check("note: raw <script> escaped", !html.includes("<script>"));

  // ---- cleanup ----
  action(tid, "delete");
  await waitFor(() => !document.querySelector(`.task-item[data-id='${tid}']`));

  const passed = results.filter((res) => res.ok).length;
  const failed = results.filter((res) => !res.ok);
  window.__e2e = JSON.stringify({
    passed,
    failedCount: failed.length,
    failed: failed.map((res) => res.name),
  });
  return window.__e2e;
})();
