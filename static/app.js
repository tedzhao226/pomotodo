const TIME_SCALE = 1;
const SYNC_MS = 15000;

const SETTINGS_KEY = "pomotodo.settings";
const DEFAULT_SETTINGS = {
  dailyGoal: 8,
  defaultDuration: 30,
  shortRest: 5,
  longRest: 20,
  longEvery: 3,
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

const ORDER_KEY = "pomotodo.taskOrder";

function loadOrder() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOrder() {
  localStorage.setItem(ORDER_KEY, JSON.stringify(state.order));
}

const state = {
  activeBlock: null,
  timerInterval: null,
  remainingSeconds: 0,
  mode: "idle",
  modeLabel: "",
  onComplete: null,
  completedWorkBlocks: 0,
  pendingTaskId: null,
  pendingDuration: 30,
  selectedTag: null,
  selectedTaskId: null,
  dashboard: null,
  editingTaskId: null,
  stats: null,
  view: "main",
  settings: loadSettings(),
  order: loadOrder(),
  dragId: null,
  rehydrated: false,
};

const els = {
  taskInput: document.getElementById("task-input"),
  addTaskForm: document.getElementById("add-task-form"),
  addTaskError: document.getElementById("add-task-error"),
  tagChips: document.getElementById("tag-chips"),
  currentTask: document.getElementById("current-task"),
  durationSelect: document.getElementById("duration-select"),
  timerDisplay: document.getElementById("timer-display"),
  timerMode: document.getElementById("timer-mode"),
  startBtn: document.getElementById("start-btn"),
  stopBtn: document.getElementById("stop-btn"),
  continueRestPrompt: document.getElementById("continue-rest-prompt"),
  continueBtn: document.getElementById("continue-btn"),
  restBtn: document.getElementById("rest-btn"),
  restPrompt: document.getElementById("rest-prompt"),
  restLabel: document.getElementById("rest-label"),
  skipRestBtn: document.getElementById("skip-rest-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  runningBanner: document.getElementById("running-block-banner"),
  taskList: document.getElementById("task-list"),
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
  settingsSaved: document.getElementById("settings-saved"),
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

let audioCtx = null;

function playChime(kind) {
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

function setTimerUI(running) {
  els.startBtn.disabled = running;
  els.stopBtn.disabled = !running;
  els.pauseBtn.disabled = !running;
  els.durationSelect.disabled = running;
  if (!running) {
    els.pauseBtn.textContent = "Pause";
  }
}

function runTicker() {
  state.timerInterval = setInterval(() => {
    state.remainingSeconds -= 1;
    els.timerDisplay.textContent = formatTime(Math.max(state.remainingSeconds, 0));
    if (state.remainingSeconds <= 0) {
      clearTimerInterval();
      setTimerUI(false);
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
  setTimerUI(true);
  els.continueRestPrompt.hidden = true;
  els.restPrompt.hidden = true;
  runTicker();
}

function pauseTimer() {
  if (state.mode !== "running") {
    return;
  }
  clearTimerInterval();
  state.mode = "paused";
  els.timerMode.textContent = "Paused";
  els.pauseBtn.textContent = "Resume";
}

function resumeTimer() {
  if (state.mode !== "paused") {
    return;
  }
  state.mode = "running";
  els.timerMode.textContent = state.modeLabel;
  els.pauseBtn.textContent = "Pause";
  runTicker();
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
  els.currentTask.textContent = selected ? selected.name : "No task selected";
  if (!state.activeBlock && state.mode === "idle") {
    els.startBtn.disabled = !selected;
  }
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

function renderTagChips(tags) {
  els.tagChips.innerHTML = "";
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = `chip${state.selectedTag === null ? " active" : ""}`;
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    state.selectedTag = null;
    renderAll();
  });
  els.tagChips.appendChild(allChip);

  for (const tagInfo of tags) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${state.selectedTag === tagInfo.tag ? " active" : ""}`;
    chip.textContent = tagInfo.tag;
    chip.addEventListener("click", () => {
      state.selectedTag = tagInfo.tag;
      renderAll();
    });
    els.tagChips.appendChild(chip);
  }
}

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
  const toggleTitle = task.status === "active" ? "Mark done" : "Reopen";
  return `
    <div class="task-row" data-action="activate" data-id="${task.id}">
      <button type="button" class="status-toggle status-${task.status}" data-action="toggle" data-id="${task.id}" data-status="${task.status}" title="${toggleTitle}">
        ${task.status === "done" ? "✓" : ""}
      </button>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="task-tags">${tags}</span>
      <span class="block-badge">${task.blocks_done} / ${estimate} <span class="badge-unit">block</span></span>
      <button type="button" class="row-edit" data-action="edit" data-id="${task.id}" title="Edit">✎</button>
      <button type="button" class="row-delete" data-action="delete" data-id="${task.id}" data-name="${escapeHtml(task.name)}" title="Delete">🗑</button>
    </div>`;
}

function editorHtml(task) {
  return `
    <div class="task-editor">
      <label class="editor-name">Name
        <input type="text" data-field="name" value="${escapeHtml(task.name)}">
      </label>
      <div class="editor-nums">
        <label>Done
          <input type="number" min="0" data-field="blocks_done" value="${task.blocks_done}">
        </label>
        <label>Estimate
          <input type="number" min="0" data-field="estimate_blocks" value="${task.estimate_blocks ?? ""}">
        </label>
      </div>
      <p class="editor-times">
        <span>Started ${formatDateTime(task.started_at)}</span>
        <span>Ended ${formatDateTime(task.ended_at)}</span>
      </p>
      <div class="editor-actions">
        <button type="button" data-action="save" data-id="${task.id}">Save</button>
        <button type="button" class="ghost" data-action="cancel" data-id="${task.id}">Cancel</button>
      </div>
    </div>`;
}

// Apply the client-side order (localStorage) to the buffered tasks. Unknown ids
// (newly created) sort to the top in server order. Order persists locally only.
function orderedTasks() {
  const index = new Map(state.order.map((id, i) => [id, i]));
  const ordered = [...state.dashboard.tasks].sort((a, b) => {
    const ia = index.has(a.id) ? index.get(a.id) : -1;
    const ib = index.has(b.id) ? index.get(b.id) : -1;
    return ia - ib;
  });
  // Re-canonicalise: prune deleted ids, record new ones.
  state.order = ordered.map((t) => t.id);
  saveOrder();
  return ordered;
}

function renderTaskList() {
  if (!state.dashboard) {
    return;
  }
  // Preserve an open editor against a background sync so typing isn't clobbered.
  if (state.editingTaskId !== null && els.taskList.querySelector(".task-editor")) {
    return;
  }
  const data = state.dashboard;
  const ordered = orderedTasks();
  const visible = state.selectedTag
    ? ordered.filter((task) => task.tags.includes(state.selectedTag))
    : ordered;
  const canDrag = !state.selectedTag && state.editingTaskId === null;
  els.taskList.innerHTML = "";
  for (const task of visible) {
    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.id = task.id;
    if (canDrag && state.editingTaskId !== task.id) {
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
    els.taskList.appendChild(li);
  }
}

function renderDashboard() {
  if (!state.dashboard) {
    return;
  }
  const data = state.dashboard;
  renderTagChips(data.tags);

  if (data.running_block) {
    const rb = data.running_block;
    els.runningBanner.hidden = false;
    els.runningBanner.textContent =
      `Running: ${rb.task_name} (${rb.duration_min} min block started ${rb.started_at})`;
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
  state.selectedTaskId = rb.task_id;
  const elapsedSec = (Date.now() - new Date(rb.started_at).getTime()) / 1000;
  const remaining = Math.round(rb.duration_min * 60 - elapsedSec);
  renderAll();
  if (remaining <= 0) {
    // Block already overran while the page was closed — close it out now.
    finishBlock(true);
    return;
  }
  startCountdown(remaining, `Working on block #${rb.id}`, () => {
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
  return items || `<li class="log-empty">No data yet.</li>`;
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
    ? `· Finished ${today.length} ${today.length === 1 ? "pomo" : "pomos"}`
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
    : `<li class="log-empty">No finished pomos today.</li>`;
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
    { label: "Morning (6–12)", value: 0, color: "#f6cf6b" },
    { label: "Afternoon (12–18)", value: 0, color: "#ff6f61" },
    { label: "Evening (18–24)", value: 0, color: "#6aa9e0" },
    { label: "Night (0–6)", value: 0, color: "#8ed1a0" },
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
  els.timerMode.textContent = `Working on block #${block.id}`;
  startCountdown(durationMin * 60, `Working on block #${block.id}`, () => {
    playChime("work");
    finishBlock(true);
  });
}

async function finishBlock(completed) {
  if (!state.activeBlock) {
    return;
  }
  const block = state.activeBlock;
  state.activeBlock = null;
  await api(`/api/blocks/${block.id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
  if (completed) {
    state.completedWorkBlocks += 1;
  }
  state.pendingTaskId = block.task_id;
  state.pendingDuration = block.durationMin;
  els.timerMode.textContent = "Block ended";
  els.continueRestPrompt.hidden = false;
  await syncNow();
}

function restDurationMinutes() {
  const { longEvery, longRest, shortRest } = state.settings;
  return state.completedWorkBlocks % longEvery === 0 ? longRest : shortRest;
}

function startRest() {
  const minutes = restDurationMinutes();
  const isLong = minutes === state.settings.longRest;
  els.restLabel.textContent = `${isLong ? "Long" : "Short"} rest — ${minutes} min`;
  els.continueRestPrompt.hidden = true;
  els.restPrompt.hidden = false;
  startCountdown(minutes * 60, "Resting", () => {
    playChime("rest");
    els.restPrompt.hidden = true;
    els.timerMode.textContent = "Ready";
    state.mode = "idle";
  });
}

/* ---------- settings ---------- */

function applySettingsToControls() {
  els.durationSelect.value = String(state.settings.defaultDuration);
  state.pendingDuration = state.settings.defaultDuration;
  els.setGoal.value = state.settings.dailyGoal;
  els.setDuration.value = String(state.settings.defaultDuration);
  els.setShortRest.value = state.settings.shortRest;
  els.setLongRest.value = state.settings.longRest;
  els.setLongEvery.value = state.settings.longEvery;
}

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

els.startBtn.addEventListener("click", async () => {
  const taskId = state.selectedTaskId;
  const durationMin = Number(els.durationSelect.value);
  if (!taskId) {
    return;
  }
  try {
    await startBlock(taskId, durationMin);
  } catch (error) {
    els.timerMode.textContent = error.message;
  }
});

els.pauseBtn.addEventListener("click", () => {
  if (state.mode === "paused") {
    resumeTimer();
  } else {
    pauseTimer();
  }
});

els.stopBtn.addEventListener("click", () => {
  clearTimerInterval();
  setTimerUI(false);
  const completed = state.remainingSeconds <= 0;
  finishBlock(completed);
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

els.skipRestBtn.addEventListener("click", () => {
  clearTimerInterval();
  els.restPrompt.hidden = true;
  els.timerMode.textContent = "Ready";
  state.mode = "idle";
  setTimerUI(false);
});

els.rangeSelect.addEventListener("change", renderStats);

els.clearCompletedBtn.addEventListener("click", async () => {
  if (!window.confirm("Delete all completed todos? This removes their pomo history too.")) {
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
  };
  saveSettings(state.settings);
  applySettingsToControls();
  renderMiniCards();
  els.settingsSaved.hidden = false;
  setTimeout(() => {
    els.settingsSaved.hidden = true;
  }, 1500);
});

els.taskList.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  const taskId = Number(target.dataset.id);

  if (action === "filter") {
    state.selectedTag = target.dataset.tag;
    renderAll();
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
    if (!window.confirm(`Delete "${name}"? This removes its pomo history too.`)) {
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
});

/* ---------- drag to reorder (frontend-only) ---------- */

els.taskList.addEventListener("dragstart", (event) => {
  const li = event.target.closest(".task-item");
  if (!li) {
    return;
  }
  state.dragId = Number(li.dataset.id);
  li.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.taskList.addEventListener("dragover", (event) => {
  if (state.dragId === null) {
    return;
  }
  event.preventDefault();
  const over = event.target.closest(".task-item");
  const dragging = els.taskList.querySelector(".task-item.dragging");
  if (!over || !dragging || over === dragging) {
    return;
  }
  const rect = over.getBoundingClientRect();
  const after = event.clientY - rect.top > rect.height / 2;
  els.taskList.insertBefore(dragging, after ? over.nextSibling : over);
});

els.taskList.addEventListener("drop", (event) => {
  event.preventDefault();
  finishDrag();
});

els.taskList.addEventListener("dragend", finishDrag);

function finishDrag() {
  const dragging = els.taskList.querySelector(".task-item.dragging");
  if (dragging) {
    dragging.classList.remove("dragging");
  }
  if (state.dragId === null) {
    return;
  }
  state.dragId = null;
  // Persist the new on-screen order locally; merge ahead of any hidden/filtered ids.
  const shown = [...els.taskList.querySelectorAll(".task-item")].map((li) =>
    Number(li.dataset.id),
  );
  const rest = state.order.filter((id) => !shown.includes(id));
  state.order = [...shown, ...rest];
  saveOrder();
  renderAll();
}

applySettingsToControls();
syncNow();
setInterval(scheduleSync, SYNC_MS);
