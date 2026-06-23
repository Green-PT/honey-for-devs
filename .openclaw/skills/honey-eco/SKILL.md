---
name: honey-eco
description: "Report the session's Honey savings: output tokens, CO2, and CO2/$ saved vs a no-Honey baseline, via the committed EcoLogits port."
homepage: https://github.com/Green-PT/honey-for-devs
license: MIT
---

# Honey Eco

Surface the numbers the carbon badge is based on. **Never estimate by hand** — run the committed report so the figure matches `hooks/eco.js` (the verified EcoLogits v0.8.2 port) exactly.

## Do

Run, from the repo root — zero-dependency, reuses the same `hooks/eco.js` the badge uses:

```bash
node scripts/eco-session.js              # newest session
node scripts/eco-session.js --transcript PATH --mode full
```

Then report terse — output tokens, CO₂eq (g), and `saved (~R% vs no-Honey)` — in a line or two. Keep the exact numbers the script prints; don't round away precision.

For the authoritative breakdown (usage + embodied + primary energy) the user can run the Python path, which needs the real package:

```bash
pip install ecologits && python scripts/eco_report.py
```

## Say once, don't bury

The params are **speculative** (Anthropic discloses none). The badge shows **served** impact — EcoLogits' single-stream (batch-1) ceiling divided by `serving_concurrency` (continuous-batching amortization); `eco-session.js`/`eco_report.py` also print the raw ceiling. State that once, briefly, then give the number. The badge renders only in Claude Code (its transcript is all Claude models).

## Boundaries

Report only — don't change config or mode (that's the `/honey` command). The number is a range, not a meter reading; present it as one.
