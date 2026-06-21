# Cross-provider: skills on Opus 4.8 vs gpt-5.5

Each cell: **quality** (panel-median judge, or lossless% for relay) as % of that
provider's own baseline · **output tokens** vs that provider's baseline.

## Code

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 98 (100%) · +0% | 98 (100%) · +0% · ⚠tests 97% |
| caveman | 98 (100%) · -32% | 98 (100%) · -31% · ⚠tests 97% |
| ponytail | 97 (99%) · +31% | 95 (97%) · +142% · ⚠tests 97% |
| honey | 97 (99%) · -46% | 98 (100%) · -24% |

## User-facing

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 91 (100%) · +0% · ⚠tests 95% | 92 (100%) · +0% |
| caveman | 89 (98%) · -23% · ⚠tests 86% | 92 (100%) · -4% |
| ponytail | 85 (94%) · -33% · ⚠tests 90% | 91 (99%) · -12% |
| honey | 91 (100%) · -7% | 92 (100%) · -11% |

## Agent-to-agent (Lever 3)

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 100 (100%) · +0% | 100 (100%) · +0% |
| caveman | 100 (100%) · -30% | 100 (100%) · -10% |
| ponytail | 100 (100%) · -26% | 100 (100%) · +1% |
| honey | 100 (100%) · -52% | 100 (100%) · -39% |
