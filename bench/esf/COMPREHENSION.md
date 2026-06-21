# ESF Comprehension vs TOON vs JSON

Models: claude-haiku-4-5-20251001, gpt-4.1-mini · 3 repeat(s) · 10 questions.
Each answer is checked against the source object. Accuracy is the quality axis;
tokens are the efficiency axis. The best format maximizes accuracy per token.

| Format | o200k tokens | Accuracy | Correct/Total |
|---|---:|---:|---:|
| JSON | 436 | 100.0% | 60/60 |
| JSON-columnar | 366 | 100.0% | 60/60 |
| TOON | 365 | 100.0% | 60/60 |
| ESF | 338 | 100.0% | 60/60 |

Run with `ESF_MODELS=... ESF_REPEATS=3 node bench/esf/comprehension.mjs`. Requires an API key.
