# Cross-provider: skills on Opus 4.8 vs gpt-5.5

Each cell: **quality** (panel-median judge, or lossless% for relay) as % of that
provider's own baseline · **output tokens** vs that provider's baseline.

## Code

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 96 (100%) · +0% | 98 (100%) · +0% |
| caveman | 96 (101%) · -37% | 98 (100%) · -51% · ⚠tests 98% |
| ponytail | 95 (99%) · +24% | 93 (96%) · +56% |
| honey | 94 (98%) · -49% | 97 (99%) · -39% |

## User-facing

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 91 (100%) · +0% · ⚠tests 95% | 93 (100%) · +0% |
| caveman | 90 (99%) · -18% · ⚠tests 90% | 93 (100%) · -6% |
| ponytail | 86 (95%) · -33% · ⚠tests 81% | 93 (100%) · -16% |
| honey | 92 (101%) · -6% | 93 (100%) · -12% · ⚠tests 95% |

## Agent-to-agent (Lever 3)

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 98 (100%) · +0% · ⚠tests 83% | 100 (100%) · +0% |
| caveman | 97 (98%) · -23% · ⚠tests 67% | 100 (100%) · -11% |
| ponytail | 95 (97%) · -22% · ⚠tests 50% | 100 (100%) · -11% |
| honey | 100 (102%) · -51% | 100 (100%) · -39% |
