# Honey benchmark

A **reproducible** benchmark comparing skill configurations on real coding tasks:

| Variant | System prompt |
|---------|---------------|
| `baseline` | none (control) |
| `caveman` | [Caveman](https://github.com/JuliusBrussee/caveman) `SKILL.md` (pinned in [`variants/caveman.md`](variants/caveman.md)) |
| `ponytail` | [Ponytail](https://github.com/DietrichGebert/ponytail) `AGENTS.md` (pinned in [`variants/ponytail.md`](variants/ponytail.md)) |
| `honey` | this repo's [`skills/honey/SKILL.md`](../skills/honey/SKILL.md) (loaded live, no copy to drift) |
| `honey-design` | the web-only satellite [`skills/honey-design/SKILL.md`](../skills/honey-design/SKILL.md) — opt-in, only meaningful on `web` tasks |

Every variant answers the **same** task prompts with the **same** model. The only thing
that changes is the system prompt — so any difference in tokens or quality is the skill.
Because `honey` loads live (no frozen copy), each run **hashes and snapshots** every variant's
resolved system prompt into the result set (`results/<stamp>/systems/` + `meta.variant_hashes`),
so "which honey vs which competitors" is pinned and reproducible per result set.

## What it measures

Per task × variant × run:

1. **Objective correctness** — the code block is extracted from the reply, written to disk,
   and run against a real unit test (`tasks/<id>/test.{py,js}`). Pass = exit 0. No vibes.
2. **Quality** — an LLM judge scores the reply 0–100 on correctness/completeness/clarity
   (see [`src/judge.js`](src/judge.js)). The default rubric (`JUDGE_RUBRIC=plain`) is
   **neutral**: it says *nothing* about length or terseness in either direction, so a terse
   skill gets no thumb on the scale; the only guardrails are correctness-neutral and apply to
   every variant. (`JUDGE_RUBRIC=aware` is the older terseness-tolerant rubric, kept so the two
   can be A/B'd — see *Neutrality safeguards*.) `JUDGE_MODELS=a,b,c` scores with a **panel**;
   the headline is the **median**, which cancels a single judge's self-preference, and the
   report carries the per-record **±sd** so a gap inside the noise band isn't sold as a win.
   `src/rejudge.js` re-scores saved replies with any panel/rubric without regenerating.
3. **Tokens** — input/output/cache from the API `usage`.
4. **CO₂** — via the repo's EcoLogits port ([`hooks/eco.js`](../hooks/eco.js)), from output tokens.
5. **$** — reported two ways: **`$ (cached)`** (steady state, skill prompt prompt-cached) and
   **`$ (cold)`** (first turn, skill prompt billed fresh). Rates in [`pricing.json`](pricing.json).

The headline reduction metric is **output tokens** — the volume each skill directly controls,
and the one number that doesn't depend on caching assumptions.

### Why output tokens, not "billed tokens"

A skill *adds* input (its system prompt) and *cuts* output. But in real agentic use the skill
prompt is loaded once per session and **prompt-cached** — re-read at ~10% input cost, not
re-billed in full on every task. The runner sends the system prompt with `cache_control`, and
`$ (cached)` reflects that. But the cached case is the *best* case, so the report also shows
`$ (cold)` — the skill prompt billed as fresh input on every task — as the worst case. The two
bracket reality (nearer cached as a session lengthens). The honest reading: a skill's **output**
saving is real and caching-independent; its **dollar** saving depends on caching, and on a cold
session a large skill prompt can cost *more* than it saves (see *Results*).

### Neutrality safeguards

The benchmark author also writes the skill, so the apparatus is built to remove the author's
thumb from every place it could land:

- **Neutral judge by default** — `JUDGE_RUBRIC=plain` removes all length/terseness language.
  Re-scoring the same saved replies under `plain` vs the old `aware` rubric moves honey's
  gap-to-baseline by 0–2 points (inside judge noise), i.e. the result is **not** rubric-induced.
- **Cross-family judge panel** — Anthropic *and* OpenAI models judge together, so no single
  model family scores its own (or a rival's) output unchecked.
- **Pinned variants** — every variant's resolved prompt is hashed + snapshotted per run, so a
  live-loaded `honey` can't silently drift against frozen competitors.
- **Block-extraction fix** — when one fenced block already defines the full answer, it is used
  alone (a verbose reply's extra/alternate snippet no longer gets glued on and fails — an
  artifact that penalized verbosity, not correctness). `nblocks` is recorded for audit.
- **Variance shown** (`±sd`) so small judge deltas read as ties, not wins.

## Run it

```bash
cd bench
node src/verify-tests.js        # sanity: every reference solution passes its grader
npm run bench:mock              # full pipeline, no API, no cost — validates everything

export ANTHROPIC_API_KEY=sk-...
npm run bench                   # live

export OPENAI_API_KEY=sk-...
MODEL=gpt-5.4 STAMP=openai npm run bench
```

Knobs (env):

| Var | Default | Meaning |
|-----|---------|---------|
| `MODEL` | `claude-opus-4-8` | model under test (provider routed by name: `gpt-*`/`o*` → OpenAI) |
| `JUDGE_MODELS` | = `MODEL` | judge model(s), comma list = **panel** (median). Mix families for cross-family neutrality |
| `JUDGE_RUBRIC` | `plain` | `plain` (neutral) or `aware` (terseness-tolerant, for A/B) |
| `RECEIVER_MODEL` | = `MODEL` | neutral decoder for `relay` tasks |
| `RUNS` | `1` | repeats per task (use 3+ to average sampling noise) |
| `THINKING` | `0` | extended-thinking token budget (0 = off) |
| `CONCURRENCY` | `4` | parallel API calls |
| `STAMP` | `latest` | results subdirectory name |

The full cross-provider run used: `JUDGE_MODELS=claude-opus-4-8,claude-sonnet-4-6,claude-haiku-4-5-20251001,gpt-5.5`,
`JUDGE_RUBRIC=plain`, `RUNS=3`, once with `MODEL=claude-opus-4-8 STAMP=full-opus48` and once with
`MODEL=gpt-5.5 STAMP=full-gpt55`, then `node src/cross.js "Opus 4.8=full-opus48" "gpt-5.5=full-gpt55"`.

Filters: `node src/run.js --variants honey,baseline --tasks flatten,chunk`.

Results land in `results/<STAMP>/`: `report.md` (the table), `results.json` (every record),
and `raw/` (every full reply, for inspecting *why* a variant scored as it did).

## Harness benchmark (Cline)

`npm run bench` makes **one API call** per cell — it isolates Honey's output lever cleanly, but
never exercises an agent loop, tool definitions, or multi-turn context growth. A real coding
agent's token bill lives mostly in that machinery. `src/cline-bench.js` runs each code task
*through* the [Cline CLI](https://cline.bot) (`cline --json`, headless), so the measured tokens
are end-to-end agentic — system prompt, tool schemas, and every loop iteration included. This is
the layer Cline's SDK/harness rebuild targets, so it's where "does Honey still help on top of a
real harness" gets answered.

Honey is injected as a Cline **rule** (`.clinerules/honey.md`), not a system-prompt override, so
Cline's own harness prompt stays intact. Three payloads (`--honey`):

| payload | rule file | note |
|---------|-----------|------|
| `off` | none | control |
| `compact` | [`skills/honey/cline-rule.md`](../skills/honey/cline-rule.md) | the per-turn-cheap operational core — **recommended** |
| `full` | [`skills/honey/SKILL.md`](../skills/honey/SKILL.md) | whole skill; re-sent every turn, inflates input |

```bash
export ANTHROPIC_API_KEY=sk-...
npm run bench:cline                                  # off,compact · code tasks · RUNS=1
RUNS=3 npm run bench:cline -- --honey off,compact,full

# stable-vs-nightly axis: nightly is the cline@nightly dist-tag. Install it into an isolated
# prefix (so it doesn't clobber the stable global) and point CLINE_BIN at that binary:
npm i --prefix /tmp/cline-nightly cline@nightly
CLINE_BIN=/tmp/cline-nightly/node_modules/.bin/cline npm run bench:cline
```

Tokens come from Cline's final `run_result.aggregateUsage` (cumulative across turns); the file
Cline writes is graded by the *same* `grade()` as the single-turn bench, so correctness is
comparable. Code tasks only — `web`/`relay` tasks don't grade off a written file. Each cell is
checkpointed to `results.json` as it finishes; `--resume` skips cells already recorded (agentic
runs are expensive and get killed). Extra env: `PROVIDER` (default `anthropic`), `CLINE_BIN`
(point at a nightly build), `CLINE_TIMEOUT` (s).

Measured (Opus 4.8, 14 code tasks): `compact` holds Honey's output cut (≈−49% vs `off`) at
**100% test-pass and flat judge**, while `full` inflates per-turn input (the whole skill re-sent
each loop) — which is why `compact` is the shape to ship for agentic use.

## Tasks

Three kinds, set by `meta.type`:

**`code`** — self-contained functions with a unit test. Pass = the extracted code runs green.

| Task | Lang | Category | Tempts |
|------|------|----------|--------|
| `lru-cache` | py | data-structure | hand-rolled vs `OrderedDict` |
| `flatten` | py | algorithm | recursion depth, strings-as-leaves |
| `median-bugfix` | py | bugfix | even-length + no mutation |
| `csv-column-sum` | py | parsing | stdlib `csv` vs manual split |
| `slugify` | py | string | regex vs char loop |
| `parse-pagination` | py | validation | **carve-out**: clamp + reject bad input |
| `format-bytes` | py | formatting | unit loop, rounding |
| `parse-query` | js | parsing | repeated keys, `+`/`%20` |
| `chunk` | js | algorithm | no mutation |
| `memoize` | js | performance | cache key strategy |
| `deep-merge` | js | data | **no-mutation**, nested recursion |
| `retry-backoff` | js | async | retry count, throw last error |
| `interval-merge` | py | algorithm | touching boundary, unsorted, **no-mutation** |
| `round-half-up` | py | bugfix | **stdlib trap**: `round()` is banker's + float-repr error |

> `interval-merge` and `round-half-up` are de-saturation tasks: they punish over-terse or
> blindly-delegated solutions. (Finding: frontier models avoid the `round()` trap, so it
> spreads the *judge*, not pass/fail — code pass-rate still saturates on strong models.)

**`web`** — user-facing HTML/CSS where *polish is the spec*. Two signals:

- **Structural/a11y checklist** (`src/grade-web.js`, gates "tests pass"): only *unambiguous*
  structure and accessibility — doctype, title, viewport, h1, nav, footer, CSS, a real CTA,
  labelled inputs, `alt` on every image. Things a regex can assert without false negatives.
- **Design judge** (carries quality): a senior-design-engineer rubric scoring visual polish,
  completeness, responsiveness, and accessibility from the code. Polish and responsiveness are
  judgment calls a regex gets wrong, so the judge owns them — not the checklist.

This is the tier that tests Honey's visual/UX + accessibility carve-outs — the quality claim
the easy code tasks can't separate.

| Task | Category | Checklist gates | Probes |
|------|----------|-----------------|--------|
| `landing-page` | landing-page | nav, hero, footer, CTA, alt | visual/UX polish |
| `pricing-section` | ui-component | viewport, CSS, CTA | polish on mobile |
| `signup-form` | ui-component | labelled inputs, viewport, CTA | accessibility (prompt never *asks* for labels) |
| `blog-grid` | ui-component | CSS, responsive grid, alt | card layout, responsive richness |
| `dashboard` | ui-component | nav, CSS, semantic structure | information density, hierarchy |
| `feature-section` | ui-component | CSS, CTA, semantic structure | composition, motion |
| `settings-panel` | ui-component | labelled inputs, CSS | form a11y at scale |

> A regex `@media`/`<section>`-count check produced false negatives (fluid flex/grid layouts
> and `<header>`-based heros are valid), so those moved out of the gate and into the judge.

**`relay`** — agent-to-agent handoffs (Honey's Lever 3). The variant encodes a structured
payload for *another agent*; a neutral **receiver agent** (`RECEIVER_MODEL`) then answers
ground-truth questions using ONLY that handoff (`src/relay.js`). There is no prose/design
judge — quality is **lossless recovery**: did the receiver get every answer right? The win is
fewer handoff tokens at no loss of recovery; the risk (a too-clever dense format the receiver
silently misparses) shows up as dropped accuracy.

| Task | Shape | Honey's Lever-3 move |
|------|-------|----------------------|
| `findings-relay` | uniform array of records | TOON tabular (header once + bare rows) |
| `config-relay` | nested / irregular config | compact minified JSON |

The receiver queries are **adversarial** — the exact things a too-clever or lossy handoff drops
silently: ordinal lookup ("the 3rd finding"), counts with a filter ("H-severity findings under
`app/`"), nested positional access ("the 2nd route"), and absence ("is there a rule `csrf`?").
Finding: on `gpt-5.5` every variant stays 100% lossless, but on `claude-opus-4-8` the prose
handoffs **drop** under these queries (baseline 83% / caveman 67% / ponytail 50% of handoffs
fully recovered) while `honey`'s structured format stays **100%** — so the dense format helps
recovery here, it doesn't risk it.

Add a `code` task: drop a folder in `tasks/` with `prompt.md`, `meta.json`, a `test.*`, and a
`reference.*` (the reference must pass `verify-tests`). Add a `web` task: `prompt.md` + a
`meta.json` with `"type": "web"` and a `checks` list. Either is picked up automatically.

## Results

Full cross-provider run — `plain` rubric, 4-judge cross-family panel
(opus + sonnet + haiku + gpt-5.5), 23 tasks, 3 runs. Per cell: **quality** (panel-median judge
as % of that provider's own baseline) · **output tokens vs baseline**. ⚠ flags tests < 100%.
([`results/cross-provider.md`](results/cross-provider.md))

### Code

| Variant | Opus 4.8 | gpt-5.5 |
|---------|----------|---------|
| baseline | 96 (100%) · +0% | 98 (100%) · +0% |
| caveman | 96 (101%) · −37% | 98 (100%) · −51% ⚠98% |
| ponytail | 95 (99%) · **+24%** | 93 (96%) · **+56%** |
| honey | 94 (98%) · **−49%** | 97 (99%) · **−39%** |

### User-facing

| Variant | Opus 4.8 | gpt-5.5 |
|---------|----------|---------|
| baseline | 91 (100%) · +0% ⚠95% | 93 (100%) · +0% |
| caveman | 90 (99%) · −18% ⚠90% | 93 (100%) · −6% |
| ponytail | 86 (95%) · −33% ⚠81% | 93 (100%) · −16% |
| honey | 92 (101%) · −6% | 93 (100%) · −12% ⚠95% |

### Agent-to-agent (Lever 3)

| Variant | Opus 4.8 | gpt-5.5 |
|---------|----------|---------|
| baseline | 98 (100%) · +0% ⚠83% | 100 (100%) · +0% |
| caveman | 97 (98%) · −23% ⚠67% | 100 (100%) · −11% |
| ponytail | 95 (97%) · −22% ⚠50% | 100 (100%) · −11% |
| honey | 100 (102%) · **−51%** | 100 (100%) · **−39%** |

### Aggregate (all 23 tasks, per provider)

| | Opus tests | Opus judge ±sd | Opus out | gpt tests | gpt judge ±sd | gpt out |
|---|-----------:|---------------:|---------:|----------:|--------------:|--------:|
| baseline | 97% | 94 ±7 | +0% | 100% | 96 ±3 | +0% |
| honey | **100%** | 93 ±6 | −15% | 99% | 96 ±4 | −19% |
| ponytail | 90% | 92 ±5 | −22% | 100% | 93 ±11 | +1% |
| caveman | 94% | 94 ±4 | −22% | 99% | 96 ±3 | −17% |

**What it says** — honest reading:

- **`honey` is the only variant that never regresses tests** (100% Opus / 99% gpt) while cutting
  output on every tier, and the only one **lossless on the adversarial relay** (others drop to
  50–67% on Opus). This is the objective, judge-independent result.
- **Quality is a tie, not a gain.** With ±sd of 3–7, honey ≈ baseline everywhere; the win is
  fewer tokens at **no measurable quality cost**, not higher quality.
- **`ponytail` inflates code tokens** (+24% Opus / +56% gpt) — the clearest competitor failure.
- **The dollar win depends on caching.** On a *cold* session honey can cost **more** than
  baseline (Opus `$ (cold)` ≈ $8.66 vs $7.02) — the skill prompt as fresh input outweighs the
  output saving; it only pays off once the prompt is cached.

## Combined report

After running code and web sets into separate stamps, merge them with the code/web split
broken out (the split is the finding):

```bash
node src/combine.js opus48 web48     # -> results/combined.md
```

## Honest limits

- **Small suite.** 23 tasks isn't hundreds. Enough to see the effect and easy to extend; not a
  definitive leaderboard. `RUNS=3+` before quoting a number.
- **Author-written tasks.** The benchmark author writes both the skill and the tasks. The
  *Neutrality safeguards* address the judge, the metric, and variant drift — but not task
  selection. An independent external task suite is the remaining open gap.
- **Code pass-rate saturates** on strong models — they pass nearly everything, so on the code
  tier the only live signal is tokens (the judge ties). The de-saturation tasks help the judge
  spread, not pass/fail. The `web` and adversarial `relay` tiers are where quality differs.
- **Judge noise.** LLM judges are noisy; mitigated by a cross-family panel median + reported
  ±sd, not eliminated. The objective test-pass column is the trustworthy correctness signal.
- **Caching/pricing** are modeled, not invoiced — and `$` swings between `cold` and `cached`.
  Adjust `pricing.json` to your contract.
