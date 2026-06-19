const LANG_KEY = "pomotodo.lang";

const MESSAGES = {
  en: {
    "nav.main": "Pomotodo",
    "nav.stats": "Statistics",
    "nav.history": "History",
    "nav.settings": "Settings",

    "history.pomos": "Pomos",
    "history.todos": "Todos",
    "history.deletePomo": "Delete pomo",
    "history.deleteTodo": "Delete todo",
    "status.active": "Active",
    "status.done": "Done",
    "status.archived": "Archived",

    "timer.title": "Timer",
    "timer.ready": "Ready",
    "timer.task": "Task:",
    "timer.noTask": "No task selected",
    "timer.tabPomodoro": "Pomodoro",
    "timer.tabShortBreak": "Short Break",
    "timer.tabLongBreak": "Long Break",
    "tab.work": "Work",
    "tab.rest": "Rest",
    "timer.timeToFocus": "Time to focus!",
    "timer.timeForBreak": "Time for a break!",
    "timer.timeForLongBreak": "Time for a long break!",
    "timer.startCap": "Start",
    "timer.pauseCap": "Pause",
    "timer.skip": "Skip to break",
    "timer.restart": "Restart",
    "timer.confirmDiscard": "Discard this Pomodoro? Progress will not be counted.",
    "timer.confirmSwitch": "Switch active task to {name}?",
    "timer.removeTouched": "Remove from this block",
    "credit.title": "Block done — credit which tasks?",
    "credit.confirm": "Confirm",
    "credit.record": "What did you work on?",
    "credit.titleUntethered": "Block done — what did you finish?",
    "credit.alsoToday": "Also worked on today (no credit)",
    "streak.toLongRest": "{n} to long rest",

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
    "mini.lifetime": "lifetime",
    "mini.done": "{n} done",

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
    "settings.longBreakInterval": "Long break interval",
    "settings.language": "Language",
    "settings.autoStartPomodoros": "Auto start pomodoros",
    "settings.autoStartBreaks": "Auto start breaks",
    "settings.sound": "Sound",
    "settings.tick": "Ticking sound",
    "settings.save": "Save",
    "settings.saved": "Saved",

    "settings.groupGeneral": "General",
    "settings.groupTimer": "Timer",
    "settings.groupAutomation": "Automation",
    "settings.groupSound": "Sound",
    "settings.dailyGoalHint": "Pomodoros you aim to finish each day.",
    "settings.languageHint": "Interface language.",
    "settings.defaultDurationHint": "Length of a new pomodoro.",
    "settings.shortRestHint": "Break after a normal pomodoro.",
    "settings.longRestHint": "Longer break after several pomodoros.",
    "settings.longBreakIntervalHint": "Pomodoros before a long break.",
    "settings.autoStartPomodorosHint": "Start the next pomodoro automatically after a break.",
    "settings.autoStartBreaksHint": "Start the break automatically when a pomodoro ends.",
    "settings.soundHint": "Play a chime when a pomodoro or break ends.",
    "settings.tickHint": "Soft tick every second while a pomodoro runs.",

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
    "row.pin": "Pin to top",
    "row.markDone": "Mark done",
    "row.reopen": "Reopen",
    "row.edit": "Edit",
    "row.delete": "Delete",
    "row.showNote": "Show note",

    "confirm.clearCompleted":
      "Clear completed todos from your list? (History is kept.)",
    "confirm.deleteTask":
      'Remove "{name}" from your todos? (History is kept.)',
    "confirm.deletePomo":
      "Permanently delete this pomo? This cannot be undone.",
    "confirm.deleteTodo":
      "Permanently delete this todo and its pomos? This cannot be undone.",
    "err.endBlock": "Couldn't end block: {msg}",
    "err.move": "Couldn't move task: {msg}",
    "err.saveOrder": "Couldn't save order: {msg}",

    "unit.block.one": "pomo",
    "unit.block.other": "pomos",
    "unit.pomo.one": "pomo",
    "unit.pomo.other": "pomos",
  },

  zh: {
    "nav.main": "Pomotodo",
    "nav.stats": "统计",
    "nav.history": "历史",
    "nav.settings": "设置",

    "history.pomos": "番茄",
    "history.todos": "待办",
    "history.deletePomo": "删除番茄",
    "history.deleteTodo": "删除待办",
    "status.active": "进行中",
    "status.done": "已完成",
    "status.archived": "已归档",

    "timer.title": "计时器",
    "timer.ready": "就绪",
    "timer.task": "任务：",
    "timer.noTask": "未选择任务",
    "timer.tabPomodoro": "番茄钟",
    "timer.tabShortBreak": "短休息",
    "timer.tabLongBreak": "长休息",
    "tab.work": "工作",
    "tab.rest": "休息",
    "timer.timeToFocus": "该专注了！",
    "timer.timeForBreak": "该休息了！",
    "timer.timeForLongBreak": "该长休息了！",
    "timer.startCap": "开始",
    "timer.pauseCap": "暂停",
    "timer.skip": "跳到休息",
    "timer.restart": "重新开始",
    "timer.confirmDiscard": "放弃这个番茄钟？当前进度不会计入统计。",
    "timer.confirmSwitch": "切换当前任务到 {name}？",
    "timer.removeTouched": "从本番茄移除",
    "credit.title": "番茄完成 — 记到哪些任务？",
    "credit.confirm": "确认",
    "credit.record": "你完成了什么？",
    "credit.titleUntethered": "番茄完成 — 你完成了什么？",
    "credit.alsoToday": "今天也做了（不计入）",
    "streak.toLongRest": "还差 {n} 到长休息",

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
    "mini.lifetime": "累计",
    "mini.done": "{n} 已完成",

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
    "settings.longBreakInterval": "长休息间隔",
    "settings.language": "语言",
    "settings.autoStartPomodoros": "自动开始番茄钟",
    "settings.autoStartBreaks": "自动开始休息",
    "settings.sound": "声音",
    "settings.tick": "滴答声",
    "settings.save": "保存",
    "settings.saved": "已保存",

    "settings.groupGeneral": "常规",
    "settings.groupTimer": "计时器",
    "settings.groupAutomation": "自动化",
    "settings.groupSound": "声音",
    "settings.dailyGoalHint": "你每天想完成的番茄数。",
    "settings.languageHint": "界面语言。",
    "settings.defaultDurationHint": "新番茄钟的时长。",
    "settings.shortRestHint": "普通番茄钟后的休息。",
    "settings.longRestHint": "若干番茄钟后的较长休息。",
    "settings.longBreakIntervalHint": "进入长休息前的番茄数。",
    "settings.autoStartPomodorosHint": "休息结束后自动开始下一个番茄钟。",
    "settings.autoStartBreaksHint": "番茄钟结束后自动开始休息。",
    "settings.soundHint": "番茄钟或休息结束时播放提示音。",
    "settings.tickHint": "番茄钟进行时每秒轻响一次。",

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
    "row.pin": "置顶",
    "row.markDone": "标记完成",
    "row.reopen": "重新打开",
    "row.edit": "编辑",
    "row.delete": "删除",
    "row.showNote": "显示笔记",

    "confirm.clearCompleted": "从列表清除已完成待办？（历史保留。）",
    "confirm.deleteTask": "从待办中移除「{name}」？（历史保留。）",
    "confirm.deletePomo": "永久删除这个番茄？此操作不可撤销。",
    "confirm.deleteTodo": "永久删除这个待办及其番茄？此操作不可撤销。",
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

// English pluralizes; Chinese has a single form. Used for "{n} pomos".
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { t, plural, MESSAGES };
}
