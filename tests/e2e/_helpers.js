// Shared helpers for the Playwright e2e specs. The app ships globals (it's a
// classic script with no module exports), so internal state the tests must touch
// is reached via page.evaluate against those globals — the same main-world access
// the old cmux scripts used.
import { expect } from "@playwright/test";

// Navigate and wait until app.js has booted and the first dashboard sync landed.
// The e2e server shares one throwaway DB across serial specs, so a prior test's
// leftover running block or break would rehydrate into this one. Clear both and
// reset the client to idle so every test starts hermetic.
export async function gotoApp(page) {
  await page.goto("/");
  await page.waitForFunction(
    () => typeof state !== "undefined" && state.dashboard !== null,
    null,
    { timeout: 15_000 },
  );
  await page.evaluate(async () => {
    const rb = state.dashboard && state.dashboard.running_block;
    const brk = state.dashboard && state.dashboard.break_state;
    if (!rb && !brk) {
      return; // already clean — skip the extra round-trips (the common case)
    }
    if (rb) {
      try {
        await api(`/api/blocks/${rb.id}`, {
          method: "PATCH",
          body: JSON.stringify({ completed: false }),
        });
      } catch {}
    }
    if (brk) {
      try { await api("/api/break", { method: "DELETE" }); } catch {}
    }
    clearTimerInterval();
    state.activeBlock = null;
    state.activeTaskId = null;
    state.touchedTaskIds = new Set();
    state.running = false;
    state.timerMode = "pomodoro";
    state.deadline = null;
    state.remainingSeconds = timerDurationSeconds();
    // maybeRehydrateTimer also set these from the leftover block; clear them so
    // the next test starts from idle defaults, not a prior test's task.
    state.selectedTaskId = null;
    state.pendingTaskless = false;
    await syncNow();
  });
}

// Deterministic settings (sound/tick off, fixed durations) — mirrors the old
// setSettings helper. `over` overrides individual fields.
export async function setSettings(page, over = {}) {
  await page.evaluate((over) => {
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
  }, over);
}

// Stub window.confirm to a fixed answer (re-callable to flip mid-test).
export async function stubConfirm(page, answer = true) {
  await page.evaluate((a) => {
    window.confirm = () => a;
  }, answer);
}

// Call the app's own api() in-page (reuses fetch + error handling, like the
// original scripts). opts.body must already be a JSON string.
export function evalApi(page, path, opts) {
  return page.evaluate(([p, o]) => api(p, o), [path, opts]);
}

// Read app state in-page: getState(page, () => state.selectedTaskId).
export function getState(page, fn) {
  return page.evaluate(fn);
}

// Add a todo via the real form; return a stable data-id locator + numeric id.
export async function addTodo(page, name, list = "#today-list") {
  await page.fill("#task-input", name);
  await page.press("#task-input", "Enter");
  const byName = page.locator(`${list} .task-item`).filter({ hasText: name });
  await expect(byName).toBeVisible();
  const tid = await byName.getAttribute("data-id");
  return { item: page.locator(`${list} .task-item[data-id="${tid}"]`), tid: Number(tid) };
}

// Click a row action button directly via dispatchEvent — the app's row actions
// are hover-revealed and overlapped by the block badge, so a coordinate click
// (even force:true) can land on the badge. The original scripts used element
// .click(); dispatchEvent('click') is the faithful, overlap-proof equivalent.
export function rowAction(scope, action) {
  return scope.locator(`[data-action="${action}"]`).dispatchEvent("click");
}

// Poll an in-page expression until it equals `value` (waiting on internal state).
export async function expectState(page, fn, value) {
  await expect.poll(() => page.evaluate(fn), { timeout: 7_000 }).toBe(value);
}

// Force the running countdown to complete via the app's deadline, then wait for
// the credit modal (work) or the transition the caller asserts. Fake-clock-free
// fallback used because the app reads Date.now() directly in its tick; the poke
// is deterministic and instant. See timer.spec.js for the clock note.
export async function expireTimer(page) {
  await page.evaluate(() => {
    state.deadline = Date.now() - 1000;
  });
}
