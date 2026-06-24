# Honey benchmark — combined

model: `claude-opus-4-8` · 23 tasks · 345 generations · sources: full-opus48

## All tasks

| Variant | Tests pass | Judge ±sd | Judge vs base | Output tok | Output vs base | $ (cached) | $ (cold) | CO₂ (g) |
|---------|-----------:|----------:|--------------:|-----------:|---------------:|-----------:|---------:|--------:|
| baseline | 97% | 94 ±7 | 100% | 90,795 | +0% | $7.015 | $7.015 | 1996.0 |
| caveman | 94% | 94 ±4 | 100% | 71,183 | -22% | $5.720 | $7.319 | 1564.8 |
| ponytail | 90% | 92 ±5 | 98% | 70,644 | -22% | $6.138 | $6.138 | 1553.0 |
| honey | 100% | 93 ±6 | 99% | 77,098 | -15% | $6.253 | $8.658 | 1694.9 |

## Code tasks only

Self-contained functions with unit tests. Easy enough that every variant passes — the quality axis saturates, so only token volume separates them.

| Variant | Tests pass | Judge ±sd | Judge vs base | Output tok | Output vs base | $ (cached) | $ (cold) | CO₂ (g) |
|---------|-----------:|----------:|--------------:|-----------:|---------------:|-----------:|---------:|--------:|
| baseline | 100% | 96 ±7 | 100% | 15,996 | +0% | $1.326 | $1.326 | 351.6 |
| caveman | 100% | 96 ±3 | 101% | 10,051 | -37% | $0.988 | $1.976 | 221.0 |
| ponytail | 100% | 95 ±4 | 99% | 19,882 | +24% | $2.003 | $2.003 | 437.1 |
| honey | 100% | 94 ±7 | 98% | 8,126 | -49% | $0.902 | $2.409 | 178.6 |

## User-facing tasks only (landing page + UI)

Where polish IS the spec. **Tests pass** = structural + accessibility checklist (labels, alt text, responsive, required sections). This is the quality-separating tier.

| Variant | Tests pass | Judge ±sd | Judge vs base | Output tok | Output vs base | $ (cached) | $ (cold) | CO₂ (g) |
|---------|-----------:|----------:|--------------:|-----------:|---------------:|-----------:|---------:|--------:|
| baseline | 95% | 91 ±1 | 100% | 71,555 | +0% | $5.413 | $5.413 | 1573.0 |
| caveman | 90% | 90 ±2 | 99% | 58,635 | -18% | $4.496 | $4.966 | 1289.0 |
| ponytail | 81% | 86 ±2 | 95% | 48,240 | -33% | $3.858 | $3.858 | 1060.5 |
| honey | 100% | 92 ±1 | 101% | 67,389 | -6% | $5.176 | $5.858 | 1481.4 |

## Agent-to-agent / Lever 3 (relay)

A neutral receiver agent answers questions using ONLY the handoff. **Lossless** = receiver got every answer right; **Accuracy** = mean fraction correct. The win is fewer handoff tokens at no loss of recovery.

| Variant | Lossless | Accuracy | Output tok | Output vs base |
|---------|---------:|---------:|-----------:|---------------:|
| baseline | 83% | 98% | 3,244 | — |
| caveman | 67% | 97% | 2,497 | -23% |
| ponytail | 50% | 95% | 2,522 | -22% |
| honey | 100% | 100% | 1,583 | -51% |

