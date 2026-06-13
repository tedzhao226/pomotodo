const TIME_SCALE = 1;
const SYNC_MS = 15000;

const SETTINGS_KEY = "pomotodo.settings";
const DEFAULT_SETTINGS = {
  dailyGoal: 8,
  defaultDuration: 30,
  shortRest: 5,
  longRest: 20,
  longEvery: 3,
  autoStartRest: false,
  soundEnabled: true,
};

const PALETTE = ["#ff6f61", "#8ed1a0", "#f0a857", "#6aa9e0", "#f6cf6b", "#f4978e"];

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const state = {
  activeBlock: null,
  timerInterval: null,
  remainingSeconds: 0,
  mode: "idle",
  phase: "idle",
  modeLabel: "",
  onComplete: null,
  streakBlocks: 0,
  pendingTaskId: null,
  pendingDuration: 30,
  selectedTag: null,
  selectedTaskId: null,
  dashboard: null,
  editingTaskId: null,
  expandedNoteId: null,
  stats: null,
  view: "main",
  settings: loadSettings(),
  dragId: null,
  rehydrated: false,
};

const els = {
  taskInput: document.getElementById("task-input"),
  addTaskForm: document.getElementById("add-task-form"),
  addTaskError: document.getElementById("add-task-error"),
  currentTask: document.getElementById("current-task"),
  timerDisplay: document.getElementById("timer-display"),
  timerMode: document.getElementById("timer-mode"),
  timerBtn: document.getElementById("timer-btn"),
  timerHint: document.getElementById("timer-hint"),
  timerPanel: document.getElementById("timer-panel"),
  phasePill: document.getElementById("phase-pill"),
  streakDots: document.getElementById("streak-dots"),
  continueRestPrompt: document.getElementById("continue-rest-prompt"),
  continueBtn: document.getElementById("continue-btn"),
  restBtn: document.getElementById("rest-btn"),
  runningBanner: document.getElementById("running-block-banner"),
  todayList: document.getElementById("today-list"),
  backlogList: document.getElementById("backlog-list"),
  plannedSum: document.getElementById("planned-sum"),
  filterIndicator: document.getElementById("filter-indicator"),
  activeBanner: document.getElementById("active-banner"),
  clearCompletedBtn: document.getElementById("clear-completed-btn"),
  navBtns: document.querySelectorAll(".nav-btn"),
  views: {
    main: document.getElementById("view-main"),
    stats: document.getElementById("view-stats"),
    settings: document.getElementById("view-settings"),
  },
  todayCount: document.getElementById("today-count"),
  todayLog: document.getElementById("today-log"),
  miniWeek: document.getElementById("mini-week"),
  miniWeekValue: document.getElementById("mini-week-value"),
  miniGoal: document.getElementById("mini-goal"),
  miniGoalValue: document.getElementById("mini-goal-value"),
  miniPomo: document.getElementById("mini-pomo"),
  miniPomoValue: document.getElementById("mini-pomo-value"),
  miniTodoValue: document.getElementById("mini-todo-value"),
  rangeSelect: document.getElementById("range-select"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiAvg: document.getElementById("kpi-avg"),
  kpiChange: document.getElementById("kpi-change"),
  trendChart: document.getElementById("trend-chart"),
  topTagsChart: document.getElementById("top-tags-chart"),
  topTagsLegend: document.getElementById("top-tags-legend"),
  worktimeChart: document.getElementById("worktime-chart"),
  worktimeLegend: document.getElementById("worktime-legend"),
  settingsForm: document.getElementById("settings-form"),
  setGoal: document.getElementById("set-goal"),
  setDuration: document.getElementById("set-duration"),
  setShortRest: document.getElementById("set-short-rest"),
  setLongRest: document.getElementById("set-long-rest"),
  setLongEvery: document.getElementById("set-long-every"),
  setLang: document.getElementById("set-lang"),
  setAutorest: document.getElementById("set-autorest"),
  setSound: document.getElementById("set-sound"),
  settingsSaved: document.getElementById("settings-saved"),
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

let audioCtx = null;

function playChime(kind) {
  if (!state.settings.soundEnabled) {
    return;
  }
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    // Work finish: rising two-tone. Rest finish: lower single-ish double beep.
    const tones = kind === "rest" ? [440, 330] : [660, 880];
    let start = audioCtx.currentTime;
    for (const freq of tones) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
      start += 0.34;
    }
  } catch {
    // Audio unavailable (autoplay policy / unsupported) — skip silently.
  }
}

function showError(message) {
  els.addTaskError.textContent = message;
  els.addTaskError.hidden = !message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || response.statusText);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Minimal, safe Markdown subset: headings, bold/italic, inline code, links,
// and unordered/ordered lists. All text is HTML-escaped before transforms and
// only http(s) links are allowed, so the output is safe to inject.
function markdownToHtml(src) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_m, txt, url) =>
          `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`,
      );

  const out = [];
  let list = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      closeList();
      const level = m[1].length + 2;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

/* ---------- views ---------- */

function showView(name) {
  if (!els.views[name]) {
    return;
  }
  state.view = name;
  for (const [key, section] of Object.entries(els.views)) {
    section.classList.toggle("active", key === name);
  }
  els.navBtns.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.view === name),
  );
  if (name === "stats") {
    renderStats();
  }
}

/* ---------- timer ---------- */

function clearTimerInterval() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// Single timer button: Start (idle) / Pause (running) / Resume (paused).
// Hold-to-stop is wired separately in the events section.
function renderTimerButton() {
  const btn = els.timerBtn;
  if (state.mode === "running") {
    btn.textContent = t("timer.pause");
    btn.classList.remove("primary");
    btn.disabled = false;
  } else if (state.mode === "paused") {
    btn.textContent = t("timer.resume");
    btn.classList.remove("primary");
    btn.disabled = false;
  } else {
    btn.textContent = t("timer.start");
    btn.classList.add("primary");
    const tasks = state.dashboard ? state.dashboard.tasks : [];
    const selected = tasks.find((task) => task.id === state.selectedTaskId);
    btn.disabled = !selected || !!state.activeBlock;
  }
  renderPhase();
}

// Visual cue: tomato (work) vs green (rest), driven by state.phase.
function renderPhase() {
  const active = state.phase !== "idle";
  els.timerPanel.classList.toggle("phase-work", state.phase === "work");
  els.timerPanel.classList.toggle("phase-rest", state.phase === "rest");
  els.phasePill.hidden = !active;
  if (active) {
    els.phasePill.textContent = t(
      state.phase === "rest" ? "phase.rest" : "phase.work",
    );
    els.phasePill.className = `phase-pill phase-pill-${state.phase}`;
  }
  els.timerHint.hidden = !active;
  els.timerHint.textContent = t(
    state.phase === "rest" ? "timer.holdSkip" : "timer.holdStop",
  );
}

// Progress toward the next long rest: longEvery dots, filled per the current streak.
function renderStreak() {
  const total = state.settings.longEvery;
  if (total <= 1) {
    els.streakDots.hidden = true;
    return;
  }
  els.streakDots.hidden = false;
  const filled = state.streakBlocks % total;
  els.streakDots.innerHTML = Array.from(
    { length: total },
    (_, i) => `<span class="streak-dot${i < filled ? " on" : ""}"></span>`,
  ).join("");
  els.streakDots.title = t("streak.toLongRest", { n: total - filled });
}

function runTicker() {
  state.timerInterval = setInterval(() => {
    state.remainingSeconds -= 1;
    els.timerDisplay.textContent = formatTime(Math.max(state.remainingSeconds, 0));
    if (state.remainingSeconds <= 0) {
      clearTimerInterval();
      state.mode = "idle";
      renderTimerButton();
      const done = state.onComplete;
      state.onComplete = null;
      if (done) {
        done();
      }
    }
  }, 1000 / TIME_SCALE);
}

function startCountdown(seconds, modeLabel, onComplete) {
  clearTimerInterval();
  state.remainingSeconds = seconds;
  state.mode = "running";
  state.modeLabel = modeLabel;
  state.onComplete = onComplete;
  els.timerMode.textContent = modeLabel;
  els.timerDisplay.textContent = formatTime(state.remainingSeconds);
  renderTimerButton();
  els.continueRestPrompt.hidden = true;
  runTicker();
}

function pauseTimer() {
  if (state.mode !== "running") {
    return;
  }
  clearTimerInterval();
  state.mode = "paused";
  els.timerMode.textContent = t("timer.paused");
  renderTimerButton();
}

function resumeTimer() {
  if (state.mode !== "paused") {
    return;
  }
  state.mode = "running";
  els.timerMode.textContent = state.modeLabel;
  renderTimerButton();
  runTicker();
}

// Hold/Esc: work phase → discard the block (incomplete, uncounted);
// rest phase → skip the rest to zero → Ready.
async function stopTimer() {
  if (state.phase === "idle") {
    return;
  }
  clearTimerInterval();
  if (state.phase === "rest") {
    state.phase = "idle";
    state.mode = "idle";
    els.timerMode.textContent = t("timer.ready");
    renderTimerButton();
    return;
  }
  state.mode = "idle";
  renderTimerButton();
  await finishBlock(false);
}

function updateTimerControls() {
  const tasks = state.dashboard ? state.dashboard.tasks : [];
  // Drop a stale selection only if the task no longer exists; status/filter don't matter.
  if (
    state.selectedTaskId !== null &&
    !tasks.some((task) => task.id === state.selectedTaskId)
  ) {
    state.selectedTaskId = null;
  }
  if (state.selectedTaskId === null) {
    const firstActive = tasks.find((task) => task.status === "active");
    if (firstActive) {
      state.selectedTaskId = firstActive.id;
    }
  }
  const selected = tasks.find((task) => task.id === state.selectedTaskId);
  els.currentTask.textContent = selected ? selected.name : t("timer.noTask");
  renderTimerButton();
  renderActiveBanner(selected);
}

function renderActiveBanner(selected) {
  if (!selected) {
    els.activeBanner.hidden = true;
    return;
  }
  els.activeBanner.hidden = false;
  const tags = selected.tags
    .map((t) => `<span class="log-tag">#${escapeHtml(t)}</span>`)
    .join(" ");
  els.activeBanner.innerHTML = `${tags} ${escapeHtml(selected.name)} <span class="check">✓</span>`;
}

/* ---------- tasks ---------- */

function formatDateTime(iso) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rowHtml(task) {
  const estimate = task.estimate_blocks != null ? task.estimate_blocks : "—";
  const tags = task.tags
    .map(
      (t) =>
        `<button type="button" class="tag-chip" data-action="filter" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`,
    )
    .join(" ");
  const toggleTitle = task.status === "active" ? t("row.markDone") : t("row.reopen");
  const moveTarget = task.bucket === "backlog" ? "today" : "backlog";
  const moveIcon = task.bucket === "backlog" ? "↥" : "↧";
  return `
    <div class="task-row" data-action="activate" data-id="${task.id}">
      <button type="button" class="status-toggle status-${task.status}" data-action="toggle" data-id="${task.id}" data-status="${task.status}" title="${toggleTitle}">
        ${task.status === "done" ? "✓" : ""}
      </button>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="task-tags">${tags}</span>
      <span class="block-badge">(${task.blocks_done}/${estimate})</span>
      <span class="row-actions">
        ${
          task.note && task.note.trim()
            ? `<button type="button" class="row-note${state.expandedNoteId === task.id ? " active" : ""}" data-action="note" data-id="${task.id}" title="${t("row.showNote")}">🗒</button>`
            : ""
        }
        <button type="button" class="row-move" data-action="move" data-id="${task.id}" data-bucket="${moveTarget}" title="${task.bucket === "backlog" ? t("row.toToday") : t("row.toBacklog")}">${moveIcon}</button>
        <button type="button" class="row-edit" data-action="edit" data-id="${task.id}" title="${t("row.edit")}">✎</button>
        <button type="button" class="row-delete" data-action="delete" data-id="${task.id}" data-name="${escapeHtml(task.name)}" title="${t("row.delete")}">🗑</button>
      </span>
    </div>`;
}

function editorHtml(task) {
  return `
    <div class="task-editor">
      <label class="editor-name">${t("editor.name")} <span class="editor-note-hint">${t("editor.nameHint")}</span>
        <input type="text" data-field="name" value="${escapeHtml(task.name)}">
      </label>
      <div class="editor-nums">
        <label>${t("editor.done")}
          <input type="number" min="0" data-field="blocks_done" value="${task.blocks_done}">
        </label>
        <label>${t("editor.estimate")}
          <input type="number" min="0" data-field="estimate_blocks" value="${task.estimate_blocks ?? ""}">
        </label>
      </div>
      <label class="editor-note">${t("editor.note")} <span class="editor-note-hint">${t("editor.noteHint")}</span>
        <textarea data-field="note" rows="4" placeholder="${t("editor.notePlaceholder")}">${escapeHtml(task.note || "")}</textarea>
      </label>
      <p class="editor-times">
        <span>${t("editor.started", { t: formatDateTime(task.started_at) })}</span>
        <span>${t("editor.ended", { t: formatDateTime(task.ended_at) })}</span>
      </p>
      <div class="editor-actions">
        <button type="button" data-action="save" data-id="${task.id}">${t("editor.save")}</button>
        <button type="button" class="ghost" data-action="cancel" data-id="${task.id}">${t("editor.cancel")}</button>
      </div>
    </div>`;
}

// Order is owned by the server (tasks.sort_order, per bucket). Sort the buffered
// tasks of one bucket by it, tie-breaking on id for stability.
function tasksInBucket(bucket) {
  return state.dashboard.tasks
    .filter((task) =>
      bucket === "backlog" ? task.bucket === "backlog" : task.bucket !== "backlog",
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

function taskItem(task, draggable) {
  const data = state.dashboard;
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.id = task.id;
  if (draggable && state.editingTaskId !== task.id) {
    li.draggable = true;
  }
  if (data.running_block && data.running_block.task_id === task.id) {
    li.classList.add("running");
  }
  if (task.status === "done") {
    li.classList.add("is-done");
  }
  if (task.id === state.selectedTaskId) {
    li.classList.add("active");
  }
  li.innerHTML =
    state.editingTaskId === task.id ? editorHtml(task) : rowHtml(task);
  return li;
}

function fillBucket(listEl, tasks, draggable) {
  listEl.innerHTML = "";
  if (!tasks.length) {
    const li = document.createElement("li");
    li.className = "bucket-empty";
    li.textContent = t("todos.empty");
    listEl.appendChild(li);
    return;
  }
  for (const task of tasks) {
    listEl.appendChild(taskItem(task, draggable));
    if (
      state.expandedNoteId === task.id &&
      task.note &&
      task.note.trim() &&
      state.editingTaskId !== task.id
    ) {
      const panel = document.createElement("li");
      panel.className = "note-panel";
      panel.innerHTML = markdownToHtml(task.note);
      listEl.appendChild(panel);
    }
  }
}

function renderTaskList() {
  if (!state.dashboard) {
    return;
  }
  // Preserve an open editor against a background sync so typing isn't clobbered.
  if (
    state.editingTaskId !== null &&
    (els.todayList.querySelector(".task-editor") ||
      els.backlogList.querySelector(".task-editor"))
  ) {
    return;
  }
  const todayTasks = tasksInBucket("today");
  const backlogTasks = tasksInBucket("backlog");

  // Planned sum: all Today tasks, ignoring the active tag filter.
  const planned = todayTasks.reduce(
    (sum, task) => sum + (task.estimate_blocks || 0),
    0,
  );
  els.plannedSum.textContent = t("todos.planned", {
    n: planned,
    unit: plural("block", planned),
  });

  const matches = (task) =>
    !state.selectedTag || task.tags.includes(state.selectedTag);
  const canDrag = !state.selectedTag && state.editingTaskId === null;

  els.filterIndicator.hidden = !state.selectedTag;
  if (state.selectedTag) {
    const tag = state.selectedTag;
    const summary = (state.dashboard.tags || []).find((t) => t.tag === tag);
    const done = summary ? summary.blocks : 0;
    // Planned across every task carrying the tag (Today + Backlog).
    const tagPlanned = state.dashboard.tasks
      .filter((t) => t.tags.includes(tag))
      .reduce((sum, t) => sum + (t.estimate_blocks || 0), 0);
    els.filterIndicator.innerHTML =
      `<span class="fi-tag">#${escapeHtml(tag)}</span>` +
      `<span class="fi-stat">${t("filter.done", { n: done })}</span>` +
      `<span class="fi-stat">${t("filter.planned", { n: tagPlanned })}</span>` +
      `<span class="fi-x">✕</span>`;
  }

  fillBucket(els.todayList, todayTasks.filter(matches), canDrag);
  fillBucket(els.backlogList, backlogTasks.filter(matches), false);
}

function renderDashboard() {
  if (!state.dashboard) {
    return;
  }
  const data = state.dashboard;

  if (data.running_block) {
    const rb = data.running_block;
    els.runningBanner.hidden = false;
    els.runningBanner.textContent =
      t("running.banner", {
        name: rb.task_name,
        min: rb.duration_min,
        time: rb.started_at,
      });
  } else {
    els.runningBanner.hidden = true;
  }

  renderTaskList();
  updateTimerControls();
}

// Render everything from the in-memory buffer — no network.
function renderAll() {
  renderDashboard();
  if (state.stats) {
    renderTodayLog();
    renderMiniCards();
    renderStats();
  }
}

let syncTimer = null;

// Reconcile the buffer with the backend (single combined fetch), then render.
async function syncNow() {
  try {
    const [dashboard, stats] = await Promise.all([
      api("/api/dashboard"),
      api("/api/stats"),
    ]);
    state.dashboard = dashboard;
    state.stats = stats;
    renderAll();
    maybeRehydrateTimer();
  } catch {
    // Keep the current buffer; the next scheduled sync retries.
  }
}

// On first load, resume a block left running server-side (ended_at IS NULL).
function maybeRehydrateTimer() {
  if (state.rehydrated) {
    return;
  }
  state.rehydrated = true;
  const rb = state.dashboard && state.dashboard.running_block;
  if (!rb || state.activeBlock) {
    return;
  }
  state.activeBlock = {
    id: rb.id,
    task_id: rb.task_id,
    duration_min: rb.duration_min,
    durationMin: rb.duration_min,
  };
  state.phase = "work";
  state.selectedTaskId = rb.task_id;
  const elapsedSec = (Date.now() - new Date(rb.started_at).getTime()) / 1000;
  const remaining = Math.round(rb.duration_min * 60 - elapsedSec);
  renderAll();
  if (remaining <= 0) {
    // Block already overran while the page was closed — close it out now.
    finishBlock(true);
    return;
  }
  startCountdown(remaining, t("timer.working", { id: rb.id }), () => {
    playChime("work");
    finishBlock(true);
  });
}

// Debounced sync so a burst of mutations collapses into one reconcile.
function scheduleSync(delay = 600) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncNow();
  }, delay);
}

/* ---------- stats aggregation (local timezone) ---------- */

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hourMinute(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function startOfTodayMinusDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function blocksInDays(blocks, days) {
  const cutoff = startOfTodayMinusDays(days);
  return blocks.filter((b) => new Date(b.started_at) >= cutoff);
}

function perDaySeries(blocks, days) {
  const counts = {};
  for (let i = 0; i < days; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    counts[localDayKey(d)] = 0;
  }
  for (const b of blocks) {
    const key = localDayKey(new Date(b.started_at));
    if (key in counts) {
      counts[key] += 1;
    }
  }
  return Object.keys(counts)
    .sort()
    .map((key) => ({ key, count: counts[key] }));
}

/* ---------- SVG charts ---------- */

function svgBars(values, { w = 120, h = 40, gap = 2 } = {}) {
  if (!values.length) {
    return "";
  }
  const max = Math.max(1, ...values);
  const bw = (w - gap * (values.length - 1)) / values.length;
  const rects = values
    .map((v, i) => {
      const bh = (v / max) * h;
      const x = i * (bw + gap);
      return `<rect x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1" class="bar"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="bars-svg" preserveAspectRatio="none">${rects}</svg>`;
}

function svgLine(values, { w = 640, h = 180, pad = 10 } = {}) {
  if (!values.length) {
    return "";
  }
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [
    pad + i * stepX,
    h - pad - (v / max) * (h - 2 * pad),
  ]);
  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L ${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" class="line-svg" preserveAspectRatio="none">
    <path d="${area}" class="line-area"/>
    <path d="${line}" class="line-stroke"/>
  </svg>`;
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function svgPie(slices, { size = 140, donut = 0 } = {}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return `<svg viewBox="0 0 ${size} ${size}" class="pie-svg"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#eee2d6"/></svg>`;
  }
  let angle = -Math.PI / 2;
  let paths = "";
  for (const s of slices) {
    if (s.value <= 0) {
      continue;
    }
    const frac = s.value / total;
    if (frac >= 0.9999) {
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${s.color}"/>`;
      continue;
    }
    const end = angle + frac * 2 * Math.PI;
    const [x1, y1] = polar(cx, cy, r, angle);
    const [x2, y2] = polar(cx, cy, r, end);
    const large = frac > 0.5 ? 1 : 0;
    paths += `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${s.color}"/>`;
    angle = end;
  }
  const hole =
    donut > 0
      ? `<circle cx="${cx}" cy="${cy}" r="${(r * donut).toFixed(1)}" fill="#fff"/>`
      : "";
  return `<svg viewBox="0 0 ${size} ${size}" class="pie-svg">${paths}${hole}</svg>`;
}

function legendHtml(slices) {
  const items = slices
    .filter((s) => s.value > 0)
    .map(
      (s) =>
        `<li><span class="dot" style="background:${s.color}"></span>${escapeHtml(s.label)} <strong>${s.value}</strong></li>`,
    )
    .join("");
  return items || `<li class="log-empty">${t("stats.noData")}</li>`;
}

/* ---------- today log + mini cards ---------- */

function renderTodayLog() {
  if (!state.stats) {
    return;
  }
  const todayKey = localDayKey(new Date());
  const today = state.stats.blocks.filter(
    (b) => localDayKey(new Date(b.started_at)) === todayKey,
  );
  els.todayCount.textContent = today.length
    ? t("today.finished", {
        n: today.length,
        unit: plural("pomo", today.length),
      })
    : "";

  const groups = new Map();
  for (const b of today) {
    let g = groups.get(b.task_id);
    if (!g) {
      g = {
        name: b.task_name,
        tags: b.tags,
        count: 0,
        first: b.started_at,
        last: b.ended_at || b.started_at,
      };
      groups.set(b.task_id, g);
    }
    g.count += 1;
    if (b.started_at < g.first) {
      g.first = b.started_at;
    }
    const end = b.ended_at || b.started_at;
    if (end > g.last) {
      g.last = end;
    }
  }
  const items = [...groups.values()].sort((a, b) => b.last.localeCompare(a.last));
  els.todayLog.innerHTML = items.length
    ? items
        .map((g) => {
          const tags = g.tags
            .map((t) => `<span class="log-tag">#${escapeHtml(t)}</span>`)
            .join(" ");
          const count = g.count > 1 ? `<span class="log-count">× ${g.count}</span>` : "";
          return `<li class="log-item">
            <span class="log-time">${hourMinute(g.last)}<b>${hourMinute(g.first)}</b></span>
            <span class="log-name">${tags} ${escapeHtml(g.name)} ${count}</span>
          </li>`;
        })
        .join("")
    : `<li class="log-empty">${t("today.empty")}</li>`;
}

function renderMiniCards() {
  if (!state.stats) {
    return;
  }
  const week = perDaySeries(state.stats.blocks, 7);
  els.miniWeek.innerHTML = svgBars(week.map((d) => d.count));
  els.miniWeekValue.textContent = week.reduce((s, d) => s + d.count, 0);

  const todayKey = localDayKey(new Date());
  const todayDone = state.stats.blocks.filter(
    (b) => localDayKey(new Date(b.started_at)) === todayKey,
  ).length;
  const goal = state.settings.dailyGoal;
  els.miniGoal.innerHTML = svgPie(
    [
      { label: "Done", value: Math.min(todayDone, goal), color: "#8ed1a0" },
      { label: "Left", value: Math.max(goal - todayDone, 0), color: "#e9efe9" },
    ],
    { size: 80, donut: 0.62 },
  );
  els.miniGoalValue.textContent = `${todayDone} / ${goal}`;

  const month = perDaySeries(state.stats.blocks, 30);
  els.miniPomo.innerHTML = svgLine(month.map((d) => d.count), {
    w: 120,
    h: 40,
    pad: 3,
  });
  els.miniPomoValue.textContent = state.stats.all_time_pomos;

  els.miniTodoValue.textContent = state.stats.all_time_todos;
}

function renderStats() {
  if (!state.stats) {
    return;
  }
  const days = Number(els.rangeSelect.value);
  const windowBlocks = blocksInDays(state.stats.blocks, days);
  const total = windowBlocks.length;
  els.kpiTotal.textContent = total;
  els.kpiAvg.textContent = (total / days).toFixed(1);

  const last30 = blocksInDays(state.stats.blocks, 30).length;
  const prev30 = blocksInDays(state.stats.blocks, 60).length - last30;
  const change = last30 - prev30;
  els.kpiChange.textContent = `${change >= 0 ? "+" : ""}${change}`;
  els.kpiChange.classList.toggle("up", change > 0);
  els.kpiChange.classList.toggle("down", change < 0);

  els.trendChart.innerHTML = svgLine(
    perDaySeries(state.stats.blocks, days).map((d) => d.count),
  );

  const tags = [...state.stats.tags]
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, 6);
  const tagSlices = tags.map((t, i) => ({
    label: t.tag,
    value: t.blocks,
    color: PALETTE[i % PALETTE.length],
  }));
  els.topTagsChart.innerHTML = svgPie(tagSlices);
  els.topTagsLegend.innerHTML = legendHtml(tagSlices);

  const buckets = [
    { label: t("worktime.morning"), value: 0, color: "#f6cf6b" },
    { label: t("worktime.afternoon"), value: 0, color: "#ff6f61" },
    { label: t("worktime.evening"), value: 0, color: "#6aa9e0" },
    { label: t("worktime.night"), value: 0, color: "#8ed1a0" },
  ];
  for (const b of windowBlocks) {
    const h = new Date(b.started_at).getHours();
    const idx = h < 6 ? 3 : h < 12 ? 0 : h < 18 ? 1 : 2;
    buckets[idx].value += 1;
  }
  els.worktimeChart.innerHTML = svgPie(buckets);
  els.worktimeLegend.innerHTML = legendHtml(buckets);
}

/* ---------- block lifecycle ---------- */

async function startBlock(taskId, durationMin) {
  const block = await api(`/api/tasks/${taskId}/blocks`, {
    method: "POST",
    body: JSON.stringify({ duration_min: durationMin }),
  });
  state.activeBlock = {
    ...block,
    durationMin,
  };
  state.phase = "work";
  els.timerMode.textContent = t("timer.working", { id: block.id });
  startCountdown(durationMin * 60, t("timer.working", { id: block.id }), () => {
    playChime("work");
    finishBlock(true);
  });
}

async function finishBlock(completed) {
  if (!state.activeBlock) {
    return;
  }
  const block = state.activeBlock;
  // End the block server-side first; only clear local state on success so a failed
  // PATCH can't leave an open server block while the client starts another.
  try {
    await api(`/api/blocks/${block.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
  } catch (error) {
    els.timerMode.textContent = t("err.endBlock", { msg: error.message });
    renderTimerButton();
    return;
  }
  state.activeBlock = null;
  state.phase = "idle";
  if (!completed) {
    // Discard breaks the streak and offers no rest — straight back to Ready.
    state.streakBlocks = 0;
    els.timerMode.textContent = t("timer.ready");
    renderTimerButton();
    renderStreak();
    await syncNow();
    return;
  }
  state.streakBlocks += 1;
  state.pendingTaskId = block.task_id;
  state.pendingDuration = block.durationMin;
  els.timerMode.textContent = t("timer.blockEnded");
  renderTimerButton();
  renderStreak();
  await syncNow();
  if (state.settings.autoStartRest) {
    startRest();
  } else {
    els.continueRestPrompt.hidden = false;
  }
}

function restDurationMinutes() {
  const { longEvery, longRest, shortRest } = state.settings;
  return state.streakBlocks % longEvery === 0 ? longRest : shortRest;
}

function startRest() {
  const minutes = restDurationMinutes();
  const isLong = minutes === state.settings.longRest;
  const label = isLong
    ? t("timer.longRest", { min: minutes })
    : t("timer.shortRest", { min: minutes });
  els.continueRestPrompt.hidden = true;
  state.phase = "rest";
  startCountdown(minutes * 60, label, () => {
    playChime("rest");
    state.phase = "idle";
    state.mode = "idle";
    els.timerMode.textContent = t("timer.ready");
    renderTimerButton();
  });
}

/* ---------- settings ---------- */

function applySettingsToControls() {
  state.pendingDuration = state.settings.defaultDuration;
  els.setGoal.value = state.settings.dailyGoal;
  els.setDuration.value = String(state.settings.defaultDuration);
  els.setShortRest.value = state.settings.shortRest;
  els.setLongRest.value = state.settings.longRest;
  els.setLongEvery.value = state.settings.longEvery;
  els.setLang.value = getLang();
  els.setAutorest.checked = state.settings.autoStartRest;
  els.setSound.checked = state.settings.soundEnabled;
  renderStreak();
}

/* ---------- language ---------- */

els.setLang.addEventListener("change", () => {
  setLang(els.setLang.value);
  applyTranslations();
  renderAll();
});

/* ---------- events ---------- */

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view]");
  if (target) {
    showView(target.dataset.view);
  }
});

els.addTaskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const raw = els.taskInput.value.trim();
  if (!raw) {
    return;
  }
  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ raw }),
    });
    els.taskInput.value = "";
    await syncNow();
  } catch (error) {
    showError(error.message);
  }
});

async function startSelectedBlock() {
  const taskId = state.selectedTaskId;
  const durationMin = state.settings.defaultDuration;
  if (!taskId) {
    return;
  }
  try {
    await startBlock(taskId, durationMin);
  } catch (error) {
    els.timerMode.textContent = error.message;
  }
}

// Hold (≥550ms) ends the block; a held press suppresses the trailing click so a
// stop doesn't also pause/resume.
let holdTimer = null;
let didHold = false;

els.timerBtn.addEventListener("pointerdown", () => {
  didHold = false;
  if (state.phase === "idle") {
    return;
  }
  holdTimer = setTimeout(() => {
    holdTimer = null;
    didHold = true;
    stopTimer();
  }, 550);
});

function cancelHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

els.timerBtn.addEventListener("pointerup", cancelHold);
els.timerBtn.addEventListener("pointerleave", cancelHold);
els.timerBtn.addEventListener("pointercancel", cancelHold);

// Keyboard path to stop (hold-to-stop is pointer-only): Escape ends an active block.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.phase !== "idle") {
    stopTimer();
  }
});

els.timerBtn.addEventListener("click", () => {
  if (didHold) {
    didHold = false;
    return;
  }
  if (state.mode === "running") {
    pauseTimer();
  } else if (state.mode === "paused") {
    resumeTimer();
  } else {
    startSelectedBlock();
  }
});

els.continueBtn.addEventListener("click", async () => {
  els.continueRestPrompt.hidden = true;
  if (state.pendingTaskId) {
    await startBlock(state.pendingTaskId, state.pendingDuration);
  }
});

els.restBtn.addEventListener("click", () => {
  startRest();
});

els.rangeSelect.addEventListener("change", renderStats);

els.clearCompletedBtn.addEventListener("click", async () => {
  if (!window.confirm(t("confirm.clearCompleted"))) {
    return;
  }
  if (state.dashboard) {
    state.dashboard.tasks = state.dashboard.tasks.filter((t) => t.status !== "done");
    renderAll();
  }
  await api("/api/tasks/clear-completed", { method: "POST" });
  scheduleSync();
});

els.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings = {
    dailyGoal: Math.max(1, Number(els.setGoal.value) || DEFAULT_SETTINGS.dailyGoal),
    defaultDuration: Number(els.setDuration.value),
    shortRest: Math.max(1, Number(els.setShortRest.value) || DEFAULT_SETTINGS.shortRest),
    longRest: Math.max(1, Number(els.setLongRest.value) || DEFAULT_SETTINGS.longRest),
    longEvery: Math.max(1, Number(els.setLongEvery.value) || DEFAULT_SETTINGS.longEvery),
    autoStartRest: els.setAutorest.checked,
    soundEnabled: els.setSound.checked,
  };
  saveSettings(state.settings);
  applySettingsToControls();
  renderMiniCards();
  els.settingsSaved.hidden = false;
  setTimeout(() => {
    els.settingsSaved.hidden = true;
  }, 1500);
});

els.filterIndicator.addEventListener("click", () => {
  state.selectedTag = null;
  renderAll();
});

async function handleTaskClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  const taskId = Number(target.dataset.id);

  if (action === "filter") {
    // Click the active tag again to clear; otherwise filter to it.
    state.selectedTag =
      state.selectedTag === target.dataset.tag ? null : target.dataset.tag;
    renderAll();
    return;
  }

  if (action === "move") {
    const bucket = target.dataset.bucket;
    const task = state.dashboard?.tasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }
    const previous = task.bucket;
    task.bucket = bucket;
    renderAll();
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ bucket }),
      });
    } catch (error) {
      task.bucket = previous;
      renderAll();
      window.alert(t("err.move", { msg: error.message }));
      return;
    }
    scheduleSync();
    return;
  }

  if (action === "note") {
    state.expandedNoteId = state.expandedNoteId === taskId ? null : taskId;
    renderTaskList();
    return;
  }

  if (action === "activate") {
    state.selectedTaskId = taskId;
    updateTimerControls();
    renderTaskList();
    return;
  }

  if (action === "delete") {
    const name = target.dataset.name || "this todo";
    if (!window.confirm(t("confirm.deleteTask", { name }))) {
      return;
    }
    if (state.selectedTaskId === taskId) {
      state.selectedTaskId = null;
    }
    if (state.editingTaskId === taskId) {
      state.editingTaskId = null;
    }
    if (state.dashboard) {
      state.dashboard.tasks = state.dashboard.tasks.filter((t) => t.id !== taskId);
      renderAll();
    }
    await api(`/api/tasks/${taskId}`, { method: "DELETE" });
    scheduleSync();
    return;
  }

  if (action === "toggle") {
    const newStatus = target.dataset.status === "active" ? "done" : "active";
    const task = state.dashboard?.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = newStatus;
      renderAll();
    }
    await api(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    scheduleSync();
    return;
  }

  if (action === "edit") {
    state.editingTaskId = taskId;
    renderTaskList();
    return;
  }

  if (action === "cancel") {
    state.editingTaskId = null;
    renderTaskList();
    return;
  }

  if (action === "save") {
    const editor = target.closest(".task-editor");
    const body = {};
    const name = editor.querySelector("[data-field='name']").value.trim();
    if (name) {
      body.name = name;
    }
    const done = editor.querySelector("[data-field='blocks_done']").value;
    if (done !== "") {
      body.blocks_done = Number(done);
    }
    const estimate = editor.querySelector("[data-field='estimate_blocks']").value;
    if (estimate !== "") {
      body.estimate_blocks = Number(estimate);
    }
    body.note = editor.querySelector("[data-field='note']").value;
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      state.editingTaskId = null;
      await syncNow();
    } catch (error) {
      window.alert(error.message);
    }
  }
}

els.todayList.addEventListener("click", handleTaskClick);
els.backlogList.addEventListener("click", handleTaskClick);

// In the inline editor: Enter saves, Shift+Enter inserts a newline (note textarea).
function handleEditorKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }
  const editor = event.target.closest(".task-editor");
  if (!editor) {
    return;
  }
  event.preventDefault();
  editor.querySelector("[data-action='save']")?.click();
}

els.todayList.addEventListener("keydown", handleEditorKeydown);
els.backlogList.addEventListener("keydown", handleEditorKeydown);

/* ---------- drag to reorder (frontend-only, Today only) ---------- */

els.todayList.addEventListener("dragstart", (event) => {
  const li = event.target.closest(".task-item");
  if (!li) {
    return;
  }
  state.dragId = Number(li.dataset.id);
  li.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.todayList.addEventListener("dragover", (event) => {
  if (state.dragId === null) {
    return;
  }
  event.preventDefault();
  const over = event.target.closest(".task-item");
  const dragging = els.todayList.querySelector(".task-item.dragging");
  if (!over || !dragging || over === dragging) {
    return;
  }
  const rect = over.getBoundingClientRect();
  const after = event.clientY - rect.top > rect.height / 2;
  els.todayList.insertBefore(dragging, after ? over.nextSibling : over);
});

els.todayList.addEventListener("drop", (event) => {
  event.preventDefault();
  finishDrag();
});

els.todayList.addEventListener("dragend", finishDrag);

async function finishDrag() {
  const dragging = els.todayList.querySelector(".task-item.dragging");
  if (dragging) {
    dragging.classList.remove("dragging");
  }
  if (state.dragId === null) {
    return;
  }
  state.dragId = null;
  const shown = [...els.todayList.querySelectorAll(".task-item")].map((li) =>
    Number(li.dataset.id),
  );
  // Optimistically apply the on-screen order, then persist it to the server.
  // Persist immediately (not via the debounced sync) so the next reconcile reads
  // the new order rather than overwriting the drag.
  shown.forEach((id, index) => {
    const task = state.dashboard.tasks.find((t) => t.id === id);
    if (task) {
      task.sort_order = index;
    }
  });
  renderAll();
  try {
    await api("/api/tasks/order", {
      method: "PATCH",
      body: JSON.stringify({ bucket: "today", task_ids: shown }),
    });
    await syncNow();
  } catch (error) {
    window.alert(t("err.saveOrder", { msg: error.message }));
    await syncNow();
  }
}

applyTranslations();
applySettingsToControls();
syncNow();
setInterval(scheduleSync, SYNC_MS);
