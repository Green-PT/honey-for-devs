# Honey hive — handoff benchmark

The hive subagents (`hive-scout`, `hive-reviewer`) return their results as Honey
Lever-3 handoffs. This measures that the format they emit is **smaller** than what
an agent naively returns, and **lossless** — the orchestrator recovers every fact.

Two layers, both reproducible:

## 1. Format size (offline, no API)

`node bench/hive/check.mjs` — the exact payloads the subagents return, every format
round-tripped losslessly *before* measurement, sized with the same two tokenizers
the ESO bench uses (Claude `@anthropic-ai/tokenizer`, OpenAI `o200k_base`).

**hive-reviewer findings** (10-record uniform array):

| Format | Bytes | vs pretty | Claude tok | o200k tok | lossless |
|---|---:|---:|---:|---:|:--:|
| pretty JSON | 1540 | 0% | 586 | 553 | ✓ |
| compact JSON | 1119 | -27% | 384 | 334 | ✓ |
| **columnar JSON** (default) | 796 | **-48%** | **276** | 244 | ✓ |
| ESO (opt-in) | 665 | -57% | 268 | 195 | ✓ |

**hive-scout hits** (5-record locate map):

| Format | Bytes | vs pretty | Claude tok | o200k tok | lossless |
|---|---:|---:|---:|---:|:--:|
| pretty JSON | 579 | 0% | 226 | 219 | ✓ |
| compact JSON | 398 | -31% | 139 | 125 | ✓ |
| **columnar JSON** (default) | 288 | **-50%** | **108** | 98 | ✓ |
| ESO (opt-in) | 229 | -60% | 105 | 79 | ✓ |

**hive-builder changes** (3-record manifest): columnar `84` Claude tok vs pretty
`151` — **−44%**, lossless; ESO `86`.

Columnar JSON — the hive default — saves **44–53% of Claude tokens** vs the pretty
JSON a subagent emits by default, with zero loss. ESO buys a little more but costs a
format primer; it stays opt-in for high-volume cached pipes. The check exits non-zero
if any format fails to round-trip or the default fails to beat pretty JSON.

## 2. End-to-end recovery (live)

The format alone is only half the claim — a too-dense handoff a receiver silently
misparses would *look* cheaper while dropping accuracy. The relay tier
(`bench/tasks/findings-relay`, `config-relay`) encodes a payload, then a separate
**receiver agent** answers ground-truth questions using only that handoff. Quality is
lossless recovery, not prose.

Live, `claude-opus-4-8`, `STAMP=hive-p0`:

| Variant | Recovery | Output tok | vs baseline | $ vs base |
|---------|---------:|-----------:|------------:|----------:|
| baseline | 100% | 1,135 | +0% | +0% |
| caveman | 100% | 818 | -28% | -25% |
| ponytail | 100% | 855 | -25% | -3% |
| **honey** | **100%** | **537** | **-53%** | **-43%** |

The Honey Lever-3 format the hive emits cuts handoff size **~53% at no loss of
recovery** — the biggest, cleanest win of any tier.

Reproduce:

```bash
cd bench
npm run bench:hive                                   # offline, no key
ANTHROPIC_API_KEY=sk-... STAMP=hive-p0 \
  node src/run.js --tasks findings-relay,config-relay # live recovery
```

> Generated 2026-06-21, Node v22.13.0. The live `$`/CO₂ figures are modeled, not
> invoiced (see `bench/README.md`). The receiver column is the trustworthy signal:
> smaller handoff, every answer still correct.
