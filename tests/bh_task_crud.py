# Browser-harness e2e test: task CRUD in the Todos panel — add a todo, select
# it, toggle done/active, inline-edit the name, and soft-delete it.
#
# Run against a live dev server:
#   POMOTODO_DATABASE_URL="sqlite:///./pomotodo_dev.db" uv run uvicorn backend.main:app --port 8731 &
#   browser-harness < tests/bh_task_crud.py
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


def in_today(name):
    return js(
        "[...document.querySelectorAll('#today-list .task-row .task-name')]"
        ".some(x=>x.textContent===" + repr(name) + ")"
    )


def row_id(name):
    return js(
        "(function(){var r=[...document.querySelectorAll('#today-list .task-row')]"
        ".find(x=>x.querySelector('.task-name').textContent===" + repr(name) + ");"
        "return r?Number(r.dataset.id):null;})()"
    )


def status_of(tid):
    return js(
        "(function(){var t=state.dashboard.tasks.find(x=>x.id===" + str(tid) + ");"
        "return t?t.status:null;})()"
    )


def click_action(tid, action):
    js(
        "document.querySelector(\"#today-list .task-item[data-id='" + str(tid) + "'] "
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
js("window.confirm = () => true;")  # auto-accept the delete confirmation

name = "CRUD" + str(random.randint(1000, 9999))

# ---- add ----
js(
    "var i=document.getElementById('task-input');"
    "i.value=" + repr(name) + ";"
    "i.closest('form').requestSubmit();"
)
time.sleep(1.0)
check("add: task appears in Today", in_today(name) is True)

tid = row_id(name)
check("add: task has a server id", isinstance(tid, int) and tid > 0)

# ---- activate (clicking the row selects the task) ----
js("document.querySelector(\"#today-list .task-row[data-id='" + str(tid) + "']\").click()")
time.sleep(0.3)
check("activate: task is selected", js("state.selectedTaskId") == tid)

# ---- toggle -> done ----
click_action(tid, "toggle")
time.sleep(1.0)
check("toggle: status is done", status_of(tid) == "done")
check(
    "toggle: row shows done state",
    js("document.querySelector(\"#today-list .task-item[data-id='" + str(tid) + "']\")"
       ".classList.contains('is-done')") is True,
)

# ---- toggle -> active ----
click_action(tid, "toggle")
time.sleep(1.0)
check("toggle: status is active again", status_of(tid) == "active")

# ---- inline edit the name ----
new_name = name + "X"
click_action(tid, "edit")
time.sleep(0.3)
js(
    "var li=document.querySelector(\"#today-list .task-item[data-id='" + str(tid) + "']\");"
    "li.querySelector(\"[data-field='name']\").value=" + repr(new_name) + ";"
    "li.querySelector(\"[data-action='save']\").click();"
)
time.sleep(1.2)
check("edit: new name shown", in_today(new_name) is True)
check("edit: old name gone", in_today(name) is False)

# ---- delete ----
click_action(tid, "delete")
time.sleep(1.2)
check("delete: task removed from Today", in_today(new_name) is False)

print(f"\n{len(failures)} failure(s)" if failures else "\nALL PASSED")
assert not failures, f"bh task-crud test failed: {failures}"
