# Carbon badge and usage report

## Carbon badge (Claude Code)

When Honey is active, the statusline also shows a live **CO₂ estimate** for the
session and the **CO₂/$ saved** vs a no-Honey baseline:

```
🍯 honey:full · 🌿 44g CO₂ (saved ~26g · $0.18)
```

(Illustrative — a ~2k-output-token Opus session.) The estimate is a faithful port
of [EcoLogits](https://github.com/genai-impact/ecologits) v0.8.2 (verified to match
the package exactly). **Model params come from EcoLogits' own registry**
([`hooks/eco-models.json`](../hooks/eco-models.json), exported by
[`scripts/build-eco-models.py`](../scripts/build-eco-models.py)) — matched by exact id,
falling back to a per-family alias for frontier models too new for the registry.
**Grid switches per provider** — Anthropic on AWS Trainium (~500 gCO₂/kWh), OpenAI
on Azure (~400), Google on GCP (~330). Aliases, grids, and per-mode savings live in
[`hooks/eco-config.json`](../hooks/eco-config.json).

The badge itself renders **only in Claude Code** (it reads Claude Code's
transcript, where every model is a Claude model). The provider switching matters
for [`scripts/eco_report.py`](../scripts/eco_report.py), which runs against any
transcript — Codex/Gemini CLIs would each need their own statusline hook to show
a live badge there.

> Params are **speculative** — Anthropic discloses none. EcoLogits' raw coefficient
> is a **single-stream (batch-size-1) upper bound** — it gives one request the whole
> GPU set for the full generation (for Opus, ~1.9 tok/s, ~30× slower than reality),
> which alone is ~1.4 kg per 1M output tokens. Production serves many requests
> concurrently, so the badge divides that ceiling by an effective batch concurrency
> (`serving_concurrency`, default 32 — calibrated so modeled throughput matches real
> ~50–70 tok/s serving) to show realistic **served** impact. `eco_report.py` prints
> both the served figure and the single-stream ceiling. Treat these as a range, not
> a meter reading.

For the full breakdown (usage + embodied + primary energy) run the real package:

```bash
pip install ecologits
python scripts/eco_report.py        # newest session, or --transcript PATH
```

## honey-usage — actual token usage across your coding agents

`honey-usage` ([`bin/usage.js`](../bin/usage.js), inspired by
[tokscale](https://github.com/junhoyeo/tokscale)) reads the session data your
coding agents already write to disk and reports **actual token usage** —
tokens, approximate USD, and served CO₂ — per app and model. Zero dependencies,
no network, nothing leaves your machine.

| App | Source |
|---|---|
| `claude` (Claude Code) | `$CLAUDE_CONFIG_DIR` or `~/.claude` — `projects/**/*.jsonl` |
| `codex` (Codex CLI) | `$CODEX_HOME` or `~/.codex` — `sessions/**/*.jsonl` |
| `opencode` (OpenCode) | `($XDG_DATA_HOME` or `~/.local/share)/opencode/opencode.db` (system `sqlite3`) |

Apps without data are skipped; adding another is a small scanner returning
`{app, model, ts, input, output, cacheRead, cacheWrite, cost}` records.

```bash
honey-usage                                  # table by app + model, totals row
honey-usage --json                           # same aggregation as JSON
honey-usage --daily --since 2026-08-01       # per-day breakdown, date-filtered
honey-usage --client codex,opencode --today  # scope by app and local day
```

```
APP     MODEL        INPUT      OUTPUT   CACHE-R      CACHE-W     USD     CO2
claude  claude-opus-5  85,540  4,296,591  1,814,741,458  44,864,917  $1295.62  94.45kg
...
```

Details that keep the numbers honest:

- **Dedup** — Claude Code repeats assistant records across retries and
  continuations; each `(message.id, requestId)` counts once, globally.
- **Cache-aware cost** — rates from [`bench/pricing.json`](../bench/pricing.json)
  (cache writes/reads billed as multipliers on the input rate; unknown models
  fall back to `_default`, so treat $ as approximate). Codex's
  `cached_input_tokens` are split out of `input_tokens` and priced as cache
  reads; OpenCode rows use the app's own recorded cost.
- **CO₂** — the same served EcoLogits estimate as the badge
  ([`hooks/eco.js`](../hooks/eco.js)), from output tokens; the badge's caveats
  apply.
- **Savings are ledger-gated** — the default report has no "saved" column: it
  shows what was actually spent, and app logs don't record whether Honey was
  active. `honey-usage --savings` claims savings **only** for sessions the
  SessionStart hook logged to `$CLAUDE_CONFIG_DIR/.honey-usage-ledger.jsonl`
  (Claude Code, since Honey was installed — history before that is never
  claimed), and only for models with a committed bench stamp
  ([`hooks/eco-config.json`](../hooks/eco-config.json) `savings_provenance`).
  Everything else is footnoted, not estimated. The figures stay modeled
  counterfactuals (`est. modeled from bench/results/… — not measured`), same
  basis as the badge.
