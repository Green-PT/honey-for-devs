# Cross-provider: skills on Opus 4.8 vs GPT-5.5

Each cell: **quality** (panel-median judge, or lossless% for relay) as % of that
provider's own baseline · **output tokens** vs that provider's baseline.

## Code

| Variant | Opus 4.8 | GPT-5.5 |
|---------|---|---|
| baseline | 98 (100%) · +0% | 98 (100%) · +0% · ⚠tests 97% |
| caveman | 98 (100%) · -30% | 97 (99%) · -39% |
| ponytail | 96 (98%) · +38% | 97 (98%) · +114% |
| honey | 97 (99%) · -40% | 98 (99%) · -21% · ⚠tests 97% |

## User-facing

| Variant | Opus 4.8 | GPT-5.5 |
|---------|---|---|
| baseline | 90 (100%) · +0% · ⚠tests 95% | 92 (100%) · +0% |
| caveman | 89 (99%) · -15% · ⚠tests 86% | 92 (100%) · +3% |
| ponytail | 86 (95%) · -31% · ⚠tests 81% | 91 (99%) · -12% |
| honey | 91 (100%) · -4% | 92 (101%) · -7% |

## Agent-to-agent (Lever 3)

| Variant | Opus 4.8 | GPT-5.5 |
|---------|---|---|
| baseline | 100 (100%) · +0% | 100 (100%) · +0% |
| caveman | 100 (100%) · -22% | 100 (100%) · -14% |
| ponytail | 100 (100%) · -21% | 100 (100%) · -12% |
| honey | 100 (100%) · -49% | 100 (100%) · -30% |
