# Honey benchmark results

model: `claude-opus-5-5` · judge: `claude-opus-5-5+claude-sonnet-5-5+claude-haiku-4-5` · tasks: 7 · runs: 3

## Paired (headline)

| Variant | n | Δ output | p | Δ LOC | p | Δ new-input | p | Δ cost | p | Judge W/L/T | sign p |
|---------|--:|---------:|--:|------:|--:|------------:|--:|-------:|--:|------------:|-------:|
| honey | 7 | -37% | 0.022 | -40% | 0.022 | -1% | 0.011 | -36% | 0.022 | 0/6/1 | 0.031 |
| honey-design | 7 | -52% | 0.022 | -74% | 0.022 | -1% | 0.011 | -52% | 0.022 | 0/7/0 | 0.016 |

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
| baseline | 100% | 93 ±2 | 100% | 167,358 | +0% | 3,153 | $3.360 | $3.360 | 3679.1 |
| honey | 100% | 92 ±2 | 99% | 123,738 | -26% | 3,111 | $2.509 | $2.925 | 2720.2 |
| honey-design | 100% | 91 ±3 | 98% | 79,185 | -53% | 4,494 | $1.609 | $1.712 | 1740.7 |

Volumes and absolute costs. The *vs base* column here is a ratio of sums and is
outlier-sensitive — one long task can drive it; prefer the paired table above.

- **Tests pass** — objective: extracted code run against unit tests.
- **Judge ±sd** — LLM-as-judge (0-100, panel median) with per-record stdev. A judge gap
  inside ±sd is noise, not a quality win. Rubric: `plain`.
- **$ (cached)** — steady state: cache reads at ≈10% of input, cache *creation* charged.
  **$ (cold)** — first-turn worst case: every input token billed fresh. Real cost sits
  between, nearer cached as a session lengthens. Rates in `bench/pricing.json`.
- **CO₂** via EcoLogits port (`hooks/eco.js`), from output tokens.
