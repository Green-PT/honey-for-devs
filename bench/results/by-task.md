# Per-use-case results

model: `claude-opus-4-8` · sources: full-v2

Output Δ and judge Δ are vs **baseline** for that task. "Tests" = unit test (code) or structural/a11y checklist (web).

### chunk  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (95–100) | — | 140 | — |
| caveman | 100% | 100 (99–100) | +1 | 109 | -22% |
| ponytail | 100% | 99 (95–100) | +0 | 321 | +130% |
| honey | 100% | 98 (95–100) | -1 | 145 | +4% |

### config-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100% | — | 292 | — |
| caveman | 100% | 100% | +0 | 187 | -36% |
| ponytail | 100% | 100% | +0 | 198 | -32% |
| honey | 100% | 100% | +0 | 167 | -43% |

### csv-column-sum  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (85–100) | — | 156 | — |
| caveman | 100% | 96 (82–100) | -3 | 146 | -6% |
| ponytail | 100% | 96 (90–100) | -3 | 333 | +114% |
| honey | 100% | 99 (95–100) | +0 | 139 | -10% |

### deep-merge  `code` · data

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (96–98) | — | 686 | — |
| caveman | 100% | 95 (95–97) | -3 | 419 | -39% |
| ponytail | 100% | 95 (88–98) | -3 | 907 | +32% |
| honey | 100% | 97 (85–100) | -1 | 231 | -66% |

### findings-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100% | — | 846 | — |
| caveman | 100% | 100% | +0 | 624 | -26% |
| ponytail | 100% | 100% | +0 | 642 | -24% |
| honey | 100% | 100% | +0 | 364 | -57% |

### flatten  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (99–100) | — | 75 | — |
| caveman | 100% | 99 (45–100) | -1 | 99 | +32% |
| ponytail | 100% | 100 (97–100) | +0 | 273 | +264% |
| honey | 100% | 98 (95–100) | -2 | 127 | +70% |

### format-bytes  `code` · formatting

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (85–100) | — | 135 | — |
| caveman | 100% | 97 (85–100) | +0 | 161 | +20% |
| ponytail | 100% | 96 (42–100) | -1 | 366 | +172% |
| honey | 100% | 90 (75–100) | -7 | 203 | +51% |

### lru-cache  `code` · data-structure

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 97 (45–100) | — | 639 | — |
| caveman | 100% | 96 (75–100) | -1 | 308 | -52% |
| ponytail | 100% | 95 (82–100) | -2 | 583 | -9% |
| honey | 100% | 97 (95–100) | +0 | 271 | -58% |

### median-bugfix  `code` · bugfix

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (95–100) | — | 267 | — |
| caveman | 100% | 100 (97–100) | +2 | 146 | -45% |
| ponytail | 100% | 98 (52–100) | +0 | 229 | -14% |
| honey | 100% | 97 (88–100) | -1 | 86 | -68% |

### memoize  `code` · performance

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (95–100) | — | 124 | — |
| caveman | 100% | 98 (95–100) | -1 | 186 | +50% |
| ponytail | 100% | 97 (92–100) | -3 | 420 | +239% |
| honey | 100% | 98 (92–100) | -2 | 203 | +64% |

### parse-pagination  `code` · validation

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 96 (95–100) | — | 573 | — |
| caveman | 100% | 96 (90–100) | +0 | 420 | -27% |
| ponytail | 100% | 97 (88–100) | +0 | 493 | -14% |
| honey | 100% | 93 (88–96) | -3 | 246 | -57% |

### parse-query  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (92–100) | — | 455 | — |
| caveman | 100% | 99 (98–100) | +0 | 401 | -12% |
| ponytail | 100% | 98 (95–100) | -2 | 500 | +10% |
| honey | 100% | 99 (97–100) | -1 | 330 | -27% |

### retry-backoff  `code` · async

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (97–100) | — | 346 | — |
| caveman | 100% | 100 (99–100) | +0 | 228 | -34% |
| ponytail | 100% | 100 (98–100) | +0 | 519 | +50% |
| honey | 100% | 99 (95–100) | -1 | 203 | -41% |

### slugify  `code` · string

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (99–100) | — | 120 | — |
| caveman | 100% | 100 (97–100) | +0 | 102 | -16% |
| ponytail | 100% | 100 (97–100) | +0 | 206 | +71% |
| honey | 100% | 100 (97–100) | +0 | 96 | -20% |

### landing-page  `web` · landing-page

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 89 (88–92) | — | 4,134 | — |
| caveman | 100% | 89 (86–92) | +0 | 3,764 | -9% |
| ponytail | 100% | 84 (78–92) | -5 | 2,532 | -39% |
| honey | 100% | 92 (91–94) | +3 | 5,034 | +22% |

### pricing-section  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 91 (90–94) | — | 2,987 | — |
| caveman | 100% | 88 (88–94) | -3 | 2,167 | -27% |
| ponytail | 100% | 85 (78–92) | -6 | 1,578 | -47% |
| honey | 100% | 91 (90–96) | +0 | 3,211 | +7% |

### signup-form  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (88–94) | — | 1,346 | — |
| caveman | 100% | 86 (82–94) | -4 | 1,155 | -14% |
| ponytail | 100% | 85 (78–94) | -5 | 1,031 | -23% |
| honey | 100% | 89 (85–96) | -1 | 1,275 | -5% |
