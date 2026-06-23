---
name: honey-gain
description: "Show Honey's benchmark scoreboard: committed quality and token results per task tier vs Caveman, Ponytail, and no-skill. One-shot."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Gain

Report the **committed** benchmark results — never a guessed or per-session number, and never an embedded copy that can drift from the bench.

## Do

1. Read the committed scoreboard at use time — don't recite from memory:
   - Per-tier table → [`bench/results/combined.md`](../../bench/results/combined.md) (code / user-facing / agent-to-agent split — the split *is* the finding).
   - The hive's own handoff numbers → [`bench/hive/RESULTS.md`](../../bench/hive/RESULTS.md).
2. Report the tier table terse: quality (judge vs baseline %, or lossless recovery for handoffs) and output tokens vs baseline, per variant. Honey leads quality in every tier while cutting tokens where it's safe — deepest on code and handoffs, *spending* more on user-facing polish (the carve-out).

## Rules

- Quote only what `bench/results/` currently holds. If `combined.md` and the README disagree, trust `bench/results/` (the harness output) and say they're out of sync.
- Asked for numbers on **this** repo? The bench measures the skill on a fixed task suite, not the user's codebase — offer to run `cd bench && npm run bench`, don't extrapolate.
- One honest caveat, once: small suite, judge noise — the objective test-pass column is the trustworthy correctness signal.
- Never resurrect the old unreproducible `92%/78%/73%` / `−57%/−65%/−70%` numbers (see the README honesty note).
