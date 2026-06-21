# Honey benchmark — combined

model: `claude-opus-4-8` · 17 tasks · 204 generations · sources: panel-v1, relay-v1

## All tasks

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 96 | 100% | 40,207 | +0% | $3.167 | +0% | 28284.3 |
| caveman | 100% | 96 | 99% | 32,969 | -18% | $2.748 | -13% | 23192.6 |
| ponytail | 100% | 94 | 98% | 33,597 | -16% | $3.140 | -1% | 23634.3 |
| honey | 100% | 96 | 100% | 36,925 | -8% | $3.086 | -3% | 25975.5 |

## Code tasks only

Self-contained functions with unit tests. Easy enough that every variant passes — the quality axis saturates, so only token volume separates them.

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 98 | 100% | 11,068 | +0% | $0.931 | +0% | 7786.0 |
| caveman | 100% | 97 | 99% | 8,210 | -26% | $0.807 | -13% | 5775.5 |
| ponytail | 100% | 97 | 99% | 15,762 | +42% | $1.614 | +73% | 11088.0 |
| honey | 100% | 98 | 100% | 6,926 | -37% | $0.740 | -21% | 4872.2 |

## User-facing tasks only (landing page + UI)

Where polish IS the spec. **Tests pass** = structural + accessibility checklist (labels, alt text, responsive, required sections). This is the quality-separating tier.

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 90 | 100% | 25,741 | +0% | $1.948 | +0% | 18107.9 |
| caveman | 100% | 89 | 99% | 22,262 | -14% | $1.711 | -12% | 15660.6 |
| ponytail | 100% | 84 | 93% | 15,279 | -41% | $1.247 | -36% | 10748.3 |
| honey | 100% | 91 | 101% | 28,436 | +10% | $2.182 | +12% | 20003.8 |

## Agent-to-agent / Lever 3 (relay)

A neutral receiver agent answers questions using ONLY the handoff. **Lossless** = receiver got every answer right; **Accuracy** = mean fraction correct. The win is fewer handoff tokens at no loss of recovery.

| Variant | Lossless | Accuracy | Output tok | Output vs base |
|---------|---------:|---------:|-----------:|---------------:|
| baseline | 100% | 100% | 3,398 | — |
| caveman | 100% | 100% | 2,497 | -27% |
| ponytail | 100% | 100% | 2,556 | -25% |
| honey | 100% | 100% | 1,563 | -54% |

