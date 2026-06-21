# Honey skills — test + benchmark coverage

Every skill and subagent, how it's validated, and the measured result. Three layers:
deterministic (free), live behavioral (API), and the handoff-format gate.

## Live behavioral benchmark

`ANTHROPIC_API_KEY=sk-... node bench/skills/check.mjs` — same task with no skill
(baseline) vs the skill as system prompt; output tokens from the API `usage`; an
objective check that the skill actually did the thing. Claude Opus 4.8 / Haiku 4.5,
1 run.

| Skill | Model | Baseline tok | Skilled tok | Δ tok | Works? | Check |
|---|---|---:|---:|---:|:--:|---|
| honey (core) | opus | 822 | 115 | **−86%** | ✅ | produced `flatten()` |
| honey-review | opus | 392 | 117 | **−70%** | ✅ | named hand-rolled flatten + unused param |
| honey-compress | opus | n/a | 422 | n/a¹ | ✅ | 6/6 rules preserved (lossless) |
| hive-reviewer | haiku | 504 | 287 | **−43%** | ✅ | recovered 10/10 findings, valid JSON |

**honey-hive routing** (does the guide delegate correctly?): ✅ 300-file caller search → `delegate`; ✅ one-line typo in an open file → `inline`.

¹ honey-compress is an **input-side** skill — it shrinks a file re-read every session,
so its one-time response is *larger* by design. The win is fewer input tokens on every
future load; the gate is lossless rule preservation, not response size.

## Deterministic tests (no API)

| Skill | How tested | Result |
|---|---|---|
| all 8 | frontmatter `name` + `description` present | ✅ PASS |
| honey-eco | `node scripts/eco-session.js` runs, yields real numbers from `eco.js` | ✅ runs |
| honey-gain | reads committed `bench/results/combined.md` at runtime | ✅ source present |
| hive-scout/reviewer/builder | handoff format gate, `npm run bench:hive` | ✅ lossless, see below |
| sync | `node scripts/build-rules.js --check` | ✅ 7 files in sync |

## Handoff-format gate (offline, `npm run bench:hive`)

All three subagent return payloads round-trip losslessly; columnar JSON (the default)
vs the pretty JSON an agent emits by default: reviewer **−53%**, scout **−52%**,
builder **−44%** Claude tokens. See [`bench/hive/RESULTS.md`](../hive/RESULTS.md).

## Why some skills aren't in the live table

- **hive-scout / hive-builder** need real tool access (file search / edits) that a bare
  API call can't give — benchmarked by the format gate above + the live relay run
  (`STAMP=hive-p0`, honey −53% at 100% recovery).
- **honey-eco / honey-gain** are deterministic (script + file read), no model involved.

## Reproduce

```bash
node scripts/eco-session.js                          # honey-eco
npm --prefix bench run bench:hive                     # handoff gate (offline)
ANTHROPIC_API_KEY=sk-... node bench/skills/check.mjs  # live behavioral
```

> Generated 2026-06-21, Claude Opus 4.8 / Haiku 4.5, 1 run each. Single-run probes —
> re-run for stable averages. The objective `Works?` column is the trustworthy signal;
> token deltas vary a few points run-to-run with sampling.
