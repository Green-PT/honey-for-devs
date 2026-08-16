---
name: honey-eco
description: "Report session token and CO2 savings vs no-Honey baseline."
version: 1.3.1
author: GreenPT
license: MIT
metadata:
  hermes:
    tags: [token-efficiency, coding]
---

# Honey Eco

Surface the numbers the carbon badge is based on. **Never estimate by hand** — run the committed report so the figure matches `hooks/eco.js` (the verified EcoLogits v0.8.2 port) exactly.

## Do

Run, from the repo root — zero-dependency, reuses the same `hooks/eco.js` the badge uses:

```bash
node scripts/eco-session.js              # newest session
node scripts/eco-session.js --transcript PATH --mode full
```

Then report terse — output tokens, CO₂eq (g), and the `saved` line — in a line or two. Keep the exact numbers the script prints; don't round away precision.

## Two numbers, two epistemic statuses — never merge them

- **CO₂eq is measured** for this session: real output tokens through the EcoLogits port.
- **`saved` is not.** It is a *modelled counterfactual* — how many tokens a no-Honey run
  would have emitted — taken from a committed bench stamp. Always pass through the
  `basis:` line the script prints (stamp, model, n, p). Never state a savings figure
  without it, and never re-derive one by hand.

When the script prints `saved : —`, no committed stamp covers this session's model. Say
that. Do not extrapolate from another model's ratio — that is exactly how a tool ends up
reporting savings while the invoice goes up.

For the authoritative breakdown (usage + embodied + primary energy) the user can run the Python path, which needs the real package:

```bash
pip install ecologits && python scripts/eco_report.py
```

## Say once, don't bury

The params are **speculative** (Anthropic discloses none). The badge shows **served** impact — EcoLogits' single-stream (batch-1) ceiling divided by `serving_concurrency` (continuous-batching amortization); `eco-session.js`/`eco_report.py` also print the raw ceiling. State that once, briefly, then give the number. The badge renders only in Claude Code (its transcript is all Claude models).

## Boundaries

Report only — don't change config or mode (that's the `/honey` command). The number is a range, not a meter reading; present it as one.
