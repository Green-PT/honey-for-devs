---
name: honey-eco
description: "Report the session's tokens, CO2e and water, plus CO2 saved vs a no-Honey baseline, via the committed token-based estimator."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Eco

Surface the numbers the carbon badge is based on. **Never estimate by hand** — run the committed report so the figure matches `hooks/eco.js` (the Llopis-Garcia 2026 token-based method with SAEF v3.2.0 factors) exactly.

## Do

Run, from the repo root — zero-dependency, reuses the same `hooks/eco.js` the badge uses:

```bash
node scripts/eco-session.js              # newest session
node scripts/eco-session.js --transcript PATH --mode full
```

Then report terse — tokens, CO₂e (g), water (mL), and the `saved` line — in a line or two. Keep the exact numbers the script prints; don't round away precision.

## Two numbers, two epistemic statuses — never merge them

- **CO₂e and water are computed** from this session's real tokens (input, cache, output) through the estimator.
- **`saved` is not.** It is a *modelled counterfactual* — how many tokens a no-Honey run
  would have emitted — taken from a committed bench stamp. Always pass through the
  `basis:` line the script prints (stamp, model, n, p). Never state a savings figure
  without it, and never re-derive one by hand.

When the script prints `saved : —`, no committed stamp covers this session's model. Say
that. Do not extrapolate from another model's ratio — that is exactly how a tool ends up
reporting savings while the invoice goes up.

## Say once, don't bury

Closed models are estimated by **size class** (mean of measured open-weight models), on a global-average grid, and the paper calls its energy term best-case (2.0–2.8× serving-regime range; the script prints a high case). `saved` covers output tokens only — Honey doesn't cut the input and cache that dominate an agentic session. State that once, briefly, then give the number. The badge renders only in Claude Code (its transcript is all Claude models).

## Boundaries

Report only — don't change config or mode (that's the `/honey` command). The number is a range, not a meter reading; present it as one.
