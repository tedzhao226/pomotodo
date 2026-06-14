# Browser-harness e2e test: language switching translates the UI live, and task
# notes render a safe Markdown subset (with raw HTML escaped).
#
# Run against a live dev server:
#   POMOTODO_DATABASE_URL="sqlite:///./pomotodo_dev.db" uv run uvicorn backend.main:app --port 8731 &
#   browser-harness < tests/bh_i18n_notes.py
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


def set_lang(code):
    js(
        "var s=document.getElementById('set-lang');s.value=" + repr(code) + ";"
        "s.dispatchEvent(new Event('change',{bubbles:true}));"
    )
    time.sleep(0.4)


def nav_main_text():
    return js("document.querySelector('[data-view=main]').textContent.trim()")


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

# ============ language switch ============
en_main = js("MESSAGES.en['nav.main']")
zh_main = js("MESSAGES.zh['nav.main']")
check("i18n: en/zh strings differ", isinstance(en_main, str) and en_main != zh_main)

set_lang("en")
check("i18n: English label applied", nav_main_text() == en_main)

set_lang("zh")
check("i18n: Chinese label applied", nav_main_text() == zh_main)

set_lang("en")
check("i18n: switches back to English", nav_main_text() == en_main)

# ============ note Markdown rendering + XSS safety ============
nn = "NOTE" + str(random.randint(1000, 9999))
js(
    "var i=document.getElementById('task-input');i.value=" + repr(nn) + ";"
    "i.closest('form').requestSubmit();"
)
time.sleep(1.0)
tid = id_in("#today-list", nn)

note = (
    "# Title\n\n"
    "**bold** and a [link](https://example.com)\n\n"
    "- one\n- two\n\n"
    "<script>alert(1)</script>"
)
click_action(tid, "edit")
time.sleep(0.3)
js(
    "var li=document.querySelector(\".task-item[data-id='" + str(tid) + "']\");"
    "li.querySelector(\"[data-field='note']\").value=" + repr(note) + ";"
    "li.querySelector(\"[data-action='save']\").click();"
)
time.sleep(1.2)

click_action(tid, "note")  # expand the note panel
time.sleep(0.4)
html = js(
    "(function(){var p=document.querySelector('#today-list .note-panel');"
    "return p?p.innerHTML:null;})()"
)
check("note: panel rendered", isinstance(html, str) and len(html) > 0)
check("note: heading rendered", "<h3>Title</h3>" in (html or ""))
check("note: bold rendered", "<strong>bold</strong>" in (html or ""))
check("note: list rendered", "<li>one</li>" in (html or "") and "<li>two</li>" in (html or ""))
check(
    "note: safe link rendered",
    'href="https://example.com"' in (html or "")
    and 'rel="noopener noreferrer"' in (html or ""),
)
check("note: raw <script> escaped", "<script>" not in (html or ""))

# ---- cleanup ----
click_action(tid, "delete")
time.sleep(0.8)

print(f"\n{len(failures)} failure(s)" if failures else "\nALL PASSED")
assert not failures, f"bh i18n/notes test failed: {failures}"
