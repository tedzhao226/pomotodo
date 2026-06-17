# TECH — syncNow resilience

## Change

One function, `frontend/app.js` `syncNow()`:

```js
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
  if (dashboard.status === "fulfilled") {
    maybeRehydrateTimer();
  }
}
```

Why each piece:

- `Promise.allSettled` — decouples the two fetches; one rejecting no longer
  discards the other.
- Independent `state.*` assignment — partial success updates its slice only.
- `console.warn` on rejection — replaces the silent `catch {}`; a persistent 5xx
  is now visible in devtools.
- `maybeRehydrateTimer()` gated on dashboard success — `maybeRehydrateTimer` sets
  `state.rehydrated = true` on its first call regardless of data, so calling it
  after a failed dashboard fetch would permanently skip resuming a running block.
  Gate it so rehydrate waits for a good dashboard.
- `renderAll()` is already null-safe (`renderDashboard` returns if
  `!state.dashboard`; stats renders are wrapped in `if (state.stats)`), so a
  partial buffer renders cleanly.

No change to `scheduleSync` (still calls `syncNow`), `api()` (still throws on
non-2xx — correct boundary), or the bootstrap call.

## Tests

- Browser harness (VAL-SYNC-001..003): on a live clean server, monkeypatch the
  global `api` to reject for a chosen path, call `syncNow()`, assert which slices
  updated and that `console.warn` fired. Restore `api`.
- Regression (VAL-SYNC-004): full `tests/e2e_timer.js` (`failedCount: 0`),
  `uv run pytest -q`, `npm test`.

## Risks

- `maybeRehydrateTimer` gating is the one behavioural subtlety — covered by
  VAL-SYNC-003 and the existing rehydrate e2e checks (VAL-BSYNC-*).
- Harness: `cmux browser eval` (not `wait --function`) for assertions; fresh DB;
  settle ~3s after `goto`.
