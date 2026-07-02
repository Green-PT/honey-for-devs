---
name: honey-loop
description: >-
  Cost discipline for recurring /loop runs. A loop multiplies per-iteration cost
  by iteration count, so waste compounds. Encodes cache-aware pacing (avoid the
  300s dead zone), event-driven-over-polling, a no-change short-circuit, a compact
  state handle carried between ticks, and a stop condition. Use when a /loop is
  running or being set up — especially long-lived or frequently-firing ones.
license: MIT
---

# Honey Loop

A loop is the one place token waste *compounds*: `cost = per_tick × ticks`. The
honey levers still apply inside each tick (less code, less prose), but a loop adds
two leaks the single-shot levers don't cover — **re-paying for context** every
wake-up, and **re-doing work** that didn't change. Cut those.

## The five levers

1. **Pace to the cache, skip the dead zone.** The prompt cache TTL is 5 min.
   - `< 270s` → context stays warm; right for actively polling external state.
   - `≥ 1200s` → one cache miss amortized over a long idle wait; the default for
     idle ticks (use **1200–1800s**).
   - **`~300s` is the worst choice** — pays the cache miss without amortizing it.
     Never round to "5 minutes." Drop to 270s or commit to 1200s+.

2. **Event-driven over polling.** Harness-tracked work (background `Bash`, `Agent`,
   `Workflow`) re-invokes you automatically on completion. Don't schedule a short
   tick to poll it — that re-reads full context for nothing. Set a long fallback
   heartbeat (`1200s+`) and let the completion notification drive you. Poll only
   external state the harness can't see (CI, a deploy, a remote queue), at a
   cadence matched to how fast that state actually changes.

3. **No-change short-circuit.** Re-generating output is the bulk of per-tick cost.
   Check cheaply first (a hash, a timestamp, a `git rev-parse`, a status field). If
   nothing changed: emit **one line** and reschedule. Don't redo the task, don't
   re-read the world, don't write a report.

4. **Carry a compact state handle, don't re-derive.** Keep what the loop has done
   so far in a small file (`.honey-loop/state.json` or a `<<honey:HASH>>` stash via
   `eso stash`), and read *that* each tick — not the full history re-discovered from
   scratch. Lever 3b: the cheapest input token is the one that never re-enters context.

5. **Define done; then stop.** An unbounded loop is unbounded cost. State the exit
   condition up front (target reached, N empty ticks, deadline). When met, end the
   loop — omit the wake-up reschedule. "Loop forever" is a bug, not a feature.

## Per-tick output: ultra by default

A loop tick is an agent-to-self / agent-to-log message, not a deliverable. Default
to **ultra**: status line only, near-zero prose. One line is enough —
`tick 4/∞ · no change · next 1800s`. Step up to a full report **only** on the tick
where something actually needs the user (state changed, a decision, an error).

## Don't cut

- The **stop/exit check** — dropping it is how a loop runs all night.
- **Error surfacing** — a tick that hit an error reports it; silent failure in a
  loop hides for hours.
- The **cheap pre-check** in lever 3 — skipping it to "just redo it" defeats the point.
