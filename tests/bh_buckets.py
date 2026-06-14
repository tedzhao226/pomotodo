# Browser-harness e2e test: bucket interactions — move a todo between Today and
# Backlog, and drag-reorder within Today (order persists to the server).
#
# Run against a live dev server:
#   POMOTODO_DATABASE_URL="sqlite:///./pomotodo_dev.db" uv run uvicorn backend.main:app --port 8731 &
#   browser-harness < tests/bh_buckets.py
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
        "var i=document.getElementById('task-input');"
        "i.value=" + repr(name) + ";"
        "i.closest('form').requestSubmit();"
    )
    time.sleep(1.0)


def id_in(list_sel, name):
    return js(
        "(function(){var r=[...document.querySelectorAll('" + list_sel + " .task-row')]"
        ".find(x=>x.querySelector('.task-name').textContent===" + repr(name) + ");"
        "return r?Number(r.dataset.id):null;})()"
    )


def in_list(list_sel, name):
    return js(
        "[...document.querySelectorAll('" + list_sel + " .task-row .task-name')]"
        ".some(x=>x.textContent===" + repr(name) + ")"
    )


def bucket_of(tid):
    return js(
        "(function(){var t=state.dashboard.tasks.find(x=>x.id===" + str(tid) + ");"
        "return t?t.bucket:null;})()"
    )


def click_action(tid, action):
    js(
        "document.querySelector(\".task-item[data-id='" + str(tid) + "'] "
        "[data-action='" + action + "']\").click()"
    )


def today_order(i1, i2):
    return js(
        "[...document.querySelectorAll('#today-list .task-item')]"
        ".map(x=>Number(x.dataset.id))"
        ".filter(id=>id===" + str(i1) + "||id===" + str(i2) + ").join(',')"
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

# ============ move Today <-> Backlog ============
mv = "MOVE" + str(random.randint(1000, 9999))
add_task(mv)
tid = id_in("#today-list", mv)
check("move: starts in Today list", in_list("#today-list", mv) is True)
check("move: starts in today bucket", bucket_of(tid) != "backlog")

click_action(tid, "move")  # -> backlog
time.sleep(1.0)
check("move: now in Backlog list", in_list("#backlog-list", mv) is True)
check("move: gone from Today list", in_list("#today-list", mv) is False)
check("move: bucket is backlog", bucket_of(tid) == "backlog")

click_action(tid, "move")  # -> today
time.sleep(1.0)
check("move: back in Today list", in_list("#today-list", mv) is True)
check("move: bucket no longer backlog", bucket_of(tid) != "backlog")

# ============ drag-reorder within Today ============
a = "ORDA" + str(random.randint(1000, 9999))
b = "ORDB" + str(random.randint(1000, 9999))
add_task(a)
add_task(b)
ia = id_in("#today-list", a)
ib = id_in("#today-list", b)
before = today_order(ia, ib)
check("reorder: two new todos present in Today", before in (f"{ia},{ib}", f"{ib},{ia}"))

# Drag whichever is first to below the second, so their relative order flips.
first, second = (ia, ib) if before == f"{ia},{ib}" else (ib, ia)
js(
    "(function(){var items=[...document.querySelectorAll('#today-list .task-item')];"
    "var A=items.find(x=>Number(x.dataset.id)===" + str(first) + ");"
    "var B=items.find(x=>Number(x.dataset.id)===" + str(second) + ");"
    "var dt=new DataTransfer();"
    "A.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));"
    "var r=B.getBoundingClientRect();"
    "B.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:dt,clientX:r.left+5,clientY:r.top+r.height-3}));"
    "B.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));"
    "A.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));})()"
)
time.sleep(0.4)
expected = f"{second},{first}"
check("reorder: DOM order flipped", today_order(ia, ib) == expected)

# Persisted to the server: force a fresh sync and re-check the order holds.
js("syncNow()")
time.sleep(1.2)
check("reorder: order persisted after sync", today_order(ia, ib) == expected)

# ---- cleanup ----
for tid in (id_in("#today-list", mv), ia, ib):
    if isinstance(tid, int):
        click_action(tid, "delete")
        time.sleep(0.6)

print(f"\n{len(failures)} failure(s)" if failures else "\nALL PASSED")
assert not failures, f"bh buckets test failed: {failures}"
