# Cross-provider: skills on Opus 4.8 vs gpt-5.5

Each cell: **quality** (panel-median judge, or lossless% for relay) as % of that
provider's own baseline · **output tokens** vs that provider's baseline.

## Code

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 98 (100%) · +0% | 98 (100%) · +0% |
| caveman | 97 (99%) · -26% | 99 (100%) · -39% · ⚠tests 94% |
| ponytail | 97 (99%) · +42% | 95 (96%) · +156% |
| honey | 98 (100%) · -37% | 96 (98%) · -14% · ⚠tests 94% |

## User-facing

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 90 (100%) · +0% | 92 (100%) · +0% |
| caveman | 89 (99%) · -14% | 91 (100%) · -1% |
| ponytail | 84 (93%) · -41% | 91 (99%) · -15% |
| honey | 91 (101%) · +10% | 92 (100%) · -2% |

## Agent-to-agent (Lever 3)

| Variant | Opus 4.8 | gpt-5.5 |
|---------|---|---|
| baseline | 100 (100%) · +0% | 100 (100%) · +0% |
| caveman | 100 (100%) · -27% | 100 (100%) · -14% |
| ponytail | 100 (100%) · -25% | 100 (100%) · -12% |
| honey | 100 (100%) · -54% | 100 (100%) · -29% |
