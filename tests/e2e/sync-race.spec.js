// Regression: a newly created task must not vanish when a concurrent sync's
// (older, task-less) dashboard response resolves *after* the fresh one.
//
// Root cause: the 15s periodic sync and the post-create sync both call
// syncNow(), which writes state.dashboard with no ordering guard. When the
// stale response lands last, it clobbers the task until the next refresh.
// Fix: a generation token in syncNow() discards any response that is not from
// the most recently started sync.
import { test, expect } from "@playwright/test";
import { gotoApp, setSettings } from "./_helpers.js";

const uniq = (p) => `${p}${Date.now().toString().slice(-5)}`;

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await setSettings(page);
});

test("stale dashboard response cannot clobber a fresher sync", async ({ page }) => {
  const name = uniq("RACE");
  // Create the task server-side so a real dashboard has it.
  await page.evaluate((n) => api("/api/tasks", { method: "POST", body: JSON.stringify({ raw: n }) }), name);
  await page.evaluate(() => syncNow());

  // Two snapshots the test will feed back: fresh (task present) and stale (task absent).
  const { fresh, stale } = await page.evaluate((n) => {
    const fresh = JSON.parse(JSON.stringify(state.dashboard));
    const stale = JSON.parse(JSON.stringify(fresh));
    stale.tasks = stale.tasks.filter((t) => t.name !== n);
    return { fresh, stale };
  }, name);
  expect(fresh.tasks.some((t) => t.name === name)).toBe(true);
  expect(stale.tasks.some((t) => t.name === name)).toBe(false);

  // Override the global api() so two overlapping syncNow() calls resolve in the
  // worst-case order: stale (slow) resolves AFTER fresh (fast).
  const survived = await page.evaluate(async ({ fresh, stale, name }) => {
    const realApi = window.api;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    let dash = 0;
    window.api = async (path) => {
      if (path === "/api/dashboard") {
        const n = ++dash;
        if (n === 1) {
          await delay(200);
          log.push(`dash#${n} stale`);
          return stale;
        }
        log.push(`dash#${n} fresh`);
        return fresh;
      }
      if (path === "/api/stats") return realApi("/api/stats");
      return realApi(path);
    };
    const gen0 = syncGeneration;
    try {
      const slow = syncNow(); // gen gen0+1, stale payload resolves last
      const fast = syncNow(); // gen gen0+2, fresh payload resolves first
      await Promise.all([slow, fast]);
    } finally {
      window.api = realApi;
    }
    const present = state.dashboard.tasks.some((t) => t.name === name);
    return { present, gen0, finalGen: syncGeneration, log };
  }, { fresh, stale, name });

  expect(survived.log).toContain("dash#2 fresh");
  expect(survived.present, "new task survived a stale-sync clobber").toBe(true);
});
