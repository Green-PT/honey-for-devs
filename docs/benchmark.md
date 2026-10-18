# Benchmark results

Moved from the README; the short version is there.

## Why

Volume is cost. In agentic coding sessions, the volume of generated code and
prose is what runs up the bill — and most of it is waste.

This repo ships a **reproducible benchmark** ([`bench/`](../bench/)) so you don't have
to take the numbers on faith: 23 tasks across three kinds of work — baseline vs
[Caveman](https://github.com/JuliusBrussee/caveman) vs
[Ponytail](https://github.com/DietrichGebert/ponytail) vs Honey — same model, same
prompts, only the skill changes. Correctness is objective (unit tests, structural /
accessibility checks, and lossless round-trip recovery for agent handoffs); quality
is scored by a **judge panel** (median of three or four models; the Opus 4.8 run adds
GPT-5.5 for a cross-family seat) under a **neutral rubric** that says nothing about
length, so a terse skill gets no thumb on the scale. The figures below are the
committed results (Claude Opus 5.5, 3 runs each) — run `cd bench && npm run bench` to
reproduce.

Every number is a **paired per-task delta** vs baseline — runs collapse by median,
tasks pair up, and the figure is the median of those paired deltas with a two-sided
Wilcoxon `p`. Not a ratio of arm totals: that is dominated by whichever task happens
to be longest, and it is how token-saving tools end up publishing numbers nobody can
reproduce. Endpoints and the run ladder are pre-registered in
[`bench/METHODOLOGY.md`](../bench/METHODOLOGY.md).

On **Claude Opus 5.5** against the current upstream skills (Ponytail v5.3.2, Caveman
v4.0.1) — 23 tasks × 3 runs, 276 cells, zero refusals or truncation, 3-judge panel
(Opus 5.5 + Sonnet 5.5 + Haiku 4.5) — [`full-opus55b`](../bench/results/full-opus55b/):

| Variant | Δ LOC | Δ output | Δ cost | Judge W/L/T | Tests |
|---------|------:|---------:|-------:|------------:|------:|
| Caveman | −27% (p<0.001) | −29% (p<0.001) | −26% (p<0.001) | 3/8/10, p=0.227 | 100% |
| Ponytail | **−52%** (p<0.001) | −28% (p=0.002) | −26% (p=0.002) | 1/16/4, **p<0.001** | 100% |
| **Honey** | **−52%** (p<0.001) | **−40%** (p<0.001) | **−31%** (p<0.001) | 5/12/4, p=0.143 | 100% |

A single blended number hides the story, because the levers fire differently per
task type. **Δ LOC** measures Lever 1 directly, **Δ output** measures the tokens (code
*and* the prose around it):

| Task tier | tasks | Honey Δ LOC | Honey Δ output | Ponytail Δ output | Caveman Δ output |
|-----------|------:|------------:|---------------:|------------------:|-----------------:|
| **Code** | 14 | **−65%** (p=0.001) | **−44%** (p=0.002) | −18% (p=0.017) | −31% (p=0.003) |
| **User-facing** | 7 | −35% (p=0.022) | −16% (p=0.022) | −68% (p=0.022) | −27% (p=0.022) |
| **Agent-to-agent** | 2 | — (no code) | −15% (n=2, no p) | +52% | +24% |
| whole suite | 23 | **−52%** (p<0.001) | **−40%** (p<0.001) | −28% (p=0.002) | −29% (p<0.001) |

- **Code** — Honey's deepest cut: −65% of lines and −44% output at 100% unit-test
  pass, a bigger cut than either competitor. The code judge is a tie (2/9/3, p=0.065).
- **User-facing** — Ponytail 5 compresses landing pages hardest (−68% output) and
  loses the judge on all 7 (0/7, p=0.016), though every arm still passes the
  structural/a11y checks. Honey's carve-out keeps the polish: −16% output, judge 3/3/1.
- **Agent-to-agent** — every arm recovers 100% of the adversarial relay queries on
  Opus 5.5. Honey is the only one that shrinks the handoff (−15%); Caveman and Ponytail
  grow it (+24% / +52%). Two tasks, so no p-value. (On Opus 4.8 Caveman and Ponytail
  lost recovery, 67% / 50%; Honey stayed lossless.)
- **Quality is a tie** for Honey (p=0.143) and Caveman (p=0.227) — fewer tokens at
  no measurable quality cost, not higher quality. Ponytail is the one arm the judges
  rank significantly below baseline (1/16/4, p<0.001).
- **Cost is now significant**: −31% (p<0.001) at Opus 5.5 list prices with the skill
  prompt cached. On a cold session Honey still costs more than no skill ($4.54 vs
  $4.04 for the sweep), because its prompt is the largest.
- **Ponytail's own number.** Ponytail 5 reports −45% output on Opus 5.5 in its own
  harness (Claude Code, 39 tasks × 5 runs). This single-call bench measures −28%
  (p=0.002). The harness and the tasks differ, so neither disproves the other.

The measured Honey prompt includes the rule to end with one line naming what was
skipped or not verified; against the Opus 5 stamp it passes the regression gate
(`node bench/src/gate.js full-opus55b full-opus5`). An ablation without that one line
([`full-opus55-noclose`](../bench/results/full-opus55-noclose/)) shows it costs nothing
measurable: output +0.3% (p=0.90), cost +0.4% (p=0.84), judge 4/8/9 (p=0.39). It fires on
16% of replies — see [`METHODOLOGY.md`](../bench/METHODOLOGY.md#closing-line-ablation).

Earlier generations: on **Opus 4.8** against the July 2026 competitor copies
([`full-opus48`](../bench/results/full-opus48/), 4-judge cross-family panel) Honey cut
−43% LOC and −29% output; on **Opus 5** ([`full-opus5-lean`](../bench/results/full-opus5-lean/))
−71% LOC and −38% output, where a 781-token lean rewrite of the skill was tested and
rejected — see [`METHODOLOGY.md`](../bench/METHODOLOGY.md#lean-prompt-ablation).

The output cut holds on GPT-5.5 (−20%, p=0.004; full two-provider table in
[`bench/README.md`](../bench/README.md#results)), but there **cost comes out +14% (ns)**
because no prompt caching engaged in that arm, so every task paid the skill prompt
fresh. On Opus 4.8 Honey was the only variant with no test regressions across all
three tiers.

### End-to-end agentic measurement (Cline harness)

`npm run bench` makes **one API call** per task — clean for isolating the output lever, but it
never exercises an agent loop, tool schemas, or multi-turn context growth, where a real agent's
token bill actually lives. [`bench/src/cline-bench.js`](../bench/src/cline-bench.js)
(`npm run bench:cline`) runs each task *through* the [Cline](https://cline.bot) CLI headless, so
the measured tokens are end-to-end agentic — harness prompt and every loop iteration included.
Honey is injected as a Cline **rule**, recommended as the per-turn-cheap
[`skills/honey/cline-rule.md`](../skills/honey/cline-rule.md) (the operational core; the full
`SKILL.md` re-sent every turn inflates input). See [`bench/README.md`](../bench/README.md#harness-benchmark-cline).

## Input precompression — a measured negative result

The three levers above cut **output**. There's symmetric waste on the **input** side —
filler, pleasantries, and repeated sentences in the prompt itself.
[`hooks/precompress.js`](../hooks/precompress.js) is a deterministic, **no-model** compressor
that strips them before the prompt reaches the LLM, protecting code, paths, URLs,
double-quoted strings, and numbers **verbatim** (it never touches a token you'd need exact).

```bash
printf '%s' 'Hi! Could you please write a function `add(a, b)` that returns their sum? Thanks so much in advance!' | node hooks/precompress-cli.js
# -> write a function `add(a, b)` that returns their sum? in advance!
```

It's safe and lossless (35/35 property checks; on 10 unit-tested tasks the model's output
passes **100%→100%** from full vs compressed prompts), and on *chatty* prompts it cuts a lot —
**−16.5% median** on a hand-written verbose corpus.

**But that corpus flatters it.** Measured on **266 real human-typed prompts** from 35 actual
sessions ([`bench/input/RESULTS.md`](../bench/input/RESULTS.md)), the cut is **2.5% total, median
0%** — 219 of 266 prompts compress to nothing, because real prompts are already terse and carry
almost no filler. Deterministic no-model compression can't catch *reworded* restatement (that
needs a model), so this is the real ceiling, not a tuning problem.

The honest conclusion: **the prompt is the wrong target.** Real input volume in agentic coding
is tool output (CCR's domain) and re-pasted context across turns — not human pleasantries. This
ships as a CLI filter for the chatty-prompt case; it is **not** wired always-on, because on real
traffic it would save ~nothing. Kept here as a measured negative result, in the repo's spirit of
not overstating. Reproduce: `node bench/input/tokens.mjs`.
