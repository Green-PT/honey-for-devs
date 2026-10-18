# Methodology

Pre-registered before the next paid run. The point of writing it down is that the
endpoints can't be chosen after seeing the numbers.

## Why this exists

Two published "token saving" add-ons have now been measured by an independent paired
benchmark and both came in far below their claim — [caveman](https://blog.jetbrains.com/ai/2026/06/caveman-claude-code-token-savings/)
(advertised −65%, measured −8.5%) and [rtk](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/)
(advertised −60–90%, measured **+7.6% more expensive** at low reasoning effort, p=0.004,
with quality tied).

rtk's own dashboard reported 96.2M tokens saved across the same trials where the invoice
went up. Three mechanisms did that, and all three are general:

1. **Wrong counterfactual.** It scored the full raw output as what "would have" been
   billed, including outputs the harness truncates anyway.
2. **Wrong token class.** It counted tokens at execution time; most of a session's input
   cost is cached re-reads billed at a tenth of the price.
3. **Wrong denominator.** The lever only ever touched a fraction of context.

Honey's lever is on the other side of the pipe — **output** tokens, uncached, billed at
5× input — so it is not exposed to (2) and (3) the way rtk was. But nothing about being
on the right side of the pipe protects a *claim*. The rules below exist so Honey's numbers
are the ones an independent paired benchmark would reproduce.

## Endpoints

**Primary**

| Endpoint | Definition |
|---|---|
| Δ output tokens | paired per-task median vs the control arm |
| Δ LOC | paired per-task median non-blank lines of extracted code — Lever 1 measured directly |
| Δ cost | paired per-task median vs the control arm, all four token classes |

Output tokens are a *proxy* for Lever 1: a reply can be terse in prose and still emit a
bloated function, or the reverse. `Δ LOC` measures the code itself, and the two do come
apart — on `full-opus48` code tasks Ponytail is +60% output but flat on LOC. Backfill it
into an existing stamp from the saved replies with `node src/backfill-loc.js <stamp>`.

**Secondary**

| Endpoint | Definition |
|---|---|
| Δ new-input | fresh + cache-creation tokens — the class where a skill prompt *costs* |
| Δ turns | paired median agent iterations (harness bench only — the retry tax) |

**Quality**

| Endpoint | Definition |
|---|---|
| Test pass-rate | primary, objective: extracted code run against a real unit test |
| Judge sign test | secondary: exact two-sided sign test over per-task wins/losses |

A skill that cuts output while adding agent turns has saved nothing. That is the failure
mode that made rtk net-negative, and `Δ turns` is the only endpoint that can see it — the
single-call bench (`src/run.js`) structurally cannot.

## Statistics

- **Paired only.** Every delta compares the same task across arms. A task missing or
  errored in either arm is excluded from **both**.
- **Runs collapse by median**, not mean, so one bad sample can't move a cell.
- **Never a ratio of arm totals.** `sum(honey)/sum(baseline)` is dominated by whichever
  task happens to be longest. Reported for volume only, never as the claim.
- **Wilcoxon signed-rank**, two-sided, for continuous endpoints. Below 6 non-tied tasks no
  p-value is reported at all — the exact two-sided p cannot reach 0.05 there.
- **Exact sign test** for judge scores: ordinal and noisy, and a mean-of-means hides
  per-task losses. (Worked example: on `full-opus48` caveman's *mean* judge ties baseline
  exactly — 94 vs 94 — while the sign test shows it losing 16 of 23 tasks, p=0.004.)
- **`(ns)` is printed on any delta that misses p<0.05.** A tie gets called a tie.

Implementation: [`src/paired.js`](src/paired.js), unit-tested in
[`../tests/paired.test.js`](../tests/paired.test.js) against exact enumeration.

## Run ladder

Never quote k=1. In order, cheapest first:

1. **Free replay** — recompute over committed stamps: `node src/report.js --stamp <stamp>`.
   No API spend. Every methodology change must be validated here first.
2. **Ceiling analysis** — before claiming a lever helps, compute from real transcripts what
   share of the bill it can even touch. This is the free step that predicted rtk's result,
   and it is the step that argues against building rtk-style Bash-output filtering here.
3. **Wiring check** — one cell, live, to prove the treatment actually fires.
4. **Smoke** — a task subset at `RUNS=1`. Diagnostic only, never quoted.
5. **`RUNS=3` on the same subset** — most k=1 scares are sampling noise.
6. **Full suite at `RUNS=3`**, per provider.

## Instrument the treatment, don't assume it

Every result set snapshots each variant's resolved system prompt plus its hash
(`results/<stamp>/systems/`, `meta.variant_hashes`), so "the skill didn't help" can always
be distinguished from "the skill never loaded".

## Lean-prompt ablation

Both major labs changed their prompting guidance in 2026, in the same direction, and
it lands squarely on a skill like this one:

- **OpenAI (GPT-5.6):** leaner system prompts measured **+10–15% eval score with 41–66%
  fewer total tokens** and 33–67% lower cost. Reserve `ALWAYS`/`NEVER`/`must` for true
  invariants. Simplify by ablation — *"remove one group of instructions, examples, or
  tools at a time, then rerun the same evals."*
- **Anthropic (Claude Fable 5):** prompts written for prior models *"are often too
  prescriptive and reduce output quality"*; A/B with the older scaffolding removed.

`variants/honey-lean.md` is that ablation: the irreducible core (the ladder, the
never-cut invariants, the user-facing carve-out, Lever 3) at **781 tokens** against the
shipped skill's 3607, with absolute-language instances cut from 42 to 6. It is a
**candidate replacement** for the core skill, not a satellite — if it wins, `honey`
becomes lean rather than gaining a sibling.

Two things make this measurable rather than a matter of taste:

- **A specific predicted failure.** OpenAI warns that on GPT-5.6 a generic "be concise"
  instruction can make the model *"produce a shorter substitute instead of the full
  requested artifact."* We already see that shape in our own data: on `full-gpt55`, the
  web tier is the one place honey regresses tests (**95% vs baseline 100%**). `honey-lean`
  reframes Lever 2 as *selection, not compression* and states artifact completeness as a
  requirement. If that's the mechanism, its web-tier pass-rate recovers.
- **The endpoints are already paired.** Δ LOC and Δ output separate "writes less code"
  from "says less about it" — a lean prompt that keeps the LOC cut while shedding 2800
  tokens of its own weight is a clean win; one that loses the LOC cut is not.

Run it opt-in:

```bash
RUNS=3 MAX_TOKENS=16000 node src/run.js --variants baseline,honey,honey-lean
```

### Result: the hypothesis failed (`full-opus5-lean`, Opus 5, 23 tasks × 3 runs)

207 clean cells, zero refusals, zero truncation, $15.49.

| | Δ output | Δ LOC | Δ cost | Tests | Judge W/L/T |
|---|---:|---:|---:|---:|---:|
| honey | −38% (p<0.001) | **−71%** (p<0.001) | −24% (p<0.001) | **100%** | 10/5/5 (p=0.302) |
| honey-lean | −35% (p<0.001) | −50% (p<0.001) | **−32%** (p<0.001) | 96% | 11/4/5 (p=0.118) |

**`honey-lean` is a cheaper prompt, not a better one — do not promote it.** It matches
on output tokens and wins 8 points of cost (its prompt is a fifth the weight: new-input
15,745 vs 23,607), but surrenders **21 points of LOC reduction** — Lever 1, the thing the
skill exists for — and three test cells.

The specific prediction above failed **in the opposite direction**. `honey-lean` was
written to recover the web-tier "shorter substitute" regression; instead web tests went
100% → 90% (both failures `blog-grid`), and `honey` won the web judge outright — 6/0/1,
**p=0.031**, the only significant judge result in the run. The verbose user-facing
carve-out is load-bearing; thinning it cost both tests and judged quality.

So the 2026 "less prescriptive" guidance does **not** transfer to this skill at the
endpoints that matter for it. Where lean does hold up is the code tier (output −50% vs
−45%, cost −46% vs −34%, LOC −64% vs −72%) and relay (−63% vs −50%). A middle variant —
lean's structure with the user-facing carve-out restored in full — is the open candidate.

## Hazard: Fable 5 refusals silently corrupt a run

**Do not benchmark on Fable 5 until this is fixed.** A parallel Fable 5 run (23 tasks × 3,
$15.23) was discarded: **24 of 207 cells returned `stop_reason: "refusal"`.** Fable 5 runs
safety classifiers that decline a request with HTTP 200 and near-empty content, and they
fired on ordinary coding tasks — `slugify`, `csv-column-sum`, `memoize`.

The distribution is what makes it dangerous rather than merely noisy:

| Arm | Refused cells |
|---|---:|
| baseline | **19** |
| honey | 0 |
| honey-lean | 5 |

All 24 scored as test *failures*, and a refused cell emits a median 105 output tokens
against 484 for a clean one. The control arm was disproportionately silenced, which
**manufactures a large fake win for the treatment** — that run showed `baseline 71% tests`
and a nonsense `relay Δoutput +6013%`. Published uncritically it would have been Honey's
best-ever numbers and entirely an artifact.

`client.js` records `stop_reason` — the only reason this was caught — but still treats a
refusal as a normal empty response. Before Fable 5 enters a sweep: record refused cells as
`passed: null` so `paired.js` drops the task from **both** arms, report the exclusion
count, and opt into `fallbacks` (see the `claude-api` refusal guidance). The same check is
worth running on any provider that can decline a request without erroring.

**Not universal.** Kimi K3's own guidance runs the other way — context-heavy, with
"explicit constraints, edge cases, and verification steps" made visible in the prompt.
Don't generalize a lean-prompt win on one model family to all of them; sweep per model.

## Competitor pins

`variants/caveman.md` and `variants/ponytail.md` are frozen copies of the upstream
prompts, so a live-loaded `honey` can't drift against moving competitors mid-experiment.
The cost is that they go stale: both were refreshed on 2026-07-30 after upstream revisions
(Caveman dropped prose abbreviations and causal arrows from `ultra` on tokenizer grounds
and restated its headline from "~75%" to "65% (measured)"; Ponytail added a repo-reuse
rung, an understand-before-you-climb guard, and a root-cause rule). Refreshed again on
2026-10-18 after both rewrote their skills: Ponytail `skills/ponytail/SKILL.md` at
`df9e899` (v5.3.2) and Caveman `skills/caveman/SKILL.md` at `2178ed6` (unchanged through
v4.0.1). Every competitor column in a stamp older than that describes the July pins. Re-check them before
any paid run — comparing against a year-old competitor is not a fair benchmark, and the
refresh invalidates prior stamps for competitor columns.

## Known limits

Carried from [README](README.md#honest-limits), plus what this document adds:

- **23 tasks, author-written.** Enough to see an effect; not a leaderboard. The neutrality
  safeguards cover the judge, the metric and variant drift — not task selection. An
  independent external suite is the open gap.
- **Caching is modelled, not invoiced.** `pricing.json` rates are approximate and the
  cache multipliers are list prices, not a contract.
- **The single-call bench sees no agent loop.** Δ turns only exists on the Cline harness
  bench (`src/cline-bench.js`); treat single-call cost deltas as an upper bound on the
  benefit, since they cannot show a retry tax.
- **Provider caching differs and is not yet equalised.** On `full-opus48` the skill prompt
  lands in `cache_write` once and is read back cheaply, so the typical task pays ≈no extra
  new input (paired Δ new-input −1%) even though the sweep total is +38%. On `full-gpt55`
  every recorded `cache_read` is 0, so every task pays the prompt fresh: Δ new-input
  **+573%** and Δcost **+14% (ns)** despite Δoutput of −20% (p=0.004).
  The harness maps OpenAI's `input_tokens_details.cached_tokens` correctly
  ([`src/client.js:112`](src/client.js:112)), so the zero is what the API reported, not a
  recording bug — but *why* automatic caching never engaged across 23 tasks × 3 runs
  sharing one system prefix is **unresolved**. Until it is, the gpt-5.5 cost delta is
  evidence of neither a saving nor a penalty; the output delta stands on its own.
