# Honey benchmark — combined

model: `claude-opus-4-8` · 15 tasks · 180 generations · sources: panel-v1

## All tasks

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 96 | 100% | 36,809 | +0% | $2.880 | +0% | 25893.9 |
| caveman | 100% | 96 | 99% | 30,472 | -17% | $2.518 | -13% | 21436.0 |
| ponytail | 100% | 94 | 98% | 31,041 | -16% | $2.861 | -1% | 21836.3 |
| honey | 100% | 96 | 100% | 35,362 | -4% | $2.923 | +1% | 24876.0 |

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
