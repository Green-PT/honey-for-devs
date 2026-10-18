# Honey benchmark results

model: `claude-opus-5-5` · judge: `claude-opus-5-5+claude-sonnet-5-5+claude-haiku-4-5` · tasks: 23 · runs: 3

## Paired (headline)

| Variant | n | Δ output | p | Δ LOC | p | Δ new-input | p | Δ cost | p | Judge W/L/T | sign p |
|---------|--:|---------:|--:|------:|--:|------------:|--:|-------:|--:|------------:|-------:|
| caveman | 23 | -29% | <0.001 | -27% | <0.001 | -1% | <0.001 | -26% | <0.001 | 3/8/10 | 0.227 |
| ponytail | 23 | -28% | 0.002 | -52% | <0.001 | -1% | <0.001 | -26% | 0.002 | 1/16/4 | <0.001 |
| honey | 23 | -40% | <0.001 | -52% | <0.001 | -1% | <0.001 | -31% | <0.001 | 5/12/4 | 0.143 |

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
| baseline | 100% | 94 ±2 | 100% | 198,972 | +0% | 13,821 | $4.035 | $4.035 | 4374.1 |
| caveman | 100% | 94 ±3 | 99% | 144,334 | -27% | 15,301 | $2.972 | $3.388 | 3172.9 |
| ponytail | 100% | 91 ±5 | 97% | 85,641 | -57% | 14,651 | $1.786 | $2.035 | 1882.7 |
| honey | 100% | 94 ±3 | 99% | 152,147 | -24% | 18,893 | $3.195 | $4.536 | 3344.7 |

Volumes and absolute costs. The *vs base* column here is a ratio of sums and is
outlier-sensitive — one long task can drive it; prefer the paired table above.

- **Tests pass** — objective: extracted code run against unit tests.
- **Judge ±sd** — LLM-as-judge (0-100, panel median) with per-record stdev. A judge gap
  inside ±sd is noise, not a quality win. Rubric: `plain`.
- **$ (cached)** — steady state: cache reads at ≈10% of input, cache *creation* charged.
  **$ (cold)** — first-turn worst case: every input token billed fresh. Real cost sits
  between, nearer cached as a session lengthens. Rates in `bench/pricing.json`.
- **CO₂** via EcoLogits port (`hooks/eco.js`), from output tokens.
