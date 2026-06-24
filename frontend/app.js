const TIME_SCALE = 1;
const SYNC_MS = 15000;

const SETTINGS_KEY = "pomotodo.settings";
const DEFAULT_SETTINGS = {
  dailyGoal: 8,
  defaultDuration: 30,
  shortRest: 5,
  longRest: 20,
  longEvery: 3,
  autoStartPomodoros: false,
  autoStartRest: false,
  soundEnabled: true,
  tickEnabled: false,
  signOffTime: "18:00",
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
  activeTaskId: null,
  touchedTaskIds: new Set(),
  timerInterval: null,
  remainingSeconds: 0,
  deadline: null,
  timerMode: "pomodoro",
  running: false,
  onComplete: null,
  streakBlocks: 0,
  pendingDuration: 30,
  pendingTaskless: false,
  selectedTag: null,
  selectedTaskId: null,
  dashboard: null,
  editingTaskId: null,
  expandedNoteId: null,
  stats: null,
  history: {
    pomos: [],
    todos: [],
    pomosTotal: 0,
    todosTotal: 0,
    pomoPage: 0,
    todoPage: 0,
  },
  view: "pomotodo",
  settings: loadSettings(),
  dragId: null,
  rehydrated: false,
};

const els = {
  taskInput: document.getElementById("task-input"),
  addTaskForm: document.getElementById("add-task-form"),
  addTaskError: document.getElementById("add-task-error"),
  currentTask: document.getElementById("current-task"),
  touchedChips: document.getElementById("touched-chips"),
  creditModal: document.getElementById("credit-modal"),
  creditList: document.getElementById("credit-list"),
  creditRecord: document.getElementById("credit-record"),
  creditRecordLabel: document.getElementById("credit-record-label"),
  creditTitle: document.getElementById("credit-title"),
  creditConfirm: document.getElementById("credit-confirm"),
  timerDisplay: document.getElementById("timer-display"),
  timerMode: document.getElementById("timer-mode"),
  timerBtn: document.getElementById("timer-btn"),
  skipBtn: document.getElementById("skip-btn"),
  restartBtn: document.getElementById("restart-btn"),
  timerPanel: document.getElementById("timer-panel"),
  timerTabs: document.querySelectorAll(".timer-tab"),
  streakDots: document.getElementById("streak-dots"),
  todayList: document.getElementById("today-list"),
  backlogList: document.getElementById("backlog-list"),
  backlogBucket: document.getElementById("backlog-bucket"),
  plannedSum: document.getElementById("planned-sum"),
  filterIndicator: document.getElementById("filter-indicator"),
  clearCompletedBtn: document.getElementById("clear-completed-btn"),
  navBtns: document.querySelectorAll(".nav-btn"),
  views: {
    pomotodo: document.getElementById("view-main"),
    stats: document.getElementById("view-stats"),
    history: document.getElementById("view-history"),
    settings: document.getElementById("view-settings"),
  },
  historyPomos: document.getElementById("history-pomos"),
  historyTodos: document.getElementById("history-todos"),
  historyPomoTotal: document.getElementById("history-pomo-total"),
  historyTodoTotal: document.getElementById("history-todo-total"),
  historyPomosPager: document.getElementById("history-pomos-pager"),
  historyPomosPrev: document.getElementById("history-pomos-prev"),
  historyPomosNext: document.getElementById("history-pomos-next"),
  historyPomosInfo: document.getElementById("history-pomos-info"),
  historyTodosPager: document.getElementById("history-todos-pager"),
  historyTodosPrev: document.getElementById("history-todos-prev"),
  historyTodosNext: document.getElementById("history-todos-next"),
  historyTodosInfo: document.getElementById("history-todos-info"),
  todayCount: document.getElementById("today-count"),
  todayLog: document.getElementById("today-log"),
  miniWeek: document.getElementById("mini-week"),
  miniWeekValue: document.getElementById("mini-week-value"),
  miniWeekDelta: document.getElementById("mini-week-delta"),
  miniGoal: document.getElementById("mini-goal"),
  miniGoalValue: document.getElementById("mini-goal-value"),
  miniPomo: document.getElementById("mini-pomo"),
  miniPomoValue: document.getElementById("mini-pomo-value"),
  miniTodo: document.getElementById("mini-todo"),
  miniTodoValue: document.getElementById("mini-todo-value"),
  miniTodoDone: document.getElementById("mini-todo-done"),
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
  setSignoff: document.getElementById("set-signoff"),
  signoffLine: document.getElementById("signoff-countdown"),
  setDuration: document.getElementById("set-duration"),
  setShortRest: document.getElementById("set-short-rest"),
  setLongRest: document.getElementById("set-long-rest"),
  setLongEvery: document.getElementById("set-long-every"),
  setLang: document.getElementById("set-lang"),
  setAutopomodoros: document.getElementById("set-autopomodoros"),
  setAutorest: document.getElementById("set-autorest"),
  setSound: document.getElementById("set-sound"),
  setTick: document.getElementById("set-tick"),
  settingsSaved: document.getElementById("settings-saved"),
};

let audioCtx = null;

function primeAudio() {
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {
    // Audio unavailable or unsupported.
  }
}

// Timer sounds, built by scripts/fetch_sounds.sh from free-license recordings.
const CHIMES = {
  start: new Audio("/frontend/sounds/start.wav"),
  work: new Audio("/frontend/sounds/focus-end.wav"),
  rest: new Audio("/frontend/sounds/break-end.wav"),
};
// Per-second tick: a soft real sample, not a synth tone.
const TICK_SOUND = new Audio("/frontend/sounds/tick.wav");

function playChime(kind) {
  if (!state.settings.soundEnabled) {
    return;
  }
  const audio = CHIMES[kind];
  if (!audio) {
    return;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay blocked or unsupported — skip silently.
  });
}

function playTick() {
  if (!state.settings.soundEnabled) {
    return;
  }
  TICK_SOUND.currentTime = 0;
  TICK_SOUND.play().catch(() => {
    // Autoplay blocked or unsupported — skip silently.
  });
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
    const error = new Error(body.detail || response.statusText);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
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
  if (name === "history") {
    openHistory();
  }
}

/* ---------- timer ---------- */

function clearTimerInterval() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function timerDurationMinutes() {
  if (state.timerMode === "shortBreak") {
    return state.settings.shortRest;
  }
  if (state.timerMode === "longBreak") {
    return state.settings.longRest;
  }
  return state.pendingDuration;
}

function timerDurationSeconds() {
  return timerDurationMinutes() * 60;
}

function timerIsPaused() {
  // A paused timer has time left; remaining 0 is fresh/idle, not paused.
  return (
    !state.running &&
    state.remainingSeconds > 0 &&
    state.remainingSeconds < timerDurationSeconds()
  );
}

function timerIsActive() {
  return state.running || timerIsPaused();
}

// Mirror the running block into the tab title: timer first (never truncated),
// then type, then task name for work blocks. Idle restores the default.
function updateTabTitle() {
  if (!timerIsActive()) {
    document.title = "Pomotodo";
    return;
  }
  const time = formatTime(Math.max(state.remainingSeconds, 0));
  const prefix = timerIsPaused() ? "⏸ " : "";
  let label;
  if (state.timerMode === "pomodoro") {
    const tasks = state.dashboard ? state.dashboard.tasks : [];
    const task = tasks.find((x) => x.id === state.activeTaskId);
    label = t("tab.work") + (task ? `: ${task.name}` : "");
  } else {
    label = t("tab.rest");
  }
  document.title = `${prefix}${time} · ${label}`;
}

// A running break has no server record, so persist it client-side (like
// A running break has no block, so its state lives in a server singleton
// (PUT/DELETE /api/break) — that's what lets it follow the user across devices.
// Writes are transition-diffed off lastBreakKey so a re-render/tick never spams
// the network; reads ride the dashboard sync (see maybeRehydrateBreak).
let lastBreakKey = "none";
function syncBreak() {
  // Until the first rehydrate we don't know the server's break yet; staying
  // silent stops a pre-rehydrate idle render from DELETEing another device's
  // running break before maybeRehydrateTimer reads it.
  if (!state.rehydrated) {
    return;
  }
  const desired =
    state.timerMode !== "pomodoro" && state.running && state.deadline
      ? `${state.timerMode}|${state.deadline}`
      : "none";
  if (desired === lastBreakKey) {
    return;
  }
  lastBreakKey = desired;
  if (desired === "none") {
    api("/api/break", { method: "DELETE" }).catch(() => {});
  } else {
    api("/api/break", {
      method: "PUT",
      body: JSON.stringify({ mode: state.timerMode, deadline: state.deadline }),
    }).catch(() => {});
  }
}

// Persist the running pomodoro's timer state to its server block — the same
// absolute-deadline model as syncBreak, so a reload rehydrates either a running
// block (deadline_ms) or a paused one (paused_remaining_s). Transition-diffed off
// lastBlockTimerKey so a re-render/tick never spams the network.
let lastBlockTimerKey = "none";
function syncBlockTimer() {
  if (!state.rehydrated) {
    return;
  }
  if (state.timerMode !== "pomodoro" || !state.activeBlock) {
    lastBlockTimerKey = "none";
    return;
  }
  let desired;
  let body;
  if (state.running && state.deadline) {
    desired = `run|${state.activeBlock.id}|${state.deadline}`;
    body = { deadline_ms: state.deadline, paused_remaining_s: null };
  } else if (timerIsPaused()) {
    desired = `pause|${state.activeBlock.id}|${state.remainingSeconds}`;
    body = { deadline_ms: null, paused_remaining_s: state.remainingSeconds };
  } else {
    // Finished-awaiting-credit (remaining 0): nothing meaningful to persist.
    return;
  }
  if (desired === lastBlockTimerKey) {
    return;
  }
  lastBlockTimerKey = desired;
  api(`/api/blocks/${state.activeBlock.id}/timer`, {
    method: "PUT",
    body: JSON.stringify(body),
  }).catch(() => {});
}

function renderTimer() {
  const btn = els.timerBtn;
  const disabled = false;

  els.timerPanel.classList.toggle("mode-pomodoro", state.timerMode === "pomodoro");
  els.timerPanel.classList.toggle("mode-shortBreak", state.timerMode === "shortBreak");
  els.timerPanel.classList.toggle("mode-longBreak", state.timerMode === "longBreak");
  els.timerTabs.forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.mode === state.timerMode),
  );

  if (state.timerMode === "pomodoro") {
    els.timerMode.textContent = t("timer.timeToFocus");
  } else if (state.timerMode === "shortBreak") {
    els.timerMode.textContent = t("timer.timeForBreak");
  } else {
    els.timerMode.textContent = t("timer.timeForLongBreak");
  }

  els.timerDisplay.textContent = formatTime(state.remainingSeconds);
  updateTabTitle();
  syncBreak();
  syncBlockTimer();
  btn.textContent = state.running ? "⏸" : "▶";
  btn.title = state.running ? t("timer.pauseCap") : t("timer.startCap");
  btn.disabled = state.running ? false : disabled;

  els.skipBtn.disabled = !timerIsActive();
  els.skipBtn.title = t("timer.skip");
  els.restartBtn.disabled = !state.activeBlock;
  els.restartBtn.title = t("timer.restart");
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
  clearTimerInterval(); // never leave a second interval running (e.g. resume)
  state.timerInterval = setInterval(() => {
    const prev = state.remainingSeconds;
    state.remainingSeconds = Math.ceil(
      (state.deadline - Date.now()) / (1000 / TIME_SCALE),
    );
    if (
      state.remainingSeconds !== prev &&
      state.timerMode === "pomodoro" &&
      state.running &&
      state.settings.tickEnabled
    ) {
      playTick();
    }
    els.timerDisplay.textContent = formatTime(Math.max(state.remainingSeconds, 0));
    updateTabTitle();
    if (state.remainingSeconds <= 0) {
      clearTimerInterval();
      state.running = false;
      state.remainingSeconds = 0;
      state.deadline = null;
      renderTimer();
      const done = state.onComplete;
      state.onComplete = null;
      if (done) {
        done();
      }
    }
  }, 1000 / TIME_SCALE);
}

function startCountdown(seconds, onComplete) {
  clearTimerInterval();
  state.remainingSeconds = seconds;
  state.deadline = Date.now() + seconds * (1000 / TIME_SCALE);
  state.running = true;
  state.onComplete = onComplete;
  renderTimer();
  runTicker();
}

function pauseTimer() {
  if (!state.running) {
    return;
  }
  clearTimerInterval();
  state.running = false;
  state.deadline = null;
  renderTimer();
}

function resumeTimer() {
  if (!timerIsPaused()) {
    return;
  }
  state.deadline = Date.now() + state.remainingSeconds * (1000 / TIME_SCALE);
  state.running = true;
  renderTimer();
  runTicker();
}

async function stopTimer() {
  if (!timerIsActive()) {
    return;
  }
  clearTimerInterval();
  state.running = false;
  if (state.timerMode !== "pomodoro") {
    await switchMode(state.timerMode, { auto: false });
    return;
  }
  const finished = await finishBlock(false);
  if (finished) {
    await switchMode("pomodoro", { auto: false });
  }
}

function updateTimerControls() {
  const tasks = state.dashboard ? state.dashboard.tasks : [];
  // Detach a carried/picked task once it's gone or marked done — this is how a
  // finished task drops off the next pomo (selection and pending carry alike).
  const detached = (id) =>
    id !== null && !tasks.some((task) => task.id === id && task.status !== "done");
  // selectedTaskId carries the resume task across a block/break; clearing it also
  // drops the taskless-resume flag so a finished task can't auto-start anything.
  if (detached(state.selectedTaskId)) {
    state.selectedTaskId = null;
    state.pendingTaskless = false;
  }
  // While a block runs the label follows the active task; otherwise the pick.
  const labelTaskId = state.activeBlock ? state.activeTaskId : state.selectedTaskId;
  const current = tasks.find((task) => task.id === labelTaskId);
  els.currentTask.textContent = current ? current.name : t("timer.noTask");
  renderTouchedChips(tasks);
  renderTimer();
}

// Chips for every task touched in the running block — a live preview of the
// completion credit checklist. Hidden when no block is running.
function renderTouchedChips(tasks) {
  if (!els.touchedChips) {
    return;
  }
  if (!state.activeBlock || state.touchedTaskIds.size === 0) {
    els.touchedChips.hidden = true;
    els.touchedChips.innerHTML = "";
    return;
  }
  els.touchedChips.hidden = false;
  els.touchedChips.innerHTML = [...state.touchedTaskIds]
    .map((id) => {
      const task = tasks.find((tk) => tk.id === id);
      const name = task ? task.name : `#${id}`;
      const isActive = id === state.activeTaskId;
      // Non-active touched tasks can be dropped from this block's credit;
      // the active task is running and stays.
      const remove = isActive
        ? ""
        : `<button type="button" class="chip-x" data-chip-remove="${id}" title="${t("timer.removeTouched")}">✕</button>`;
      return `<span class="touched-chip${isActive ? " active" : ""}">${escapeHtml(name)}${remove}</span>`;
    })
    .join("");
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

function rowHtml(task, { pinEnabled = true, isFirst = false } = {}) {
  const estimate = task.estimate_blocks != null ? task.estimate_blocks : "—";
  const tags = task.tags
    .map(
      (t) =>
        `<button type="button" class="tag-chip" data-action="filter" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`,
    )
    .join(" ");
  const toggleTitle = task.status === "active" ? t("row.markDone") : t("row.reopen");
  const moveTarget = task.bucket === "backlog" ? "today" : "backlog";
  const moveIcon = task.bucket === "backlog" ? "↑" : "↓";
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
            ? `<button type="button" class="row-note${state.expandedNoteId === task.id ? " active" : ""}" data-action="note" data-id="${task.id}" title="${t("row.showNote")}">≡</button>`
            : ""
        }
        ${
          pinEnabled && !isFirst
            ? `<button type="button" class="row-pin" data-action="pin" data-id="${task.id}" title="${t("row.pin")}">📌</button>`
            : ""
        }
        <button type="button" class="row-move" data-action="move" data-id="${task.id}" data-bucket="${moveTarget}" title="${task.bucket === "backlog" ? t("row.toToday") : t("row.toBacklog")}">${moveIcon}</button>
        <button type="button" class="row-edit" data-action="edit" data-id="${task.id}" title="${t("row.edit")}">✎</button>
        <button type="button" class="row-delete" data-action="delete" data-id="${task.id}" data-name="${escapeHtml(task.name)}" title="${t("row.delete")}">✕</button>
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
function todayCreditCandidates() {
  return tasksInBucket("today").filter((task) => task.status !== "done");
}

function tasksInBucket(bucket) {
  return state.dashboard.tasks
    .filter((task) =>
      bucket === "backlog" ? task.bucket === "backlog" : task.bucket !== "backlog",
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

function taskItem(task, draggable, { pinEnabled = true, isFirst = false } = {}) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.id = task.id;
  if (draggable && state.editingTaskId !== task.id) {
    li.draggable = true;
  }
  // One highlight only: the focused task (active during a block, else the
  // idle selection). Touched tasks live in the timer chips, not the list.
  const focusId = state.activeBlock ? state.activeTaskId : state.selectedTaskId;
  if (task.id === focusId) {
    li.classList.add("active");
  }
  if (task.status === "done") {
    li.classList.add("is-done");
  }
  li.innerHTML =
    state.editingTaskId === task.id
      ? editorHtml(task)
      : rowHtml(task, { pinEnabled, isFirst });
  return li;
}

function fillBucket(listEl, tasks, draggable, { pinEnabled = true } = {}) {
  listEl.innerHTML = "";
  if (!tasks.length) {
    const li = document.createElement("li");
    li.className = "bucket-empty";
    li.textContent = t("todos.empty");
    listEl.appendChild(li);
    return;
  }
  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    listEl.appendChild(
      taskItem(task, draggable, { pinEnabled, isFirst: index === 0 }),
    );
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

  fillBucket(els.todayList, todayTasks.filter(matches), canDrag, {
    pinEnabled: canDrag,
  });
  fillBucket(els.backlogList, backlogTasks.filter(matches), false, {
    pinEnabled: !state.selectedTag && state.editingTaskId === null,
  });
}

function renderDashboard() {
  if (!state.dashboard) {
    return;
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

// Reconcile the buffer with the backend, then render. The two fetches are
// independent: a failure of one (e.g. /api/stats 5xx) must not discard the
// other, so the core UI (tasks + timer) stays live even if stats is broken.
// Failures are logged rather than swallowed so a persistent 5xx is visible.
async function syncNow() {
  const [dashboard, stats] = await Promise.allSettled([
    api("/api/dashboard"),
    api("/api/stats"),
  ]);
  if (dashboard.status === "fulfilled") {
    state.dashboard = dashboard.value;
  } else {
    console.warn("syncNow: dashboard fetch failed", dashboard.reason);
  }
  if (stats.status === "fulfilled") {
    state.stats = stats.value;
  } else {
    console.warn("syncNow: stats fetch failed", stats.reason);
  }
  renderAll();
  // Rehydrate only on a good dashboard: maybeRehydrateTimer latches
  // state.rehydrated on its first call, so running it without dashboard data
  // would permanently skip resuming a running block.
  if (dashboard.status === "fulfilled") {
    maybeRehydrateTimer();
  }
}

// On first load, resume a block left running server-side (ended_at IS NULL).
function maybeRehydrateTimer() {
  if (state.rehydrated) {
    return;
  }
  state.rehydrated = true;
  const rb = state.dashboard && state.dashboard.running_block;
  if (rb && !state.activeBlock) {
    state.activeBlock = {
      id: rb.id,
      task_id: rb.task_id,
      duration_min: rb.duration_min,
      durationMin: rb.duration_min,
    };
    state.timerMode = "pomodoro";
    state.pendingDuration = rb.duration_min;
    // Restore the persisted touched set (every task touched mid-block), not just
    // the active anchor — so a reload keeps the full completion checklist.
    const touched =
      rb.touched_task_ids && rb.touched_task_ids.length
        ? rb.touched_task_ids
        : rb.task_id != null
          ? [rb.task_id]
          : [];
    state.activeTaskId = rb.task_id;
    state.touchedTaskIds = new Set(touched);
    state.pendingTaskless = rb.task_id == null;
    state.selectedTaskId = rb.task_id;
    if (rb.paused_remaining_s != null) {
      // Restore a paused pomodoro: show it paused (no ticker) so resume picks up
      // exactly where the user left off, even across a reload.
      state.remainingSeconds = rb.paused_remaining_s;
      state.running = false;
      state.deadline = null;
      lastBlockTimerKey = `pause|${rb.id}|${rb.paused_remaining_s}`;
      renderAll();
      return;
    }
    // Running: rehydrate from the absolute deadline (back-compat: derive it from
    // started_at+duration for blocks created before the deadline_ms column).
    const deadlineMs =
      rb.deadline_ms ??
      new Date(rb.started_at).getTime() + rb.duration_min * 60_000;
    state.deadline = deadlineMs;
    lastBlockTimerKey = `run|${rb.id}|${deadlineMs}`;
    renderAll();
    resumeFromDeadline(deadlineMs);
    return;
  }
  // No server block claims the timer: resume a running break from the server.
  if (!state.activeBlock) {
    maybeRehydrateBreak();
  }
}

// Resume a running break (short/long) from the server singleton, so a break
// started on another device is picked up on open. The absolute deadline lets
// the real elapsed time (including this load) count down correctly.
function maybeRehydrateBreak() {
  const saved = state.dashboard && state.dashboard.break_state;
  if (!saved) {
    return;
  }
  state.timerMode = saved.mode;
  state.deadline = saved.deadline;
  // Already on the server — don't let the restoring re-render re-PUT it.
  lastBreakKey = `${saved.mode}|${saved.deadline}`;
  resumeFromDeadline(saved.deadline);
}

// Resume a running timer (pomodoro or break) from an absolute server-side
// deadline — the unified time model. Computes the real remaining (including the
// reload gap) and either finishes immediately or restarts the countdown.
function resumeFromDeadline(deadlineMs) {
  const remaining = Math.round((deadlineMs - Date.now()) / (1000 / TIME_SCALE));
  if (remaining <= 0) {
    advanceAfterComplete();
    return;
  }
  startCountdown(remaining, advanceAfterComplete);
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

// Weekday + date labels under the trend line. The line SVG stretches with
// preserveAspectRatio="none", so labels are HTML positioned at each point's
// fractional x. Ticks are thinned to keep ~8 labels on long ranges.
function trendAxis(series, { w = 640, pad = 10 } = {}) {
  if (!series.length) {
    return "";
  }
  const loc = getLang() === "zh" ? "zh-CN" : "en-US";
  const stepX = series.length > 1 ? (w - 2 * pad) / (series.length - 1) : 0;
  const every = Math.max(1, Math.ceil(series.length / 8));
  const last = series.length - 1;
  const ticks = series
    .map((d, i) => {
      // Anchor from the end so the latest day always shows, evenly spaced.
      if ((last - i) % every !== 0) {
        return "";
      }
      const date = new Date(`${d.key}T00:00:00`);
      const wd = date.toLocaleDateString(loc, { weekday: "short" });
      const md = date.toLocaleDateString(loc, { month: "numeric", day: "numeric" });
      const left = ((pad + i * stepX) / w) * 100;
      return `<span class="trend-tick" style="left:${left.toFixed(2)}%">
        <span class="trend-tick-wd">${wd}</span>
        <span class="trend-tick-date">${md}</span>
      </span>`;
    })
    .join("");
  return `<div class="trend-axis">${ticks}</div>`;
}

// Per-day pomo counts above a bar chart. Flex cells line up with the bars (and
// any axis below); the latest day is emphasized, zero days show nothing.
function barValues(series) {
  if (!series.length) {
    return "";
  }
  const last = series.length - 1;
  const cells = series
    .map(
      (d, i) =>
        `<span class="bar-val${i === last ? " is-today" : ""}">${d.count > 0 ? d.count : ""}</span>`,
    )
    .join("");
  return `<div class="bar-values">${cells}</div>`;
}

// Narrow weekday initials under the THIS WEEK mini bars. Evenly spaced cells
// line up with the bars; the latest day (today) is emphasized.
function miniWeekAxis(series) {
  if (!series.length) {
    return "";
  }
  const loc = getLang() === "zh" ? "zh-CN" : "en-US";
  const last = series.length - 1;
  const cells = series
    .map((d, i) => {
      const wd = new Date(`${d.key}T00:00:00`).toLocaleDateString(loc, {
        weekday: "narrow",
      });
      return `<span class="mini-week-day${i === last ? " is-today" : ""}">${wd}</span>`;
    })
    .join("");
  return `<div class="mini-week-axis">${cells}</div>`;
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

function svgRing(frac, label) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1);
  return `<svg viewBox="0 0 52 52" class="ring-svg">
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="#eef0ec" stroke-width="7"/>
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--green-deep)" stroke-width="7"
            stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}"
            stroke-dashoffset="${offset}" transform="rotate(-90 26 26)"/>
    <text x="26" y="30" text-anchor="middle" font-family="var(--font)" font-weight="700"
          font-size="13" fill="var(--ink-strong)">${label}</text>
  </svg>`;
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
    const name = b.note || b.task_name;
    // Taskless (custom-named) pomos share task_id=null; key on the name so
    // distinctly-named ones don't collapse into one group.
    const key = b.task_id ?? `note:${name}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        name,
        tags: b.tags,
        count: 0,
        first: b.started_at,
        last: b.ended_at || b.started_at,
      };
      groups.set(key, g);
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
  renderSignoff();
}

function renderSignoff() {
  const r = signOffRemaining(new Date(), state.settings.signOffTime);
  if (!r) {
    els.signoffLine.hidden = true;
    return;
  }
  const time = state.settings.signOffTime;
  els.signoffLine.textContent = r.past
    ? t("today.signoffPast", { time })
    : t("today.signoff", { h: r.hours, m: r.minutes, time });
  els.signoffLine.hidden = false;
}

function renderMiniCards() {
  if (!state.stats) {
    return;
  }
  const week = perDaySeries(state.stats.blocks, 7);
  els.miniWeek.innerHTML =
    barValues(week) +
    `<div class="mini-week-bars">${svgBars(week.map((d) => d.count))}</div>` +
    miniWeekAxis(week);
  const weekTotal = week.reduce((s, d) => s + d.count, 0);
  els.miniWeekValue.textContent = weekTotal;

  const fortnight = perDaySeries(state.stats.blocks, 14).map((d) => d.count);
  const priorWeek = fortnight.slice(0, 7).reduce((s, n) => s + n, 0);
  const recentWeek = fortnight.slice(7).reduce((s, n) => s + n, 0);
  if (priorWeek === 0 && recentWeek === 0) {
    els.miniWeekDelta.hidden = true;
  } else {
    const pct =
      priorWeek === 0 ? 100 : Math.round(((recentWeek - priorWeek) / priorWeek) * 100);
    els.miniWeekDelta.hidden = false;
    els.miniWeekDelta.classList.toggle("down", pct < 0);
    els.miniWeekDelta.textContent = `${pct < 0 ? "▼" : "▲"} ${Math.abs(pct)}%`;
  }

  const todayKey = localDayKey(new Date());
  const todayDone = state.stats.blocks.filter(
    (b) => localDayKey(new Date(b.started_at)) === todayKey,
  ).length;
  const goal = state.settings.dailyGoal;
  els.miniGoal.innerHTML = svgRing(
    goal > 0 ? todayDone / goal : 0,
    `${goal > 0 ? Math.round((Math.min(todayDone, goal) / goal) * 100) : 0}%`,
  );
  els.miniGoalValue.textContent = `${todayDone} / ${goal}`;

  const month = perDaySeries(state.stats.blocks, 30);
  els.miniPomo.innerHTML = svgLine(month.map((d) => d.count), {
    w: 120,
    h: 40,
    pad: 3,
  });
  els.miniPomoValue.textContent = state.stats.all_time_pomos;

  const totalTodos = state.stats.all_time_todos;
  const doneTodos = state.stats.done_todos;
  const todoFrac = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  els.miniTodo.innerHTML = `<div class="mini-progress"><span style="width:${todoFrac}%"></span></div>`;
  els.miniTodoValue.textContent = totalTodos;
  els.miniTodoDone.hidden = totalTodos === 0;
  els.miniTodoDone.textContent = t("mini.done", { n: doneTodos });
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

  const trendSeries = perDaySeries(state.stats.blocks, days);
  els.trendChart.innerHTML =
    barValues(trendSeries) +
    `<div class="trend-plot">${svgBars(trendSeries.map((d) => d.count), { w: 640, h: 180 })}</div>` +
    trendAxis(trendSeries);

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

/* ---------- history page ---------- */

function dayHeading(key) {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const HISTORY_POMO_PAGE = 20;
const HISTORY_TODO_PAGE = 20;

function fetchHistory(pOff, pLim, tOff, tLim) {
  return api(
    `/api/history?pomos_offset=${pOff}&pomos_limit=${pLim}&todos_offset=${tOff}&todos_limit=${tLim}`,
  );
}

// Open the History tab: reset to page 0 and load both sections.
async function openHistory() {
  state.history = {
    pomos: [],
    todos: [],
    pomosTotal: 0,
    todosTotal: 0,
    pomoPage: 0,
    todoPage: 0,
  };
  try {
    const data = await fetchHistory(0, HISTORY_POMO_PAGE, 0, HISTORY_TODO_PAGE);
    state.history.pomos = data.pomos;
    state.history.pomosTotal = data.pomos_total;
    state.history.todos = data.todos;
    state.history.todosTotal = data.todos_total;
  } catch {
    return;
  }
  renderHistory();
}

async function gotoPomoPage(page) {
  try {
    const data = await fetchHistory(
      page * HISTORY_POMO_PAGE,
      HISTORY_POMO_PAGE,
      0,
      1,
    );
    state.history.pomos = data.pomos;
    state.history.pomosTotal = data.pomos_total;
    state.history.pomoPage = page;
  } catch {
    return;
  }
  renderHistory();
}

async function gotoTodoPage(page) {
  try {
    const data = await fetchHistory(
      0,
      1,
      page * HISTORY_TODO_PAGE,
      HISTORY_TODO_PAGE,
    );
    state.history.todos = data.todos;
    state.history.todosTotal = data.todos_total;
    state.history.todoPage = page;
  } catch {
    return;
  }
  renderHistory();
}

async function reloadHistory() {
  const { pomoPage, todoPage } = state.history;
  try {
    const data = await fetchHistory(
      pomoPage * HISTORY_POMO_PAGE,
      HISTORY_POMO_PAGE,
      todoPage * HISTORY_TODO_PAGE,
      HISTORY_TODO_PAGE,
    );
    state.history.pomos = data.pomos;
    state.history.pomosTotal = data.pomos_total;
    state.history.todos = data.todos;
    state.history.todosTotal = data.todos_total;
  } catch {
    return;
  }
  renderHistory();
}

async function refreshStatsIfLoaded() {
  if (!state.stats) {
    return;
  }
  try {
    state.stats = await api("/api/stats");
    renderTodayLog();
    renderMiniCards();
    if (state.view === "stats") {
      renderStats();
    }
  } catch {
    // keep current stats
  }
}

function renderPager(info, prev, next, page, total, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  info.textContent = `${page + 1} / ${pages}`;
  prev.disabled = page <= 0;
  next.disabled = page >= pages - 1;
  return pages;
}

// Pure render from the in-memory accumulators (no network).
function renderHistory() {
  const { pomos, todos, pomosTotal, todosTotal, pomoPage, todoPage } =
    state.history;

  els.historyPomoTotal.textContent = t("today.finished", {
    n: pomosTotal,
    unit: plural("pomo", pomosTotal),
  });
  const byDay = new Map();
  for (const b of pomos) {
    const key = localDayKey(new Date(b.started_at));
    if (!byDay.has(key)) {
      byDay.set(key, []);
    }
    byDay.get(key).push(b);
  }
  els.historyPomos.innerHTML = byDay.size
    ? [...byDay.keys()]
        .map((key) => {
          const rows = byDay
            .get(key)
            .map((b) => {
              const tags = b.tags
                .map((x) => `<span class="log-tag">#${escapeHtml(x)}</span>`)
                .join(" ");
              return `<li class="log-item">
                <span class="log-time">${hourMinute(b.ended_at || b.started_at)}<b>${hourMinute(b.started_at)}</b></span>
                <span class="log-name">${tags} ${escapeHtml(b.note || b.task_name)} <span class="log-count">${b.duration_min}m</span></span>
                <button type="button" class="row-delete" data-action="delete-pomo" data-id="${b.id}" title="${t("history.deletePomo")}">✕</button>
              </li>`;
            })
            .join("");
          return `<div class="history-day">
            <div class="history-day-head">${escapeHtml(dayHeading(key))} <span>${byDay.get(key).length}</span></div>
            <ul class="today-log">${rows}</ul>
          </div>`;
        })
        .join("")
    : `<p class="log-empty">${t("stats.noData")}</p>`;
  const pomoPages = renderPager(
    els.historyPomosInfo,
    els.historyPomosPrev,
    els.historyPomosNext,
    pomoPage,
    pomosTotal,
    HISTORY_POMO_PAGE,
  );
  els.historyPomosPager.hidden = pomoPages <= 1;

  els.historyTodoTotal.textContent = `${todosTotal}`;
  els.historyTodos.innerHTML = todos.length
    ? todos
        .map((todo) => {
          // Completion wins over archiving: a finished todo cleared from the
          // board is "done", not "archived". Only a todo removed without ever
          // being completed reads as "archived".
          const status =
            todo.status === "done"
              ? "done"
              : todo.archived
                ? "archived"
                : "active";
          const tags = todo.tags
            .map((x) => `<span class="log-tag">#${escapeHtml(x)}</span>`)
            .join(" ");
          const deleteBtn = `<button type="button" class="row-delete" data-action="delete-todo" data-id="${todo.id}" title="${t("history.deleteTodo")}">✕</button>`;
          return `<li class="history-todo">
            <span class="status-chip status-chip-${status}">${t(`status.${status}`)}</span>
            <span class="history-todo-name${todo.archived ? " is-archived" : ""}">${tags} ${escapeHtml(todo.name)}</span>
            <span class="history-todo-blocks">${todo.blocks_done} ${plural("block", todo.blocks_done)}</span>
            <span class="history-todo-date">${escapeHtml(dayHeading(localDayKey(new Date(todo.created_at))))}</span>
            ${deleteBtn}
          </li>`;
        })
        .join("")
    : `<li class="log-empty">${t("stats.noData")}</li>`;
  const todoPages = renderPager(
    els.historyTodosInfo,
    els.historyTodosPrev,
    els.historyTodosNext,
    todoPage,
    todosTotal,
    HISTORY_TODO_PAGE,
  );
  els.historyTodosPager.hidden = todoPages <= 1;
}

/* ---------- block lifecycle ---------- */

async function startBlock(taskId, durationMin) {
  const block =
    taskId == null
      ? await api("/api/blocks", {
          method: "POST",
          body: JSON.stringify({ duration_min: durationMin }),
        })
      : await api(`/api/tasks/${taskId}/blocks`, {
          method: "POST",
          body: JSON.stringify({ duration_min: durationMin }),
        });
  state.activeBlock = {
    ...block,
    durationMin,
  };
  if (taskId == null) {
    state.activeTaskId = null;
    state.touchedTaskIds = new Set();
    state.pendingTaskless = true;
    state.selectedTaskId = null;
  } else {
    state.activeTaskId = taskId;
    state.touchedTaskIds = new Set([taskId]);
    state.pendingTaskless = false;
  }
  state.timerMode = "pomodoro";
  state.pendingDuration = durationMin;
  startCountdown(durationMin * 60, advanceAfterComplete);
  renderTaskList(); // reflect the active-row highlight immediately
}

// Persist the running block's task state (active task + the full touched set) so
// a reload/sync restores it. Called on every mid-block change: assign, switch,
// and chip-remove.
async function syncBlockTasks() {
  if (!state.activeBlock) {
    return;
  }
  try {
    await api(`/api/blocks/${state.activeBlock.id}/tasks`, {
      method: "PUT",
      body: JSON.stringify({
        active_task_id: state.activeTaskId,
        touched_task_ids: [...state.touchedTaskIds],
      }),
    });
  } catch (error) {
    els.timerMode.textContent = t("err.endBlock", { msg: error.message });
  }
}

async function finishBlock(completed) {
  if (!state.activeBlock) {
    return true;
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
    renderTimer();
    els.timerMode.textContent = t("err.endBlock", { msg: error.message });
    return false;
  }
  state.activeBlock = null;
  state.activeTaskId = null;
  state.touchedTaskIds = new Set();
  // Keep the block's task selected so the next pomo (manual or auto) resumes it
  // across the break; updateTimerControls detaches it once it's marked done.
  state.selectedTaskId = block.task_id ?? null;
  if (!completed) {
    state.streakBlocks = 0;
    renderStreak();
    await syncNow();
    return true;
  }
  state.streakBlocks += 1;
  state.pendingTaskless = block.task_id == null;
  state.pendingDuration = block.durationMin;
  renderStreak();
  await syncNow();
  return true;
}

// On a natural completion the user picks which touched tasks to credit;
// each checked task earns one completed block (server-side).
async function completeBlockWithCredit({ nextBreak } = {}) {
  const block = state.activeBlock;
  if (!block) {
    return;
  }
  const startedTaskless = block.task_id == null;
  const lastActive = state.activeTaskId || block.task_id;
  const touched = [...state.touchedTaskIds];
  const todayIds = todayCreditCandidates().map((task) => task.id);
  let modalTaskIds;
  let creditableIds;
  if (startedTaskless) {
    // Scenario 1: every Today task is a creditable pick.
    modalTaskIds = todayIds;
    creditableIds = null;
  } else {
    // Scenario 2: the assigned/touched tasks credit the block; the rest of Today
    // rides along as label-only context (note text, no block reassignment).
    const extras = todayIds.filter((id) => !state.touchedTaskIds.has(id));
    modalTaskIds = [...touched, ...extras];
    creditableIds = new Set(touched);
  }
  // Retry until the credit lands: a transient POST failure (network/5xx) must not
  // strand the finished block (the next Start would clobber it). Keep
  // state.activeBlock and re-open the modal so the user can confirm again.
  // A 404 is terminal, not transient: the block was already finalized server-side
  // (a concurrent start swept it as aborted, or it was deleted), so it can never
  // be credited — reset to idle instead of re-opening the modal forever.
  for (;;) {
    const { checked, note } = await openCreditModal(modalTaskIds, {
      checkedIds: new Set(state.touchedTaskIds),
      creditableIds,
      titleKey: startedTaskless ? "credit.titleUntethered" : "credit.title",
    });
    try {
      await api(`/api/blocks/${block.id}/credit`, {
        method: "POST",
        body: JSON.stringify({ task_ids: checked, note }),
      });
      break;
    } catch (error) {
      if (error.status === 404) {
        state.activeBlock = null;
        state.activeTaskId = null;
        state.touchedTaskIds = new Set();
        state.selectedTaskId = lastActive ?? null;
        await switchMode("pomodoro", { auto: false });
        await syncNow();
        // Set the message last — switchMode/syncNow re-render the mode label.
        els.timerMode.textContent = t("err.creditGone");
        return;
      }
      els.timerMode.textContent = t("err.endBlock", { msg: error.message });
    }
  }
  state.activeBlock = null;
  state.activeTaskId = null;
  state.touchedTaskIds = new Set();
  // Keep the last active task selected so the next pomo resumes it across the
  // break; updateTimerControls detaches it once it's marked done.
  state.selectedTaskId = lastActive ?? null;
  state.streakBlocks += 1;
  state.pendingTaskless = lastActive == null;
  state.pendingDuration = block.durationMin;
  renderStreak();
  await syncNow();
  if (nextBreak) {
    // Skip-with-credit: honor the break the user chose, don't auto-start it.
    await switchMode(nextBreak, { auto: false });
    return;
  }
  const next =
    state.streakBlocks % state.settings.longEvery === 0
      ? "longBreak"
      : "shortBreak";
  await switchMode(next, { auto: true });
}

function openCreditModal(
  taskIds,
  { checkedIds = null, creditableIds = null, titleKey = "credit.title" } = {},
) {
  return new Promise((resolve) => {
    const tasks = state.dashboard ? state.dashboard.tasks : [];
    const nameOf = (id) => {
      const task = tasks.find((tk) => tk.id === id);
      return task ? task.name : `#${id}`;
    };
    const isCreditable = (id) => creditableIds === null || creditableIds.has(id);
    els.creditTitle.textContent = t(titleKey);
    els.creditConfirm.textContent = t("credit.confirm");
    els.creditRecordLabel.textContent = t("credit.record");
    els.creditList.innerHTML = "";
    let dividerShown = false;
    taskIds.forEach((id) => {
      // First non-creditable task opens the label-only group (note text only,
      // never credited a block); mark it with a one-time divider caption.
      if (!isCreditable(id) && !dividerShown) {
        const sep = document.createElement("li");
        sep.className = "credit-divider";
        sep.textContent = t("credit.alsoToday");
        els.creditList.appendChild(sep);
        dividerShown = true;
      }
      const li = document.createElement("li");
      li.className = isCreditable(id) ? "credit-row" : "credit-row label-only";
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checkedIds === null ? true : checkedIds.has(id);
      cb.dataset.id = String(id);
      const span = document.createElement("span");
      span.textContent = nameOf(id);
      label.append(cb, span);
      li.appendChild(label);
      els.creditList.appendChild(li);
    });

    // The record seeds from the checked task names and re-seeds as boxes
    // toggle, until the user edits it by hand (then it's theirs to keep).
    const seed = () =>
      [...els.creditList.querySelectorAll("input:checked")]
        .map((cb) => nameOf(Number(cb.dataset.id)))
        .join(" + ");
    let dirty = false;
    els.creditRecord.value = seed();
    const onInput = () => {
      dirty = true;
    };
    const onToggle = () => {
      if (!dirty) {
        els.creditRecord.value = seed();
      }
    };
    els.creditRecord.addEventListener("input", onInput);
    els.creditList.addEventListener("change", onToggle);

    els.creditModal.hidden = false;
    const onConfirm = () => {
      // Note keeps every checked name; only creditable ids are sent to /credit so
      // label-only Today tasks can't reassign the block or add a pomo.
      const allChecked = [
        ...els.creditList.querySelectorAll("input:checked"),
      ].map((cb) => Number(cb.dataset.id));
      const checked = allChecked.filter(isCreditable);
      const note = els.creditRecord.value.trim();
      els.creditModal.hidden = true;
      els.creditConfirm.removeEventListener("click", onConfirm);
      els.creditRecord.removeEventListener("input", onInput);
      els.creditList.removeEventListener("change", onToggle);
      resolve({ checked, note });
    };
    els.creditConfirm.addEventListener("click", onConfirm);
  });
}

function restDurationMinutes() {
  const { longEvery, longRest, shortRest } = state.settings;
  return state.streakBlocks % longEvery === 0 ? longRest : shortRest;
}

async function switchMode(mode, { auto = false } = {}) {
  clearTimerInterval();
  state.running = false;
  state.onComplete = null;
  state.timerMode = mode;
  state.remainingSeconds = timerDurationSeconds();
  renderTimer();
  if (!auto) {
    return;
  }
  if (mode === "pomodoro" && state.settings.autoStartPomodoros) {
    if (state.pendingTaskless) {
      await startBlock(null, state.pendingDuration);
    } else {
      const taskId = state.selectedTaskId;
      if (taskId) {
        state.selectedTaskId = taskId;
        await startBlock(taskId, state.pendingDuration);
      }
    }
    return;
  }
  if (mode !== "pomodoro" && state.settings.autoStartRest) {
    startCountdown(state.remainingSeconds, advanceAfterComplete);
  }
}

async function advanceAfterComplete() {
  if (state.timerMode === "pomodoro") {
    playChime("work");
    await completeBlockWithCredit();
    return;
  }
  playChime("rest");
  await switchMode("pomodoro", { auto: true });
}

async function confirmDiscardPomodoro() {
  if (state.timerMode !== "pomodoro" || !state.activeBlock) {
    return true;
  }
  if (!window.confirm(t("timer.confirmDiscard"))) {
    return false;
  }
  clearTimerInterval();
  state.running = false;
  return finishBlock(false);
}

// Leave a running work block for a break. Past 1/3 of its duration the block is
// credited like a natural end (credit checklist, streak bumps); under 1/3 it's
// discarded (confirmed). Either way it goes to the chosen break.
async function skipWorkBlockToBreak(breakMode) {
  if (state.timerMode !== "pomodoro" || !state.activeBlock) {
    await switchMode(breakMode, { auto: false });
    return;
  }
  const total = state.activeBlock.durationMin * 60;
  const elapsedFrac = total > 0 ? 1 - state.remainingSeconds / total : 1;
  if (elapsedFrac >= 1 / 3) {
    clearTimerInterval();
    state.running = false;
    await completeBlockWithCredit({ nextBreak: breakMode });
  } else {
    const discarded = await confirmDiscardPomodoro();
    if (discarded) {
      await switchMode(breakMode, { auto: false });
    }
  }
}

async function skipSession() {
  if (!timerIsActive()) {
    return;
  }
  if (state.timerMode === "pomodoro") {
    await skipWorkBlockToBreak("shortBreak");
    return;
  }
  await switchMode("pomodoro", { auto: false });
}

// Restart re-runs the same block from its full duration: same block, same
// touched tasks, no new server block, nothing lost. Pomodoro-only.
function restartTimer() {
  if (state.timerMode !== "pomodoro" || !state.activeBlock) {
    return;
  }
  primeAudio();
  playChime("start");
  startCountdown(state.activeBlock.durationMin * 60, advanceAfterComplete);
}

/* ---------- settings ---------- */

function applySettingsToControls() {
  if (!timerIsActive()) {
    state.pendingDuration = state.settings.defaultDuration;
    state.remainingSeconds = timerDurationSeconds();
  }
  els.setGoal.value = state.settings.dailyGoal;
  els.setSignoff.value = state.settings.signOffTime;
  els.setDuration.value = String(state.settings.defaultDuration);
  els.setShortRest.value = state.settings.shortRest;
  els.setLongRest.value = state.settings.longRest;
  els.setLongEvery.value = state.settings.longEvery;
  els.setLang.value = getLang();
  els.setAutopomodoros.checked = state.settings.autoStartPomodoros;
  els.setAutorest.checked = state.settings.autoStartRest;
  els.setSound.checked = state.settings.soundEnabled;
  els.setTick.checked = state.settings.tickEnabled;
  renderStreak();
  renderTimer();
}

/* ---------- language ---------- */

els.setLang.addEventListener("change", () => {
  setLang(els.setLang.value);
  applyTranslations();
  renderAll();
});

/* ---------- events ---------- */

// Each view has its own hash link (#/pomotodo, #/stats, #/history, #/settings);
// navigation just changes the hash and applyRoute() reacts.
function applyRoute() {
  const slug = window.location.hash.replace(/^#\/?/, "");
  showView(els.views[slug] ? slug : "pomotodo");
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view]");
  if (target) {
    window.location.hash = `#/${target.dataset.view}`;
  }
});

window.addEventListener("hashchange", applyRoute);

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

async function startPomodoro(taskId = state.selectedTaskId) {
  try {
    await startBlock(taskId ?? null, state.pendingDuration);
  } catch (error) {
    els.timerMode.textContent = error.message;
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && timerIsActive()) {
    stopTimer();
  }
});

els.timerBtn.addEventListener("click", async () => {
  primeAudio();
  if (state.running) {
    pauseTimer();
  } else if (timerIsPaused()) {
    resumeTimer();
  } else if (state.timerMode === "pomodoro") {
    playChime("start");
    await startPomodoro();
  } else {
    playChime("start");
    startCountdown(state.remainingSeconds, advanceAfterComplete);
  }
});

els.skipBtn.addEventListener("click", skipSession);
els.restartBtn.addEventListener("click", restartTimer);

// Drop a non-active touched task from this block so it won't be credited.
els.touchedChips.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-chip-remove]");
  if (!btn) {
    return;
  }
  const id = Number(btn.dataset.chipRemove);
  if (id === state.activeTaskId) {
    return;
  }
  state.touchedTaskIds.delete(id);
  await syncBlockTasks(); // persist the removal
  updateTimerControls();
  renderTaskList();
});

els.timerTabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    const nextMode = tab.dataset.mode;
    if (!nextMode || nextMode === state.timerMode) {
      return;
    }
    // Leaving a running work block into a break → skip-with-1/3-credit rule.
    if (
      state.timerMode === "pomodoro" &&
      state.activeBlock &&
      (nextMode === "shortBreak" || nextMode === "longBreak")
    ) {
      await skipWorkBlockToBreak(nextMode);
      return;
    }
    const discarded = await confirmDiscardPomodoro();
    if (!discarded) {
      return;
    }
    await switchMode(nextMode, { auto: false });
  });
});

els.rangeSelect.addEventListener("change", renderStats);
els.historyPomosPrev.addEventListener("click", () =>
  gotoPomoPage(state.history.pomoPage - 1),
);
els.historyPomosNext.addEventListener("click", () =>
  gotoPomoPage(state.history.pomoPage + 1),
);
els.historyTodosPrev.addEventListener("click", () =>
  gotoTodoPage(state.history.todoPage - 1),
);
els.historyTodosNext.addEventListener("click", () =>
  gotoTodoPage(state.history.todoPage + 1),
);

els.views.history.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  if (action === "delete-pomo") {
    if (!window.confirm(t("confirm.deletePomo"))) {
      return;
    }
    const id = Number(target.dataset.id);
    try {
      await api(`/api/history/pomos/${id}`, { method: "DELETE" });
    } catch {
      return;
    }
    await reloadHistory();
    await refreshStatsIfLoaded();
    return;
  }
  if (action === "delete-todo") {
    if (!window.confirm(t("confirm.deleteTodo"))) {
      return;
    }
    const id = Number(target.dataset.id);
    try {
      await api(`/api/history/todos/${id}`, { method: "DELETE" });
    } catch {
      return;
    }
    await reloadHistory();
    await refreshStatsIfLoaded();
  }
});

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
    autoStartPomodoros: els.setAutopomodoros.checked,
    autoStartRest: els.setAutorest.checked,
    soundEnabled: els.setSound.checked,
    tickEnabled: els.setTick.checked,
    signOffTime: els.setSignoff.value,
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


  if (action === "pin") {
    if (state.selectedTag) {
      return;
    }
    const task = state.dashboard?.tasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }
    const ordered = tasksInBucket(task.bucket).map((t) => t.id);
    if (ordered[0] === taskId) {
      return;
    }
    const newOrder = [taskId, ...ordered.filter((id) => id !== taskId)];
    newOrder.forEach((id, index) => {
      const row = state.dashboard.tasks.find((t) => t.id === id);
      if (row) {
        row.sort_order = index;
      }
    });
    renderAll();
    try {
      await api("/api/tasks/order", {
        method: "PATCH",
        body: JSON.stringify({ bucket: task.bucket, task_ids: newOrder }),
      });
      await syncNow();
    } catch (error) {
      window.alert(t("err.saveOrder", { msg: error.message }));
      await syncNow();
    }
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
    if (state.activeBlock) {
      // Mid-block: set the active task (timer keeps running). The task joins
      // the touched set for completion credit. Replacing an existing active
      // task needs confirmation; assigning one to a taskless block (no active
      // task yet) does not — nothing is being replaced.
      if (taskId === state.activeTaskId) {
        return;
      }
      const assigning = state.activeTaskId == null;
      if (!assigning) {
        const task = state.dashboard?.tasks.find((tk) => tk.id === taskId);
        const name = task ? task.name : "";
        if (!window.confirm(t("timer.confirmSwitch", { name }))) {
          return;
        }
      }
      state.activeTaskId = taskId;
      state.touchedTaskIds.add(taskId);
      // Persist the new active task + the full touched set so a reload restores
      // them (assign and switch alike).
      await syncBlockTasks();
      updateTimerControls();
      renderTaskList();
      return;
    }
    // Idle/rest: toggle — click the selected task again to deselect it.
    if (taskId === state.selectedTaskId) {
      state.selectedTaskId = null;
    } else {
      state.selectedTaskId = taskId;
    }
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
      if (newStatus === "done") {
        // Mirror the server re-home so the row sinks at once, before scheduleSync reconciles.
        const maxOrder = Math.max(
          -1,
          ...state.dashboard.tasks
            .filter((t) => t.bucket === task.bucket)
            .map((t) => t.sort_order),
        );
        task.sort_order = maxOrder + 1;
      }
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

// Collapse state for the Backlog section, persisted on its own (the settings
// form rebuilds state.settings wholesale, so it can't live there).
const BACKLOG_OPEN_KEY = "pomotodo.backlogOpen";
els.backlogBucket.open = localStorage.getItem(BACKLOG_OPEN_KEY) !== "false";
els.backlogBucket.addEventListener("toggle", () => {
  localStorage.setItem(BACKLOG_OPEN_KEY, els.backlogBucket.open);
});

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
applyRoute();
syncNow();
setInterval(scheduleSync, SYNC_MS);
setInterval(renderSignoff, 60000);
