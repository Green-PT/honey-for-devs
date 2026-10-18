# Honey benchmark results

model: `claude-opus-5-5` · judge: `claude-opus-5-5+claude-sonnet-5-5+claude-haiku-4-5` · tasks: 21 · runs: 3

## Paired (headline)

| Variant | n | Δ output | p | Δ LOC | p | Δ new-input | p | Δ cost | p | Judge W/L/T | sign p |
|---------|--:|---------:|--:|------:|--:|------------:|--:|-------:|--:|------------:|-------:|
| caveman | 21 | -3% (ns) | 0.126 | -2% | 0.008 | -0% | <0.001 | -0% (ns) | 0.578 | 4/3/14 | 1.000 |
| ponytail | 21 | +6% (ns) | 1.000 | -36% | <0.001 | -0% | <0.001 | +7% (ns) | 0.835 | 2/10/9 | 0.039 |
| honey | 21 | -20% | <0.001 | -36% | <0.001 | -0% | <0.001 | -13% | 0.002 | 2/9/10 | 0.065 |

Every Δ is a **per-task** delta vs `baseline`: runs collapse by median, tasks pair up,
and the column is the median of those paired deltas. `p` is a two-sided Wilcoxon
signed-rank test (`—` when fewer than 6 non-tied tasks — no significance is claimed there).
`(ns)` marks a delta that misses p<0.05: a tie, not a win. **Judge W/L/T** counts tasks
where the variant scored above / below / level with baseline, tested with an exact sign
test — the right test for ordinal, noisy judge scores, and one a mean-of-means can hide.

- **Δ output** — the headline lever: volume each skill directly controls, caching-independent.
- **Δ new-input** — fresh + cache-creation tokens, the class where a skill prompt *costs*.
  Cache reads are excluded: they bill at a tenth and dominate a long session regardless.
- **Δ cost** — all four token classes at `bench/pricing.json` rates.

## Arm totals

| Variant | Tests pass | Judge ±sd | Judge vs base | Output tok | Output vs base | New input tok | $ (cached) | $ (cold) | CO₂ (g) |
|---------|-----------:|----------:|--------------:|-----------:|---------------:|--------------:|-----------:|---------:|--------:|
| baseline | 98% | 95 ±4 | 100% | 55,234 | +0% | 61,254 | $1.350 | $1.350 | 1214.2 |
| caveman | 100% | 95 ±1 | 100% | 52,595 | -5% | 62,746 | $1.325 | $1.704 | 1156.2 |
| ponytail | 100% | 94 ±4 | 99% | 53,411 | -3% | 62,096 | $1.330 | $1.557 | 1174.2 |
| honey | 95% | 94 ±8 | 99% | 44,170 | -20% | 61,128 | $1.194 | $2.441 | 971.0 |

Volumes and absolute costs. The *vs base* column here is a ratio of sums and is
outlier-sensitive — one long task can drive it; prefer the paired table above.

- **Tests pass** — objective: extracted code run against unit tests.
- **Judge ±sd** — LLM-as-judge (0-100, panel median) with per-record stdev. A judge gap
  inside ±sd is noise, not a quality win. Rubric: `plain`.
- **$ (cached)** — steady state: cache reads at ≈10% of input, cache *creation* charged.
  **$ (cold)** — first-turn worst case: every input token billed fresh. Real cost sits
  between, nearer cached as a session lengthens. Rates in `bench/pricing.json`.
- **CO₂** via EcoLogits port (`hooks/eco.js`), from output tokens.
