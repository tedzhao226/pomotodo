# Browser-harness e2e test: the pomodoro counters only move on an actual
# (naturally-completed) work block, never on a discarded one.
#
# Run against a live dev server:
#   POMOTODO_DATABASE_URL="sqlite:///./pomotodo_dev.db" uv run uvicorn app.main:app --port 8731 &
#   browser-harness < tests/bh_timer_counts.py
#
# Exits non-zero (raises) on the first failed assertion.

import time

BASE = "http://localhost:8731"
failures = []


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        failures.append(name)


def num(expr):
    return js(expr)


def selected_blocks_done():
    return js(
        "(function(){var id=state.selectedTaskId;"
        "var t=state.dashboard.tasks.find(x=>x.id===id);"
        "return t?t.blocks_done:null;})()"
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

# Deterministic: auto-start-rest off so a completion just shows the prompt.
js("document.querySelector('[data-view=settings]').click()")
time.sleep(0.3)
js(
    "document.getElementById('set-autorest').checked=false;"
    "document.getElementById('settings-form').requestSubmit();"
)
time.sleep(0.3)
js("document.querySelector('[data-view=main]').click()")
time.sleep(0.3)

# Create a fresh task (avoids tasks with a manual blocks_override pinning the badge).
import random

tname = "BHTEST" + str(random.randint(1000, 9999))
js(
    "var i=document.getElementById('task-input');"
    f"i.value={tname!r};"
    "i.closest('form').requestSubmit();"
)
time.sleep(1.0)
js(
    "var rows=[...document.querySelectorAll('#today-list .task-row')];"
    f"var r=rows.find(x=>x.querySelector('.task-name').textContent==={tname!r});"
    "r.click();"
)
time.sleep(0.3)

pomos0 = num("state.stats.all_time_pomos")
done0 = selected_blocks_done()
streak0 = num("state.streakBlocks")
print(f"baseline: pomos={pomos0} blocks_done={done0} streak={streak0}")

# ---- Case 1: discard a work block -> nothing counts, streak resets ----
js("document.getElementById('timer-btn').click()")          # start
time.sleep(0.5)
js("state.remainingSeconds = 1800")                          # ensure NOT natural
js(
    "var b=document.getElementById('timer-btn');"
    "b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));"
)
time.sleep(0.7)                                             # hold > 550ms
js(
    "var b=document.getElementById('timer-btn');"
    "b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));"
    "b.dispatchEvent(new MouseEvent('click',{bubbles:true}));"
)
time.sleep(1.2)                                            # let syncNow settle

check("discard: all_time_pomos unchanged", num("state.stats.all_time_pomos") == pomos0)
check("discard: blocks_done unchanged", selected_blocks_done() == done0)
check("discard: streak reset to 0", num("state.streakBlocks") == 0)
check("discard: no rest prompt", js("document.getElementById('continue-rest-prompt').hidden") is True)
check("discard: phase idle", num("state.phase") == "idle")

# ---- Case 2: complete a work block naturally -> counts +1 ----
js("document.getElementById('timer-btn').click()")          # start
time.sleep(0.5)
js("state.remainingSeconds = 1")                            # fast-forward to natural finish
time.sleep(1.8)                                            # tick to 0 -> onComplete -> finishBlock(true) -> syncNow

check("complete: all_time_pomos +1", num("state.stats.all_time_pomos") == pomos0 + 1)
check("complete: blocks_done +1", selected_blocks_done() == done0 + 1)
check("complete: streak +1", num("state.streakBlocks") == 1)
check("complete: rest offered", js("document.getElementById('continue-rest-prompt').hidden") is False)

print(f"\n{len(failures)} failure(s)" if failures else "\nALL PASSED")
assert not failures, f"bh timer-count test failed: {failures}"
