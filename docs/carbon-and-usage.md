# Carbon badge and usage report

## Carbon and water badge (Claude Code)

When Honey is active, the statusline also shows a live **CO₂e and water estimate**
for the session and the **CO₂ saved** vs a no-Honey baseline:

```
🍯 honey:full · 🌿 17.6g CO₂ · 💧 78mL (est. saved ~0.46g)
```

(Illustrative — an Opus session with 2k output tokens and 500k cache-read tokens.)

**Method.** The token-based method of Llopis-Garcia (2026), *Accounting for purchased
artificial intelligence inference in corporate greenhouse gas inventories: A token-based
method*, Sustainable Production and Consumption 70, 320–347,
[doi:10.1016/j.spc.2026.11.003](https://doi.org/10.1016/j.spc.2026.11.003) (preprint
[arXiv 2606.10660](https://arxiv.org/abs/2606.10660)), with the factors of its
[SAEF dataset v3.2.0](https://doi.org/10.5281/zenodo.24460344) (CC BY 4.0):

```
effective tokens = (output + 0.30 × (uncached input + cache writes) + 0.05 × cache reads) / 1.339
kg CO₂e          = effective/1e6 × inference footprint + billed/1e6 × training term
water (mL)       = effective/1e3 × (on-site WUE + off-site EWIF) per 1k effective tokens
```

- **Every token counts**, weighted by the compute it costs: output in full, fresh input
  at 0.30, cached input at 0.05. In a cache-heavy agentic session, cache reads are most
  of the footprint and output is a few percent.
- **Cradle-to-gate scope:** serving electricity (measured accelerator energy from the
  ML.ENERGY Leaderboard, plus host, idle and PUE uplifts), embodied hardware,
  data-centre construction, and the amortised final training run.
- **Size class, not model:** a model id maps by tier word to class A (small: haiku,
  mini, nano, flash, luna, terra), B (standard: sonnet, gpt-4o, gpt-4.1) or C
  (frontier: opus, fable, mythos, gpt-5/6, astra, sol — and any unmapped id). Each
  class value is the mean of its measured open-weight members; closed models are
  assumed to match their class.
- **Global-average grid and water** (0.4832 kg CO₂e/kWh; WUE 0.55 L/kWh, EWIF
  3.142 L/kWh): providers don't disclose where a request is served, and that is the
  paper's rule for unknown routing.
- **Saved** runs only the saved output tokens through the same method — Honey cuts
  output, not the input and cache that dominate the footprint — so it is a small share.

> The paper calls its energy term **best-case** (lowest measured energy at ≤50 ms
> inter-token latency): its serving-regime range is 2.0–2.8× the central factor, and
> `eco-session.js` also prints the conservative high case. Treat the figures as an
> estimate, not a meter reading.

The badge renders **only in Claude Code** (it reads Claude Code's transcript).
`honey-usage` below applies the same estimator to Codex and OpenCode sessions.
For the full basis of the current session:

```bash
node scripts/eco-session.js        # newest session, or --transcript PATH
```

## honey-usage — actual token usage across your coding agents

`honey-usage` ([`bin/usage.js`](../bin/usage.js), inspired by
[tokscale](https://github.com/junhoyeo/tokscale)) reads the session data your
coding agents already write to disk and reports **actual token usage** —
tokens, approximate USD, CO₂e and water — per app and model. Zero dependencies,
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
APP     MODEL          INPUT     OUTPUT        CACHE-R     CACHE-W       USD      CO2   WATER
claude  claude-opus-5  85,540  4,296,591  1,814,741,458  44,864,917  $1295.62  59.80kg  256.1L
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
- **CO₂e and water** — the same token-based estimate as the badge
  ([`hooks/eco.js`](../hooks/eco.js)), from input, cache and output tokens; the
  badge's caveats apply.
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
