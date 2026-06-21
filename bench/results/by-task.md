# Per-use-case results

model: `claude-opus-4-8` · sources: panel-v1, relay-v1

Output Δ and judge Δ are vs **baseline** for that task. "Tests" = unit test (code) or structural/a11y checklist (web).

### chunk  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (95–100) | — | 140 | — |
| caveman | 100% | 100 (99–100) | +1 | 112 | -20% |
| ponytail | 100% | 99 (95–100) | +0 | 331 | +136% |
| honey | 100% | 98 (95–100) | -1 | 155 | +11% |

### config-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100% | — | 289 | — |
| caveman | 100% | 100% | +0 | 190 | -34% |
| ponytail | 100% | 100% | +0 | 210 | -27% |
| honey | 100% | 100% | +0 | 194 | -33% |

### csv-column-sum  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (90–100) | — | 154 | — |
| caveman | 100% | 96 (82–100) | -2 | 157 | +2% |
| ponytail | 100% | 95 (92–100) | -2 | 334 | +116% |
| honey | 100% | 99 (95–100) | +1 | 149 | -4% |

### deep-merge  `code` · data

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 97 (92–100) | — | 604 | — |
| caveman | 100% | 95 (92–97) | -1 | 412 | -32% |
| ponytail | 100% | 94 (88–100) | -3 | 783 | +30% |
| honey | 100% | 95 (92–97) | -1 | 256 | -58% |

### findings-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100% | — | 843 | — |
| caveman | 100% | 100% | +0 | 642 | -24% |
| ponytail | 100% | 100% | +0 | 642 | -24% |
| honey | 100% | 100% | +0 | 327 | -61% |

### flatten  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (99–100) | — | 75 | — |
| caveman | 100% | 100 (97–100) | +0 | 100 | +33% |
| ponytail | 100% | 99 (97–100) | -1 | 284 | +278% |
| honey | 100% | 99 (95–100) | -1 | 125 | +66% |

### format-bytes  `code` · formatting

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 97 (85–100) | — | 133 | — |
| caveman | 100% | 96 (85–100) | -1 | 157 | +18% |
| ponytail | 100% | 94 (88–100) | -3 | 412 | +209% |
| honey | 100% | 95 (82–100) | -2 | 186 | +40% |

### lru-cache  `code` · data-structure

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 96 (78–100) | — | 484 | — |
| caveman | 100% | 97 (78–100) | +1 | 299 | -38% |
| ponytail | 100% | 96 (92–100) | -1 | 552 | +14% |
| honey | 100% | 97 (92–100) | +1 | 267 | -45% |

### median-bugfix  `code` · bugfix

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (95–100) | — | 307 | — |
| caveman | 100% | 99 (95–100) | +0 | 141 | -54% |
| ponytail | 100% | 95 (42–100) | -4 | 249 | -19% |
| honey | 100% | 97 (52–100) | -2 | 136 | -56% |

### memoize  `code` · performance

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 96 (95–100) | — | 354 | — |
| caveman | 100% | 97 (95–100) | +1 | 152 | -57% |
| ponytail | 100% | 96 (82–100) | -1 | 422 | +19% |
| honey | 100% | 97 (82–100) | +1 | 199 | -44% |

### parse-pagination  `code` · validation

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 96 (90–100) | — | 567 | — |
| caveman | 100% | 87 (72–100) | -9 | 485 | -14% |
| ponytail | 100% | 98 (95–100) | +2 | 513 | -10% |
| honey | 100% | 96 (92–97) | +0 | 237 | -58% |

### parse-query  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (92–100) | — | 464 | — |
| caveman | 100% | 99 (97–100) | +0 | 397 | -14% |
| ponytail | 100% | 99 (95–100) | +0 | 541 | +17% |
| honey | 100% | 99 (97–100) | -1 | 294 | -37% |

### retry-backoff  `code` · async

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (99–100) | — | 235 | — |
| caveman | 100% | 100 (98–100) | +0 | 234 | -1% |
| ponytail | 100% | 99 (97–100) | -1 | 590 | +151% |
| honey | 100% | 100 (99–100) | +0 | 219 | -7% |

### slugify  `code` · string

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (99–100) | — | 172 | — |
| caveman | 100% | 100 (97–100) | +0 | 92 | -47% |
| ponytail | 100% | 99 (95–100) | -1 | 246 | +43% |
| honey | 100% | 100 (97–100) | +0 | 86 | -50% |

### landing-page  `web` · landing-page

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (88–92) | — | 3,989 | — |
| caveman | 100% | 89 (87–92) | -2 | 3,570 | -11% |
| ponytail | 100% | 81 (78–92) | -9 | 2,448 | -39% |
| honey | 100% | 92 (89–94) | +2 | 4,889 | +23% |

### pricing-section  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (88–96) | — | 3,259 | — |
| caveman | 100% | 89 (88–94) | -1 | 2,714 | -17% |
| ponytail | 100% | 85 (78–92) | -6 | 1,578 | -52% |
| honey | 100% | 92 (90–96) | +2 | 3,335 | +2% |

### signup-form  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 89 (88–94) | — | 1,332 | — |
| caveman | 100% | 88 (82–94) | -1 | 1,137 | -15% |
| ponytail | 100% | 85 (78–94) | -4 | 1,067 | -20% |
| honey | 100% | 89 (82–96) | +0 | 1,255 | -6% |
