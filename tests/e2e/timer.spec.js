// Migrated from tests/e2e_timer.js — the stateless-block timer state machine
// (~90 checks). This suite drives the app's in-page state machine and pure
// globals (timerIsPaused, updateTabTitle, formatTime) that app.js exposes only as
// in-page bindings, so it runs in-page via page.evaluate and asserts the per-check
// report. Time is advanced by poking the app's deadline (instant), not real waits.
import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers.js";
import { timerSuite } from "./_timer-suite.js";

test("timer state machine (full suite)", async ({ page }) => {
  test.setTimeout(90_000); // the suite runs ~20s of stepped interactions
  await gotoApp(page);
  const report = await page.evaluate(timerSuite);
  expect(
    report.failed,
    `timer suite: ${report.passed} passed, ${report.failedCount} failed\n` +
      report.failed.join("\n"),
  ).toEqual([]);
});
