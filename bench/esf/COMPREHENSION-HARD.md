# ESF Comprehension — HARD MODE

Models: claude-haiku-4-5-20251001, gpt-4.1-mini · 3 repeats · 12 questions · 50-record block.
Stresses deep indexing, column-matching, aggregation, and nested-cell extraction.

| Format | o200k tokens | Accuracy | deep-index | key-lookup | column-match | aggregate | nested-cell | nested-array |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| JSON | 2217 | 76% | 17% | 100% | 100% | 42% | 100% | 100% |
| JSON-columnar | 1685 | 76% | 8% | 100% | 100% | 50% | 100% | 100% |
| TOON | 1633 | 81% | 8% | 100% | 100% | 75% | 100% | 100% |
| ESF | 1531 | 76% | 8% | 100% | 100% | 50% | 100% | 100% |

## Misses (65)

| Format | Model | Probes | Wanted | Got |
|---|---|---|---|---|
| JSON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-3/module-1038.js` |
| JSON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-0/module-1035.js` |
| JSON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-4/module-1032.js` |
| JSON | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-ui` |
| JSON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| JSON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| JSON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| JSON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-1/module-1022.js` |
| JSON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1030.js` |
| JSON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-5/module-1033.js` |
| JSON | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| JSON | gpt-4.1-mini | deep-index | `team-auth` | `team-api` |
| JSON | gpt-4.1-mini | deep-index | `team-auth` | `team-api` |
| JSON | gpt-4.1-mini | aggregate | `20` | `21` |
| JSON | gpt-4.1-mini | aggregate | `50` | `56` |
| JSON | gpt-4.1-mini | aggregate | `50` | `60` |
| JSON | gpt-4.1-mini | aggregate | `50` | `53` |
| JSON-columnar | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| JSON-columnar | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-3/module-1038.js` |
| JSON-columnar | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-3/module-1038.js` |
| JSON-columnar | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-ui` |
| JSON-columnar | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-ui` |
| JSON-columnar | claude-haiku-4-5-20251001 | aggregate | `20` | `18` |
| JSON-columnar | claude-haiku-4-5-20251001 | aggregate | `20` | `19` |
| JSON-columnar | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1030.js` |
| JSON-columnar | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-5/module-1040.js` |
| JSON-columnar | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-5/module-1047.js` |
| JSON-columnar | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| JSON-columnar | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| JSON-columnar | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| JSON-columnar | gpt-4.1-mini | aggregate | `20` | `22` |
| JSON-columnar | gpt-4.1-mini | aggregate | `20` | `22` |
| JSON-columnar | gpt-4.1-mini | aggregate | `20` | `21` |
| JSON-columnar | gpt-4.1-mini | aggregate | `50` | `52` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-api` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-api` |
| TOON | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-api` |
| TOON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| TOON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| TOON | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| TOON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-5/module-1033.js` |
| TOON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-3/module-1038.js` |
| TOON | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-6/module-1034.js` |
| TOON | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| TOON | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
| ESF | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| ESF | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| ESF | claude-haiku-4-5-20251001 | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| ESF | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-ui` |
| ESF | claude-haiku-4-5-20251001 | deep-index | `team-auth` | `team-ui` |
| ESF | claude-haiku-4-5-20251001 | aggregate | `20` | `17` |
| ESF | claude-haiku-4-5-20251001 | aggregate | `20` | `16` |
| ESF | claude-haiku-4-5-20251001 | aggregate | `20` | `17` |
| ESF | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-5/module-1033.js` |
| ESF | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-4/module-1039.js` |
| ESF | gpt-4.1-mini | deep-index | `src/area-1/module-1036.js` | `src/area-2/module-1037.js` |
| ESF | gpt-4.1-mini | deep-index | `team-auth` | `team-ui` |
