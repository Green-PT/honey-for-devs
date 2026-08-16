---
name: honey-gain
description: "Honey benchmark scoreboard vs baseline and rival skills."
version: 1.3.1
author: GreenPT
license: MIT
metadata:
  hermes:
    tags: [token-efficiency, coding]
---

# Honey Gain

Report the **committed** benchmark results — never a guessed or per-session number, and never an embedded copy that can drift from the bench.

## Do

1. Recompute from the committed records at use time — don't recite from memory, and
   prefer the raw records over any rendered table (renderings go stale, the records don't):

   ```bash
   cd bench && node src/report.js --stamp full-opus48 --by-type
   ```

   Offline, no API spend. Swap `--stamp full-gpt55` for the cross-provider figure, drop
   `--by-type` for the whole suite. Hive handoff numbers → [`bench/hive/RESULTS.md`](../../bench/hive/RESULTS.md).
2. Report the tier table terse: **Δ LOC and Δ output, each with its `p`**, judge as
   win/loss/tie, and the test pass-rate, per variant. The tier split *is* the finding —
   deepest on code and handoffs, output a statistical tie on user-facing (the polish
   carve-out). Lead with **Δ LOC**: it measures Lever 1 directly, while output tokens mix
   code with the prose around it, and the two come apart (Ponytail cuts lines but narrates
   at length).

## Rules

- **Never quote a delta without its p-value**, and call `(ns)` results ties, not wins.
  Every figure is a paired per-task median; a ratio of arm totals is not quotable.
- Prose renderings ([`bench/README.md`](../../bench/README.md#results), `results/combined.md`)
  are secondary. If one disagrees with a fresh `--stamp` recompute, the recompute wins —
  say the rendering is out of sync.
- Quality is a **tie**, not a gain — that's the honest claim. Don't upgrade it.
- Cost/CO₂ savings are a *modelled counterfactual*, not measured; those belong to
  `honey-eco`, which labels them. Don't state a dollar saving here.
- Asked for numbers on **this** repo? The bench measures the skill on a fixed task suite,
  not the user's codebase — offer `cd bench && npm run bench`, don't extrapolate.
- One honest caveat, once: 23 author-written tasks, judge noise — the objective test-pass
  column is the trustworthy correctness signal.
- Never resurrect the old unreproducible `92%/78%/73%` / `−57%/−65%/−70%` numbers, or the
  superseded arm-total figures (`−49%` code, `−15%` aggregate) — see [`bench/METHODOLOGY.md`](../../bench/METHODOLOGY.md).
