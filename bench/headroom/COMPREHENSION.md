# CCR Comprehension — does the crushed view still answer?

Models: claude-opus-4-8, gpt-5.5 · 2 repeat(s) · 6 questions over a 90-row log.
Tokens (o200k): full 1623 → crushed 300 (-82%). Kept 15 rows, dropped 75.

| Condition | SIGNAL | AGGREGATE | DROPPED | Overall | Retrieve rate |
|---|---:|---:|---:|---:|---:|
| full | 100% | 100% | 100% | 100% | 0% |
| crushed | 100% | 100% | 88% | 96% | 0% |
| crushed+retrieve | 100% | 100% | 100% | 100% | 50% |

## Misses

| Condition | Model | Class | Wanted | Got |
|---|---|---|---|---|
| crushed | claude-opus-4-8 | DROPPED | `event 1 on worker 1` | `I don't have enough information to answe` |

Run: `ESO_MODELS=... ESO_REPEATS=3 node bench/headroom/comprehension.mjs`. Requires API keys.
