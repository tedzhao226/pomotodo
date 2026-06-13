const LANG_KEY = "pomotodo.lang";

const MESSAGES = {
  en: {
    "nav.main": "Main",
    "nav.stats": "Statistics",
    "nav.settings": "Settings",

    "timer.title": "Timer",
    "timer.ready": "Ready",
    "timer.task": "Task:",
    "timer.noTask": "No task selected",
    "timer.start": "▶ Start",
    "timer.pause": "⏸ Pause",
    "timer.resume": "▶ Resume",
    "timer.holdStop": "Hold to stop",
    "timer.holdSkip": "Hold to skip",
    "phase.work": "Work",
    "phase.rest": "Rest",
    "streak.toLongRest": "{n} to long rest",
    "timer.paused": "Paused",
    "timer.blockEnded": "Block ended",
    "timer.working": "Working on block #{id}",
    "timer.resting": "Resting",
    "timer.shortRest": "Short rest — {min} min",
    "timer.longRest": "Long rest — {min} min",

    "prompt.blockFinished": "Block finished. What next?",
    "prompt.continue": "Continue (skip rest)",
    "prompt.takeRest": "Take a rest",
    "prompt.skipRest": "Skip rest",
    "prompt.restTime": "Rest time",

    "today.title": "Today",
    "today.finished": "· Finished {n} {unit}",
    "today.empty": "No finished pomos today.",

    "todos.title": "Todos",
    "todos.clearCompleted": "Clear completed",
    "todos.today": "Today",
    "todos.backlog": "Backlog",
    "todos.planned": "· Planned {n} {unit}",
    "todos.empty": "Nothing here.",
    "todos.addPlaceholder": "Add a todo —  e.g. PTE #learn *5",

    "filter.done": "{n} done",
    "filter.planned": "{n} planned",

    "mini.statistics": "Statistics",
    "mini.thisWeek": "This week",
    "mini.goal": "Goal",
    "mini.dailyGoal": "Daily goal",
    "mini.pomoHistory": "Pomo History",
    "mini.allTimePomos": "All time pomos",
    "mini.todoHistory": "Todo History",
    "mini.allTimeTodos": "All time todos",

    "stats.title": "Statistics",
    "stats.range": "Range",
    "stats.past7": "Past 7 days",
    "stats.past30": "Past 30 days",
    "stats.past90": "Past 90 days",
    "stats.total": "Total Pomodoros",
    "stats.avg": "Daily Average",
    "stats.change": "Monthly Change",
    "stats.overTime": "Pomodoros over time",
    "stats.topTags": "Top Tags",
    "stats.bestWorktime": "Best Worktime",
    "stats.noData": "No data yet.",
    "worktime.morning": "Morning (6–12)",
    "worktime.afternoon": "Afternoon (12–18)",
    "worktime.evening": "Evening (18–24)",
    "worktime.night": "Night (0–6)",

    "settings.title": "Settings",
    "settings.dailyGoal": "Daily goal (pomos)",
    "settings.defaultDuration": "Default duration (min)",
    "settings.shortRest": "Short rest (min)",
    "settings.longRest": "Long rest (min)",
    "settings.longEvery": "Long rest every (pomos)",
    "settings.language": "Language",
    "settings.autoStartRest": "Auto-start rest",
    "settings.sound": "Sound",
    "settings.save": "Save",
    "settings.saved": "Saved",

    "editor.name": "Name",
    "editor.nameHint": "#tag *N supported",
    "editor.done": "Done",
    "editor.estimate": "Estimate",
    "editor.note": "Note",
    "editor.noteHint": "markdown: **bold**, *italic*, - list, [link](url)",
    "editor.notePlaceholder": "Add a note…",
    "editor.started": "Started {t}",
    "editor.ended": "Ended {t}",
    "editor.save": "Save",
    "editor.cancel": "Cancel",

    "row.toBacklog": "→ Backlog",
    "row.toToday": "→ Today",
    "row.markDone": "Mark done",
    "row.reopen": "Reopen",
    "row.edit": "Edit",
    "row.delete": "Delete",
    "row.showNote": "Show note",

    "running.banner": "Running: {name} ({min} min block started {time})",
    "confirm.clearCompleted":
      "Delete all completed todos? This removes their pomo history too.",
    "confirm.deleteTask":
      'Delete "{name}"? This removes its pomo history too.',
    "err.endBlock": "Couldn't end block: {msg}",
    "err.move": "Couldn't move task: {msg}",
    "err.saveOrder": "Couldn't save order: {msg}",

    "unit.block.one": "block",
    "unit.block.other": "blocks",
    "unit.pomo.one": "pomo",
    "unit.pomo.other": "pomos",
  },

  zh: {
    "nav.main": "主页",
    "nav.stats": "统计",
    "nav.settings": "设置",

    "timer.title": "计时器",
    "timer.ready": "就绪",
    "timer.task": "任务：",
    "timer.noTask": "未选择任务",
    "timer.start": "▶ 开始",
    "timer.pause": "⏸ 暂停",
    "timer.resume": "▶ 继续",
    "timer.holdStop": "长按停止",
    "timer.holdSkip": "长按跳过",
    "phase.work": "专注",
    "phase.rest": "休息",
    "streak.toLongRest": "还差 {n} 到长休息",
    "timer.paused": "已暂停",
    "timer.blockEnded": "番茄结束",
    "timer.working": "进行中 · #{id}",
    "timer.resting": "休息中",
    "timer.shortRest": "短休息 — {min} 分钟",
    "timer.longRest": "长休息 — {min} 分钟",

    "prompt.blockFinished": "番茄结束，接下来？",
    "prompt.continue": "继续（跳过休息）",
    "prompt.takeRest": "休息一下",
    "prompt.skipRest": "跳过休息",
    "prompt.restTime": "休息时间",

    "today.title": "今天",
    "today.finished": "· 完成 {n} 个番茄",
    "today.empty": "今天还没有完成的番茄。",

    "todos.title": "待办",
    "todos.clearCompleted": "清除已完成",
    "todos.today": "今天",
    "todos.backlog": "待办池",
    "todos.planned": "· 计划 {n} {unit}",
    "todos.empty": "空空如也。",
    "todos.addPlaceholder": "添加待办 —  例如 PTE #learn *5",

    "filter.done": "已完成 {n}",
    "filter.planned": "计划 {n}",

    "mini.statistics": "统计",
    "mini.thisWeek": "本周",
    "mini.goal": "目标",
    "mini.dailyGoal": "每日目标",
    "mini.pomoHistory": "番茄历史",
    "mini.allTimePomos": "累计番茄",
    "mini.todoHistory": "待办历史",
    "mini.allTimeTodos": "累计待办",

    "stats.title": "统计",
    "stats.range": "范围",
    "stats.past7": "近 7 天",
    "stats.past30": "近 30 天",
    "stats.past90": "近 90 天",
    "stats.total": "番茄总数",
    "stats.avg": "日均",
    "stats.change": "月度变化",
    "stats.overTime": "番茄趋势",
    "stats.topTags": "热门标签",
    "stats.bestWorktime": "高效时段",
    "stats.noData": "暂无数据。",
    "worktime.morning": "上午 (6–12)",
    "worktime.afternoon": "下午 (12–18)",
    "worktime.evening": "晚上 (18–24)",
    "worktime.night": "凌晨 (0–6)",

    "settings.title": "设置",
    "settings.dailyGoal": "每日目标（番茄）",
    "settings.defaultDuration": "默认时长（分钟）",
    "settings.shortRest": "短休息（分钟）",
    "settings.longRest": "长休息（分钟）",
    "settings.longEvery": "每隔多少番茄长休息",
    "settings.language": "语言",
    "settings.autoStartRest": "自动开始休息",
    "settings.sound": "声音",
    "settings.save": "保存",
    "settings.saved": "已保存",

    "editor.name": "名称",
    "editor.nameHint": "支持 #标签 *数字",
    "editor.done": "已完成",
    "editor.estimate": "预估",
    "editor.note": "笔记",
    "editor.noteHint": "markdown：**粗体**、*斜体*、- 列表、[链接](url)",
    "editor.notePlaceholder": "添加笔记…",
    "editor.started": "开始 {t}",
    "editor.ended": "结束 {t}",
    "editor.save": "保存",
    "editor.cancel": "取消",

    "row.toBacklog": "→ 待办池",
    "row.toToday": "→ 今天",
    "row.markDone": "标记完成",
    "row.reopen": "重新打开",
    "row.edit": "编辑",
    "row.delete": "删除",
    "row.showNote": "显示笔记",

    "running.banner": "进行中：{name}（{min} 分钟，开始于 {time}）",
    "confirm.clearCompleted": "删除所有已完成待办？这也会删除它们的番茄历史。",
    "confirm.deleteTask": "删除「{name}」？这也会删除它的番茄历史。",
    "err.endBlock": "无法结束番茄：{msg}",
    "err.move": "无法移动任务：{msg}",
    "err.saveOrder": "无法保存排序：{msg}",

    "unit.block.one": "番茄钟",
    "unit.block.other": "番茄钟",
    "unit.pomo.one": "个番茄",
    "unit.pomo.other": "个番茄",
  },
};

let lang =
  localStorage.getItem(LANG_KEY) ||
  (String(navigator.language || "en").toLowerCase().startsWith("zh")
    ? "zh"
    : "en");

function t(key, vars) {
  const table = MESSAGES[lang] || MESSAGES.en;
  let str = key in table ? table[key] : MESSAGES.en[key];
  if (str == null) {
    return key;
  }
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (m, name) =>
      name in vars ? String(vars[name]) : m,
    );
  }
  return str;
}

// English pluralizes; Chinese has a single form. Used for "{n} blocks/pomos".
function plural(noun, n) {
  return t(`unit.${noun}.${n === 1 ? "one" : "other"}`);
}

function getLang() {
  return lang;
}

function setLang(next) {
  if (!MESSAGES[next]) {
    return;
  }
  lang = next;
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next;
}

// Translate every static node tagged in the HTML.
function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}

document.documentElement.lang = lang;
