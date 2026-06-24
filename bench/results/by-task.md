# Per-use-case results

model: `claude-opus-4-8` · sources: full-opus48

Output Δ and judge Δ are vs **baseline** for that task. "Tests" = unit test (code) or structural/a11y checklist (web).

### chunk  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 99 (95–100) | — | 196 | — |
| caveman | 100% | 99 (95–100) | +1 | 111 | -43% |
| ponytail | 100% | 97 (95–100) | -2 | 390 | +99% |
| honey | 100% | 99 (95–100) | +0 | 143 | -27% |

### config-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100% | — | 293 | — |
| caveman | 100% | 100% | +0 | 190 | -35% |
| ponytail | 100% | 100% | +0 | 199 | -32% |
| honey | 100% | 100% | +0 | 170 | -42% |

### csv-column-sum  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 96 (85–100) | — | 257 | — |
| caveman | 100% | 95 (78–100) | -1 | 146 | -43% |
| ponytail | 100% | 95 (88–97) | -1 | 424 | +65% |
| honey | 100% | 95 (92–100) | -1 | 143 | -44% |

### deep-merge  `code` · data

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 95 (88–97) | — | 802 | — |
| caveman | 100% | 94 (82–97) | -1 | 427 | -47% |
| ponytail | 100% | 94 (90–100) | -1 | 817 | +2% |
| honey | 100% | 90 (75–95) | -5 | 262 | -67% |

### findings-relay  `relay` · agent-handoff

| Variant | Tests | Accuracy | Acc Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 67% | 97% | — | 788 | — |
| caveman | 33% | 93% | -3 | 642 | -19% |
| ponytail | 0% | 90% | -7 | 642 | -19% |
| honey | 100% | 100% | +3 | 358 | -55% |

### flatten  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (97–100) | — | 75 | — |
| caveman | 100% | 96 (50–100) | -4 | 100 | +33% |
| ponytail | 100% | 100 (90–100) | +0 | 242 | +223% |
| honey | 100% | 97 (85–100) | -3 | 128 | +70% |

### format-bytes  `code` · formatting

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 97 (85–100) | — | 133 | — |
| caveman | 100% | 96 (75–100) | -1 | 157 | +17% |
| ponytail | 100% | 91 (68–100) | -6 | 452 | +239% |
| honey | 100% | 95 (85–100) | -2 | 192 | +44% |

### interval-merge  `code` · algorithm

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (95–100) | — | 196 | — |
| caveman | 100% | 96 (95–100) | -4 | 201 | +3% |
| ponytail | 100% | 98 (95–100) | -2 | 470 | +140% |
| honey | 100% | 97 (85–100) | -2 | 166 | -15% |

### lru-cache  `code` · data-structure

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 74 (30–100) | — | 1,023 | — |
| caveman | 100% | 97 (78–100) | +23 | 303 | -70% |
| ponytail | 100% | 95 (90–100) | +20 | 569 | -44% |
| honey | 100% | 97 (75–100) | +22 | 272 | -73% |

### median-bugfix  `code` · bugfix

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (92–100) | — | 279 | — |
| caveman | 100% | 98 (92–100) | +0 | 158 | -43% |
| ponytail | 100% | 86 (62–100) | -12 | 269 | -4% |
| honey | 100% | 72 (20–100) | -26 | 145 | -48% |

### memoize  `code` · performance

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 97 (95–100) | — | 391 | — |
| caveman | 100% | 96 (90–98) | -1 | 169 | -57% |
| ponytail | 100% | 96 (92–97) | -1 | 414 | +6% |
| honey | 100% | 97 (95–100) | +0 | 174 | -56% |

### parse-pagination  `code` · validation

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 94 (90–100) | — | 534 | — |
| caveman | 100% | 91 (72–95) | -3 | 591 | +11% |
| ponytail | 100% | 93 (72–100) | -1 | 656 | +23% |
| honey | 100% | 92 (85–95) | -2 | 231 | -57% |

### parse-query  `code` · parsing

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 98 (95–100) | — | 466 | — |
| caveman | 100% | 99 (95–100) | +1 | 390 | -16% |
| ponytail | 100% | 97 (88–100) | +0 | 472 | +1% |
| honey | 100% | 96 (92–98) | -1 | 292 | -37% |

### retry-backoff  `code` · async

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (95–100) | — | 369 | — |
| caveman | 100% | 99 (95–100) | +0 | 238 | -35% |
| ponytail | 100% | 98 (94–100) | -1 | 645 | +75% |
| honey | 100% | 99 (95–100) | -1 | 200 | -46% |

### round-half-up  `code` · bugfix

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 95 (88–100) | — | 434 | — |
| caveman | 100% | 95 (90–96) | +0 | 261 | -40% |
| ponytail | 100% | 96 (95–98) | +1 | 498 | +15% |
| honey | 100% | 94 (88–96) | -1 | 244 | -44% |

### slugify  `code` · string

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 100 (95–100) | — | 176 | — |
| caveman | 100% | 99 (95–100) | -1 | 97 | -45% |
| ponytail | 100% | 97 (88–100) | -3 | 310 | +76% |
| honey | 100% | 97 (95–100) | -3 | 118 | -33% |

### blog-grid  `web` · landing-page

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (89–94) | — | 3,659 | — |
| caveman | 67% | 87 (82–92) | -3 | 3,126 | -15% |
| ponytail | 67% | 83 (78–92) | -7 | 2,603 | -29% |
| honey | 100% | 92 (88–93) | +2 | 3,870 | +6% |

### dashboard  `web` · dashboard

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 91 (88–94) | — | 4,624 | — |
| caveman | 100% | 89 (88–92) | -2 | 3,401 | -26% |
| ponytail | 100% | 86 (79–92) | -4 | 2,838 | -39% |
| honey | 100% | 90 (82–94) | -1 | 3,252 | -30% |

### feature-section  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 67% | 91 (90–94) | — | 3,023 | — |
| caveman | 67% | 92 (90–94) | +0 | 2,895 | -4% |
| ponytail | 0% | 89 (88–94) | -2 | 2,876 | -5% |
| honey | 100% | 93 (92–96) | +2 | 3,564 | +18% |

### landing-page  `web` · landing-page

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (88–92) | — | 4,026 | — |
| caveman | 100% | 89 (88–94) | -1 | 3,756 | -7% |
| ponytail | 100% | 84 (72–92) | -6 | 2,605 | -35% |
| honey | 100% | 92 (90–95) | +2 | 4,801 | +19% |

### pricing-section  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 92 (89–94) | — | 4,112 | — |
| caveman | 100% | 91 (88–94) | -1 | 2,372 | -42% |
| ponytail | 100% | 86 (78–94) | -5 | 1,732 | -58% |
| honey | 100% | 91 (78–95) | +0 | 3,072 | -25% |

### settings-panel  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 90 (88–96) | — | 3,063 | — |
| caveman | 100% | 89 (88–95) | -1 | 2,756 | -10% |
| ponytail | 100% | 86 (82–94) | -4 | 2,352 | -23% |
| honey | 100% | 91 (88–95) | +1 | 2,675 | -13% |

### signup-form  `web` · ui-component

| Variant | Tests | Judge (panel range) | Judge Δ | Output tok | Output Δ |
|---------|------:|------:|--------:|-----------:|---------:|
| baseline | 100% | 91 (88–94) | — | 1,343 | — |
| caveman | 100% | 90 (82–95) | -1 | 1,239 | -8% |
| ponytail | 100% | 86 (78–92) | -5 | 1,074 | -20% |
| honey | 100% | 92 (88–95) | +1 | 1,231 | -8% |
