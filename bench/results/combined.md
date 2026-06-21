# Honey benchmark — combined

model: `claude-opus-4-8` · 17 tasks · 204 generations · sources: full-v2

## All tasks

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 97 | 100% | 39,961 | +0% | $3.149 | +0% | 28111.2 |
| caveman | 100% | 96 | 99% | 31,866 | -20% | $2.673 | -15% | 22416.6 |
| ponytail | 100% | 95 | 98% | 33,390 | -16% | $3.125 | -1% | 23488.7 |
| honey | 100% | 96 | 99% | 36,999 | -7% | $3.124 | -1% | 26027.5 |

## Code tasks only

Self-contained functions with unit tests. Easy enough that every variant passes — the quality axis saturates, so only token volume separates them.

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 99 | 100% | 11,146 | +0% | $0.937 | +0% | 7840.8 |
| caveman | 100% | 98 | 99% | 8,173 | -27% | $0.807 | -14% | 5749.4 |
| ponytail | 100% | 98 | 99% | 15,450 | +39% | $1.591 | +70% | 10868.5 |
| honey | 100% | 97 | 98% | 6,845 | -39% | $0.753 | -20% | 4815.2 |

## User-facing tasks only (landing page + UI)

Where polish IS the spec. **Tests pass** = structural + accessibility checklist (labels, alt text, responsive, required sections). This is the quality-separating tier.

| Variant | Tests pass | Judge | Judge vs base | Output tok | Output vs base | $ (cached) | $ vs base | CO₂ (g) |
|---------|-----------:|------:|--------------:|-----------:|---------------:|-----------:|----------:|--------:|
| baseline | 100% | 90 | 100% | 25,402 | +0% | $1.923 | +0% | 17869.4 |
| caveman | 100% | 88 | 98% | 21,259 | -16% | $1.636 | -15% | 14955.0 |
| ponytail | 100% | 85 | 94% | 15,421 | -39% | $1.257 | -35% | 10848.1 |
| honey | 100% | 91 | 101% | 28,559 | +12% | $2.195 | +14% | 20090.3 |

## Agent-to-agent / Lever 3 (relay)

A neutral receiver agent answers questions using ONLY the handoff. **Lossless** = receiver got every answer right; **Accuracy** = mean fraction correct. The win is fewer handoff tokens at no loss of recovery.

| Variant | Lossless | Accuracy | Output tok | Output vs base |
|---------|---------:|---------:|-----------:|---------------:|
| baseline | 100% | 100% | 3,413 | — |
| caveman | 100% | 100% | 2,434 | -29% |
| ponytail | 100% | 100% | 2,519 | -26% |
| honey | 100% | 100% | 1,595 | -53% |

