# Stats chart tweaks

Two visual changes to the stats charts.

1. The **THIS WEEK** mini card (`#mini-week`) shows only bars + weekday initials.
   Show the actual pomo count per day above each bar.
2. The **Pomodoros over time** wide chart (`#trend-chart`) renders as a line/area.
   Render it as a bar chart instead.

## Acceptance

### VAL-1: Per-day pomo counts on THIS WEEK card
Given the dashboard with pomo blocks this week.
When the THIS WEEK mini card renders.
Then a numeric count sits above each of the 7 day bars, aligned with the weekday
initial below it, today's count emphasized.
Evidence: screenshot of the mini card.

### VAL-2: Pomodoros over time is a bar chart
Given the Statistics view.
When the "Pomodoros over time" chart renders.
Then it draws one bar per day (no line/area path), keeping the existing date axis.
Evidence: screenshot of the stats view.
