# Honey benchmark

A **reproducible** benchmark comparing skill configurations on real coding tasks:

| Variant | System prompt |
|---------|---------------|
| `baseline` | none (control) |
| `caveman` | [Caveman](https://github.com/JuliusBrussee/caveman) `SKILL.md` (pinned in [`variants/caveman.md`](variants/caveman.md)) |
| `ponytail` | [Ponytail](https://github.com/DietrichGebert/ponytail) `skills/ponytail/SKILL.md` (pinned in [`variants/ponytail.md`](variants/ponytail.md)) |
| `honey` | this repo's [`skills/honey/SKILL.md`](../skills/honey/SKILL.md) (loaded live, no copy to drift) |
| `honey-design` | the web-only satellite [`skills/honey-design/SKILL.md`](../skills/honey-design/SKILL.md) — opt-in, only meaningful on `web` tasks |

Every variant answers the **same** task prompts with the **same** model. The only thing
that changes is the system prompt — so any difference in tokens or quality is the skill.
Because `honey` loads live (no frozen copy), each run **hashes and snapshots** every variant's
resolved system prompt into the result set (`results/<stamp>/systems/` + `meta.variant_hashes`),
so "which honey vs which competitors" is pinned and reproducible per result set.

## What it measures

Per task × variant × run:

> Endpoints, statistics and the run ladder are pre-registered in
> [`METHODOLOGY.md`](METHODOLOGY.md). Read that before quoting a number.

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
3. **Tokens** — input/output/cache from the API `usage`, kept as four separate classes
   (fresh input, cache creation, cache read, output) because they bill at different rates.
4. **CO₂** — via the repo's EcoLogits port ([`hooks/eco.js`](../hooks/eco.js)), from output tokens.
5. **$** — reported two ways: **`$ (cached)`** (steady state — cache reads at ≈10% of input,
   cache *creation* charged at 1.25×) and **`$ (cold)`** (every input token billed fresh).
   Rates and cache multipliers in [`pricing.json`](pricing.json).

The headline reduction metric is **output tokens** — the volume each skill directly controls,
and the one number that doesn't depend on caching assumptions.

Every reported delta is **paired per task**: runs collapse by median, tasks pair against the
control arm, and the column is the median of those paired deltas with a two-sided Wilcoxon
signed-rank `p`. A ratio of arm totals is still printed for volume, but it is not the claim —
it is dominated by whichever task happens to be longest. See [`METHODOLOGY.md`](METHODOLOGY.md).

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
| `STAMP` | `latest` (`mock-latest` with `--mock`) | results subdirectory name. A live run refuses a stamp that already holds `results.json` unless `--resume`, and a `.lock` stops two runs writing one stamp |
| `JUDGE_NULL_MAX` | `0.05` | exit 1 when more than this share of judge seats returned no score; results are kept, re-judge with `src/rejudge-stamp.js` |

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

### Result on Opus 5.5 (`cline-opus55`)

Cline 3.0.29, 14 code tasks × 3 runs × off / compact / full, 126 agent runs, Haiku 4.5
judge. Every run passed its test.

| Payload | Δ output | Δ LOC | Δ new-input | Δ cost | Δ turns | Judge W/L/T |
|---------|---------:|------:|------------:|-------:|--------:|------------:|
| compact | **−39%** (p=0.001) | **−53%** (p=0.001) | +6% | −1% (ns) | 0 (median 2) | 5/3/6 |
| full | −35% (p=0.001) | −44% (p=0.001) | +47% | **+36%** (p=0.001) | 0 (median 2) | 6/2/6 |

**In a real agent loop the output cut holds and there is no retry tax, but the bill does
not fall.** A session's cost is mostly input (the harness prompt, tool definitions, context
re-sent each turn), so cutting output 39% moves cost by −1%. Sending the whole `SKILL.md`
as a per-turn rule adds 47% new input and makes each task 36% *more* expensive. That is
why the compact rule is the recommended Cline payload, and why the single-call −31% cost
figure is an upper bound, not a promise.

## Regression gate

`skills/honey/SKILL.md` loads live into the bench, so editing the skill silently changes
what future runs measure. The gate makes an edit mean "the numbers were re-verified":

```bash
STAMP=candidate npm run bench            # run the edited skill
npm run gate candidate full-opus48       # compare against the pinned reference stamp
```

`src/gate.js` compares every variant present in both stamps and exits non-zero if tests
drop > `GATE_TESTS` (0.02), judge drops > `GATE_JUDGE` (5 pts), the variant's **paired**
output-vs-baseline reduction shrinks by > `GATE_OUTPUT` (10 pts), or its paired median
agent-turn count grows by > `GATE_TURNS` (10%). The turn rule only fires on stamps that
record `iterations` (the Cline harness bench) and is the one that catches a retry tax:
an edit that cuts output but buys an extra agent turn has saved nothing. Mock stamps only
gate against mock, live against live. CI (`.github/workflows/ci.yml`) runs the unit tests,
`verify-tests`, the mock pipeline for all three benches, and a gate smoke test on every
push/PR — the live gate stays a local, keyed step.

## Loop-tick bench

`src/loop-bench.js` tests the Loops guidance (SKILL.md §Loops + the `honey-loop`
satellite): simulated recurring-loop ticks where the model writes its tick report and
picks its own reschedule via a final `NEXT: <seconds>|STOP` line (apparatus, identical
for every variant). Grading is objective, no judge: poll-external ticks belong in
60–270s, idle ticks in 1200–3600s, 271–1199s is the dead zone the skill names, and the
tick meeting the exit condition must `STOP`. Also reported: mean output tokens per tick
and per *unchanged* tick (the short-circuit claim). Variants: `off`, `honey` (core),
`honey-loop` (core + satellite).

```bash
npm run bench:loop:mock          # pipeline check, no API
RUNS=3 npm run bench:loop        # live
```

## Subagent-dispatch bench

`src/dispatch-bench.js` tests the `SubagentStart` injection (`hooks/honey-subagent.js`,
the mechanical form of `honey-superpowers`): the same code tasks dispatched to a
subagent-framed worker, `plain` vs `directive` (the injected worker block — imported
from the hook, single source of truth). Correctness by the same `grade()` unit tests;
the lever is output tokens.

```bash
npm run bench:dispatch:mock
RUNS=3 npm run bench:dispatch
```

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

Every figure is a **paired per-task median** vs `baseline` with a two-sided Wilcoxon `p`;
judge is an exact sign test over per-task wins/losses/ties. `(ns)` = misses p<0.05, i.e. a
tie. Regenerate any of it offline, no API spend:

```bash
node src/report.js --stamp full-opus55b            # whole suite
node src/report.js --stamp full-opus55b --by-type  # per tier
```

### Opus 5.5 (`full-opus55b`) — current upstream competitors

23 tasks × 3 runs, 276 cells, zero refusals, zero truncation, `MAX_TOKENS=16000`. Judge
panel `claude-opus-5-5,claude-sonnet-5-5,claude-haiku-4-5` (no OpenAI seat: no key), `plain`
rubric; 2 of 756 judge seats null. Competitors pinned 2026-10-18: Ponytail v5.3.2
(`26a0cd68504a`), Caveman v4.0.1 (`947106a852e1`); honey `845b11b11fe9`, which includes
the closing-line rule (name what was skipped or not verified). Run on `cd763a3`, the
first commit with judges that work on thinking-by-default models (see *Judge budget* below).

| Variant | Δ output | Δ LOC | Δ new-input | Δ cost | Judge W/L/T | sign p | Tests |
|---------|---------:|------:|------------:|-------:|------------:|-------:|------:|
| caveman | −29% (p<0.001) | −27% (p<0.001) | −1% | −26% (p<0.001) | 3/8/10 | 0.227 | 100% |
| ponytail | −28% (p=0.002) | −52% (p<0.001) | −1% | −26% (p=0.002) | 1/16/4 | **<0.001** | 100% |
| honey | **−40%** (p<0.001) | **−52%** (p<0.001) | −1% | **−31%** (p<0.001) | 5/12/4 | 0.143 | 100% |

By tier, Δ output · Δ LOC:

| Tier | tasks | caveman | ponytail | honey |
|------|------:|--------:|---------:|------:|
| code | 14 | −31% · −30% | −18% · −34% | **−44% · −65%** |
| user-facing | 7 | −27% · −23% (ns) | −68% · −71% | −16% · −35% |
| agent-to-agent | 2 | +24% | +52% | −15% |

Every arm passes 100% of tests on every tier and recovers 100% of relay queries, so on this
model the differences are volume and judged quality, not correctness. Ponytail 5's −68% on
user-facing pages comes with a 0/7 judge loss (p=0.016) — the "shorter substitute" shape
the [lean-prompt ablation](METHODOLOGY.md#lean-prompt-ablation) predicted. Gate:
`node src/gate.js full-opus55b full-opus5` passes for honey (tests +4 pt, judge +3.8,
paired output reduction −3 pt against a 10-pt limit) and flags caveman (44% → 29%), a
competitor arm whose prompt changed. That is not a Honey regression. The closing-line rule's
own cost is ≈0 (output +0.3%, p=0.90): see the
[closing-line ablation](METHODOLOGY.md#closing-line-ablation).

**Judge budget.** The first Opus 5.5 attempt (discarded) judged with `max_tokens: 200`.
Opus and Sonnet 5.5 think by default and the budget is shared, so 40–57% of their seats
came back empty. `judge.js` now allows 4096 and parses the last `{"score": …}` object.
Any stamp judged by a thinking-by-default model before `cd763a3` should be re-judged with
`src/rejudge-stamp.js` before its judge column is quoted.

### External tasks (`ext-opus55`) — tasks Honey didn't write

21 Python exercises from Exercism ([`tasks-ext/`](tasks-ext/README.md)), picked by a fixed
rule before any run. Opus 5.5, 3 runs, same 3-judge panel, 252 cells, zero refusals.

| Variant | Δ output | Δ LOC | Δ cost | Judge W/L/T | sign p | Tests |
|---------|---------:|------:|-------:|------------:|-------:|------:|
| caveman | −3% (ns) | −2% (p=0.008) | −0% (ns) | 4/3/14 | 1.000 | 100% |
| ponytail | +6% (ns) | −36% (p<0.001) | +7% (ns) | 2/10/9 | **0.039** | 100% |
| honey | **−20%** (p<0.001) | **−36%** (p<0.001) | **−13%** (p=0.002) | 2/9/10 | 0.065 | 95% |

The cut holds on outside tasks but is about half of what the author-written suite shows
(−40% / −52% / −31%), and Honey is the one arm that loses test cells here (60/63 against
baseline 62/63). Two are real misses: on `go-counting` Honey dropped the stub's `WHITE` /
`BLACK` / `NONE` constants, which the hidden tests import (the ladder cut names it judged
unused). On `kindergarten-garden` it wrote "Radish" for "Radishes", a slip baseline also
made once. Read this table, not the author-written one, as the conservative estimate.

**Fixed by a rule, then re-run (`ext-opus55-stub`).** `SKILL.md` now lists, under *Never
cut*, every name a provided stub, interface or public API defines. Re-run with that prompt
(`9dbd635b9fb7`), baseline vs honey: Honey passes **63/63** (baseline 61/63), with output
−21%, LOC −37%, cost −10% (all p≤0.007), judge 3/6/12 (p=0.508). On the main suite
(`full-opus55-stub`) the same prompt gives −42% / −53% / −36% at 69/69 tests, and
`node src/gate.js full-opus55-stub full-opus55b` passes.

### Sonnet 5.5 and Haiku 5.5 (`full-sonnet55`, `full-haiku55`)

Baseline vs honey, 23 tasks × 3 runs, Haiku 4.5 judge (as for the Sonnet 5 / Haiku 4.5
stamps), 138 cells each, zero refusals.

| Model | Δ output | Δ LOC | Δ cost | Judge W/L/T | Tests base → honey |
|-------|---------:|------:|-------:|------------:|-------------------:|
| Sonnet 5.5 | **−37%** (p<0.001) | **−55%** (p<0.001) | **−24%** (p<0.001) | 5/11/5 (p=0.210) | 96% → 99% |
| Haiku 5.5 | −3% (ns) | **−38%** (p=0.001) | +9% (ns) | 6/4/11 (p=0.754) | 100% → 100% |

**On Haiku 5.5 Honey moves tokens into thinking.** On code tasks the visible reply halves
(median 868 → 447 characters, LOC −55%) while billed output rises 593 → 666 tokens: Haiku
5.5 thinks by default and reasons longer under the skill. So `hooks/eco-config.json` gets a
`sonnet-5-5` savings entry and no `haiku-5-5` entry — a Haiku 5.5 session shows no savings
line rather than one the bill doesn't back.

### `honey-design` on Opus 5.5 (`web-opus55-design`)

The 7 user-facing tasks, baseline / honey / honey-design in one run, 3-judge panel, 63
cells. Every page passes the structural and a11y checks in every arm (21/21).

| Variant | Δ output | Δ LOC | Δ cost | Judge W/L/T | sign p |
|---------|---------:|------:|-------:|------------:|-------:|
| honey | −37% (p=0.022) | −40% (p=0.022) | −36% (p=0.022) | 0/6/1 | **0.031** |
| honey-design | −52% (p=0.022) | −74% (p=0.022) | −52% (p=0.022) | 0/7/0 | **0.016** |

**`honey-design` no longer earns its place on Opus 5.5**: it cuts hardest and the judges
rank it below no skill on every page (two drop to 85 and 88), and below core honey head to
head (1/3/3). It stays opt-in and is not loaded automatically. Core honey's web deficit is
small (1–3 judge points per task) but one-directional here, where `full-opus55b` had it
level (3/3/1) with the same prompt. Two runs of 7 tasks don't settle it; treat
user-facing quality on Opus 5.5 as an open question.

### Earlier stamps

Full cross-provider run — `plain` rubric, 4-judge cross-family panel
(opus + sonnet + haiku + gpt-5.5), 23 tasks, 3 runs, stamps `full-opus48` / `full-gpt55`.
These use the **July 2026** competitor copies and the pre-2026-07-30 skill; the current
competitor figures are the Opus 5.5 table above. `Δ LOC` is backfilled from the saved
replies and is valid for these stamps as-is.

### Opus 4.8 (`full-opus48`)

| Variant | Δ output | Δ LOC | Δ new-input | Δ cost | Judge W/L/T | sign p | Tests |
|---------|---------:|------:|------------:|-------:|------------:|-------:|------:|
| caveman | **−22%** (p<0.001) | −28% (p<0.001) | −1% | −10% (p<0.001) | 3/16/2 | **0.004** | 94% |
| ponytail | −7% (ns, p=0.267) | −33% (p=0.028) | +342% | +18% (ns) | 1/19/1 | **<0.001** | 90% |
| honey | **−29%** (p=0.020) | **−43%** (p<0.001) | −1% | −21% (ns, p=0.104) | 8/11/2 | 0.648 | **100%** |
| honey-design | **−29%** (p=0.003) | **−44%** (p<0.001) | −1% | −17% (p=0.017) | 11/7/3 | 0.481 | **100%** |

### gpt-5.5 (`full-gpt55`)

| Variant | Δ output | Δ LOC | Δ new-input | Δ cost | Judge W/L/T | sign p | Tests |
|---------|---------:|------:|------------:|-------:|------------:|-------:|------:|
| caveman | −14% (p=0.020) | +0% (ns) | +865% | +12% (ns) | 8/3/10 | 0.227 | 99% |
| ponytail | +35% (ns, p=0.584) | −7% (ns) | +315% | +42% (ns) | 4/15/2 | **0.019** | 100% |
| honey | **−20%** (p=0.004) | **−18%** (p<0.001) | +573% | +14% (ns, p=0.820) | 6/8/7 | 0.791 | 99% |
| honey-design | −12% (p<0.001) | **−33%** (p<0.001) | +728% | +17% (ns) | 8/6/7 | 0.791 | 97% |

### Opus 5 (`full-opus5-lean`) — current-generation, incl. the lean ablation

23 tasks × 3 runs, single haiku judge, `MAX_TOKENS=16000`. 207 cells, zero refusals,
zero truncation. The judge here is one model rather than the cross-family panel — a
deliberate cost tradeoff, re-scorable offline with `src/rejudge.js`; the objective
columns (tests, Δ LOC, Δ output) don't involve it.

| Variant | Δ output | Δ LOC | Δ cost | Judge W/L/T | sign p | Tests |
|---------|---------:|------:|-------:|------------:|-------:|------:|
| honey | **−38%** (p<0.001) | **−71%** (p<0.001) | −24% (p<0.001) | 10/5/5 | 0.302 | **100%** |
| honey-lean | −35% (p<0.001) | −50% (p<0.001) | **−32%** (p<0.001) | 11/4/5 | 0.118 | 96% |

**Honey's cut is bigger on the newer model, not smaller** — −71% LOC on Opus 5 against
−39% on Opus 4.8 — and it is the only arm with no failing cell (baseline itself fails
four). That is worth stating because the 2026 prompting guidance predicted the opposite;
see [`METHODOLOGY.md`](METHODOLOGY.md#lean-prompt-ablation).

`honey-lean` is the tested-and-rejected 781-token ablation
([`variants/honey-lean.md`](variants/honey-lean.md)): it buys 8 points of cost with 21
points of LOC and three test cells — **a cheaper prompt, not a better one.** It is opt-in
and kept only so the negative result stays reproducible.

### `honey` by tier

Δ output · judge W/L/T with its sign-test `p`:

| Tier | tasks | Opus 4.8 | gpt-5.5 |
|------|------:|---------:|--------:|
| code | 14 | **−39%** (p=0.007) · 2/11/1 (**p=0.022**) | **−24%** (p=0.024) · 5/4/5 (p=1.000) |
| user-facing | 7 | −7% (ns, p=0.673) · 6/0/1 (**p=0.031**) | −10% (ns, p=0.151) · 1/4/2 (p=0.375) |
| agent-to-agent | 2 | −49% (n=2, no p) | −40% (n=2, no p) |

Full tables for every variant: `node src/report.js --stamp <stamp> --by-type`.

**What it says** — honest reading:

- **`honey` is the only variant that never regresses tests** (100% Opus / 99% gpt) while
  cutting output on both providers, and the only one **lossless on the adversarial relay**
  (others drop to 50–67% recovery on Opus). Objective, judge-independent.
- **LOC is the stronger signal, and it says something output tokens don't.** Honey cuts
  **−43% of lines** overall (p<0.001) and **−53% on code tasks** (p=0.002) at 100% test
  pass — a bigger, more significant effect than the token delta, because output tokens
  mix code with the prose around it. It also rehabilitates Ponytail: its output is +60%
  on Opus code tasks, but its *code* is flat (+15%, ns) — it writes small code and
  narrates it at length. Caveman is the reverse on gpt-5.5: −14% output, **+0% LOC**.
- **Quality is a tie overall, and now it's tested** — p=0.648 (Opus) / 0.791 (gpt). But the
  whole-suite tie is two opposing effects cancelling on Opus: honey **wins user-facing
  6/0/1 (p=0.031)** and **loses the code judge 2/11/1 (p=0.022)**. Code tests are 100% for
  every variant there, so the code dip is the judge penalising terse style, not a
  correctness regression — and it does not replicate on gpt-5.5 (p=1.000). Suggestive, not
  established.
- **The tier split is where the output number lives.** −39% on code, a **statistical tie on
  user-facing** work. The visual carve-out is doing exactly what it claims — and "−29%
  overall" should never be quoted as if it applied to a landing page.
- **The dollar saving does not clear significance.** −21% on Opus is p=0.104 (ns) and gpt is
  +14% (ns). 23 tasks is not enough power for a cost claim, and the honest statement is
  "output is down, cost is unproven." On a *cold* session honey still costs **more** than
  baseline (Opus `$ (cold)` $8.74 vs $7.02).
- **Two previously published numbers were outlier artifacts.** `ponytail` at "−22% output"
  was a ratio of arm totals; paired, it is −7% (ns) on Opus and **+35%** on gpt — no
  reduction at all. And `caveman`'s judge *mean* ties baseline exactly (94 vs 94) while the
  sign test shows it losing **16 of 23 tasks** (p=0.004). A mean-of-means hid both.
- **Caching decides whether the output cut reaches the bill.** On Opus the skill prompt is
  written to cache once and read back cheaply, so the typical task pays ≈no extra new input
  (−1%). On gpt every recorded `cache_read` is 0, so each task pays the prompt fresh
  (+573%) and the cut never reaches the invoice. Why OpenAI's automatic caching never
  engaged is unresolved — see [`METHODOLOGY.md`](METHODOLOGY.md#known-limits).

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
