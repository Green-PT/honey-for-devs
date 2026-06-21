# Honey benchmark

A **reproducible** benchmark comparing four configurations on real coding tasks:

| Variant | System prompt |
|---------|---------------|
| `baseline` | none (control) |
| `caveman` | [Caveman](https://github.com/JuliusBrussee/caveman) `SKILL.md` (pinned in [`variants/caveman.md`](variants/caveman.md)) |
| `ponytail` | [Ponytail](https://github.com/DietrichGebert/ponytail) `AGENTS.md` (pinned in [`variants/ponytail.md`](variants/ponytail.md)) |
| `honey` | this repo's [`skills/honey/SKILL.md`](../skills/honey/SKILL.md) (loaded live, no copy to drift) |

Every variant answers the **same** task prompts with the **same** model. The only thing
that changes is the system prompt — so any difference in tokens or quality is the skill.

## What it measures

Per task × variant × run:

1. **Objective correctness** — the code block is extracted from the reply, written to disk,
   and run against a real unit test (`tasks/<id>/test.{py,js}`). Pass = exit 0. No vibes.
2. **Quality** — an LLM judge scores the reply 0–100 on correctness/completeness/clarity,
   explicitly told *not* to reward length, penalize terseness, penalize correct stdlib
   delegation, or invent requirements (see [`src/judge.js`](src/judge.js)). Pass
   `JUDGE_MODELS=a,b,c` to score with a **panel** — the headline value is the median, which
   cancels a single judge's self-preference or harshness. `src/rejudge.js` re-scores saved
   replies with any panel without regenerating, to tell a real delta from judge noise.
3. **Tokens** — input/output/cache from the API `usage`.
4. **CO₂** — via the repo's EcoLogits port ([`hooks/eco.js`](../hooks/eco.js)), from output tokens.
5. **$** — cache-aware (see below), rates in [`pricing.json`](pricing.json).

The headline reduction metric is **output tokens** — the volume each skill directly controls,
and the one number that doesn't depend on caching assumptions.

### Why output tokens, not "billed tokens"

A skill *adds* input (its system prompt) and *cuts* output. But in real agentic use the skill
prompt is loaded once per session and **prompt-cached** — re-read at ~10% input cost, not
re-billed in full on every task. The runner sends the system prompt with `cache_control`, and
the `$` column is cache-aware. Counting the full skill prompt as fresh input on every task
(what a naive sum does) overstates a skill's cost several-fold and isn't how anyone is billed.

## Run it

```bash
cd bench
node src/verify-tests.js        # sanity: every reference solution passes its grader
npm run bench:mock              # full pipeline, no API, no cost — validates everything

export ANTHROPIC_API_KEY=sk-...
npm run bench                   # live
```

Knobs (env):

| Var | Default | Meaning |
|-----|---------|---------|
| `MODEL` | `claude-opus-4-8` | model under test |
| `JUDGE_MODEL` | = `MODEL` | judge model |
| `RUNS` | `1` | repeats per task (use 3+ to average sampling noise) |
| `THINKING` | `0` | extended-thinking token budget (0 = off) |
| `CONCURRENCY` | `4` | parallel API calls |
| `STAMP` | `latest` | results subdirectory name |

Filters: `node src/run.js --variants honey,baseline --tasks flatten,chunk`.

Results land in `results/<STAMP>/`: `report.md` (the table), `results.json` (every record),
and `raw/` (every full reply, for inspecting *why* a variant scored as it did).

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

Result on these: every variant stays 100% lossless, and Honey cuts handoff tokens ~54%
(−61% on the uniform array, where TOON shines).

Add a `code` task: drop a folder in `tasks/` with `prompt.md`, `meta.json`, a `test.*`, and a
`reference.*` (the reference must pass `verify-tests`). Add a `web` task: `prompt.md` + a
`meta.json` with `"type": "web"` and a `checks` list. Either is picked up automatically.

## Combined report

After running code and web sets into separate stamps, merge them with the code/web split
broken out (the split is the finding):

```bash
node src/combine.js opus48 web48     # -> results/combined.md
```

## Honest limits

- **Small suite.** Six tasks isn't 20. It's enough to see the effect and easy to extend; it
  is not a definitive leaderboard. Run more tasks and `RUNS=3+` before quoting a number.
- **Judge bias.** LLM judges are noisy and can favor their own style. The objective
  test-pass column is the trustworthy correctness signal; treat the judge as secondary.
- **Code-shaped tasks.** These reward the code lever (Lever 1) and the prose lever (Lever 2);
  they don't exercise Lever 3 (agent-to-agent wire formats) or long-horizon agentic sessions.
- **Caching/pricing** are modeled, not invoiced — adjust `pricing.json` to your contract.
