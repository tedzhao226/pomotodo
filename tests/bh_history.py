# Browser-harness e2e test: the History view lists completed pomos and todos,
# including soft-deleted (archived) todos shown with a "deleted" marker.
#
# Run against a live dev server:
#   POMOTODO_DATABASE_URL="sqlite:///./pomotodo_dev.db" uv run uvicorn backend.main:app --port 8731 &
#   browser-harness < tests/bh_history.py
#
# Pagination is not asserted here (it needs more rows than one page holds); the
# pager wiring is exercised indirectly by openHistory().
#
# Exits non-zero (raises) on the first failed assertion.

import random
import time

BASE = "http://localhost:8731"
failures = []


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        failures.append(name)


def add_task(name):
    js(
        "var i=document.getElementById('task-input');i.value=" + repr(name) + ";"
        "i.closest('form').requestSubmit();"
    )
    time.sleep(1.0)


def id_in(list_sel, name):
    return js(
        "(function(){var r=[...document.querySelectorAll('" + list_sel + " .task-row')]"
        ".find(x=>x.querySelector('.task-name').textContent===" + repr(name) + ");"
        "return r?Number(r.dataset.id):null;})()"
    )


def click_action(tid, action):
    js(
        "document.querySelector(\".task-item[data-id='" + str(tid) + "'] "
        "[data-action='" + action + "']\").click()"
    )


try:
    cdp("Network.clearBrowserCache", {})
except Exception:
    pass
new_tab(BASE)
wait_for_load()
time.sleep(0.3)
js("location.reload(true)")
time.sleep(1.4)
js("window.confirm = () => true;")

# Auto-start-rest off so a completed block just records (no rest countdown).
js("document.querySelector('[data-view=settings]').click()")
time.sleep(0.3)
js(
    "document.getElementById('set-autorest').checked=false;"
    "document.getElementById('settings-form').requestSubmit();"
)
time.sleep(0.3)
js("document.querySelector('[data-view=main]').click()")
time.sleep(0.3)

# ---- complete a pomo on a fresh task ----
t1 = "HPOMO" + str(random.randint(1000, 9999))
add_task(t1)
i1 = id_in("#today-list", t1)
js("document.querySelector(\"#today-list .task-row[data-id='" + str(i1) + "']\").click()")
time.sleep(0.3)
js("document.getElementById('timer-btn').click()")          # start
time.sleep(0.5)
js("state.remainingSeconds = 1")                            # fast-forward to natural finish
time.sleep(1.8)

# ---- soft-delete another task so it lands in todo history as archived ----
t2 = "HDEL" + str(random.randint(1000, 9999))
add_task(t2)
i2 = id_in("#today-list", t2)
click_action(i2, "delete")
time.sleep(1.0)

# ---- open History ----
js("document.querySelector('[data-view=history]').click()")
time.sleep(1.6)

check(
    "history: pomos list has entries",
    js("document.querySelectorAll('#history-pomos .log-item').length") >= 1,
)
check(
    "history: completed task appears in pomos",
    js("document.getElementById('history-pomos').textContent.includes(" + repr(t1) + ")") is True,
)
check(
    "history: pomo total is displayed",
    js("document.getElementById('history-pomo-total').textContent.trim().length") > 0,
)
check(
    "history: todos list has entries",
    js("document.querySelectorAll('#history-todos .history-todo').length") >= 1,
)
check(
    "history: soft-deleted todo shown as deleted",
    js(
        "[...document.querySelectorAll('#history-todos .history-todo-name.is-deleted')]"
        ".some(x=>x.textContent.includes(" + repr(t2) + "))"
    ) is True,
)

# ---- cleanup (t1 is still an active todo; t2 already archived) ----
js("document.querySelector('[data-view=main]').click()")
time.sleep(0.3)
i1b = id_in("#today-list", t1)
if isinstance(i1b, int):
    click_action(i1b, "delete")
    time.sleep(0.6)

print(f"\n{len(failures)} failure(s)" if failures else "\nALL PASSED")
assert not failures, f"bh history test failed: {failures}"
