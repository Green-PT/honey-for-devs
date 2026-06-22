# 🍯 Honey (I Shrunk the AI)

<p align="center">
  <img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHRsNndobm8wM3F1c3pqNnhxODF6NDY2a2t3YjN5OHFoYmtvZXg0dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JUh0yTz4h931K/giphy.gif" alt="Honey, I shrunk the AI" width="480">
</p>

**Write less code and say less about it.** Honey (I Shrunk the AI) by
[GreenPT](https://github.com/Green-PT) is a
cross-tool coding skill that cuts AI coding-agent token usage and LLM API costs —
making agents emit less code *and* less prose without losing correctness. It works
with **Claude Code, Cursor, GitHub Copilot, Codex, Gemini CLI, Windsurf, Cline,
and Kiro**. Three independent levers, applied reflexively:

1. **Less code** — YAGNI first. Walk a ladder (does it need to exist? → stdlib →
   language native → existing dependency → one line → minimum block) and stop at
   the first rung that works. The cheapest line is the one you never write.
2. **Less prose** — drop the wind-up, the hedging, the narration of code that
   already speaks for itself. Answer first.
3. **Denser agent-to-agent handoffs** — when the reader is another agent, not a
   human, hand it the most token-efficient format it parses losslessly (compact /
   columnar JSON, or [ESO](eso/SPEC.md)). Cuts handoff size ~in half at zero loss
   of recovery. Fires only here — never as a user-facing answer.

Honey combines what [Ponytail](https://github.com/DietrichGebert/ponytail)
(minimal code) and [Caveman](https://github.com/JuliusBrussee/caveman) (terse
prose) do separately, then goes further:

- **Auto-intensity** — `lite` / `full` / `ultra` chosen reflexively from the
  request, with no deliberation tax (it never spends reasoning tokens deciding
  *how* to comply — that would defeat the purpose on reasoning models).
- **Safety carve-outs** — input validation, error handling, auth, secrets,
  migrations, deletes, and anything you explicitly asked for are **never**
  compressed. Lazy ≠ broken.
- **A skill family, not one prompt** — an always-on core plus on-demand satellites
  (review, eco, gain, compress) and a *hive* of read-only subagents that return
  compressed handoffs. See [Skills & subagents](#skills--subagents).

## Why

Volume is cost. In agentic coding sessions, the volume of generated code and
prose is what runs up the bill — and most of it is waste.

This repo ships a **reproducible benchmark** ([`bench/`](bench/)) so you don't have
to take the numbers on faith: 17 tasks across three kinds of work — baseline vs
[Caveman](https://github.com/JuliusBrussee/caveman) vs
[Ponytail](https://github.com/DietrichGebert/ponytail) vs Honey — same model, same
prompts, only the skill changes. Correctness is objective (unit tests, structural /
accessibility checks, and lossless round-trip recovery for agent handoffs); quality
is scored by a **3-model judge panel** (median of Opus 4.8 + Sonnet 4.6 + Haiku 4.5).
The figures below are the committed results (Claude Opus 4.8, 3 runs each) — run
`cd bench && npm run bench` to reproduce.

A single blended number hides the story, because the levers fire differently per
task type. Quality is **% of baseline** (panel median; for handoffs, lossless
recovery); tokens are **generated output vs baseline**:

| Task tier | Caveman | Ponytail | **Honey** |
|-----------|:-------:|:--------:|:---------:|
| **Code** (12 unit-tested tasks) | 100% · −30% | 98% · **+38%** | **99% · −40%** |
| **User-facing** (3 landing/UI tasks) | 99% · −15% | 95% · −31% | **100% · −4%** |
| **Agent-to-agent** (2 handoff tasks) | 100% · −22% | 100% · −21% | **100% · −49%** |

Honey **leads quality where it matters most** — it tops the user-facing and
agent-to-agent tiers (the quality-separating ones) and stays within judge noise
of the pack on saturated code tasks — while cutting tokens where it's safe to:

- **Code** — the deepest cut (−40% output) at essentially tied quality (99% vs
  100%, within judge noise on tasks every variant passes). Caveman saves less;
  Ponytail's mandatory self-check *inflates* trivial code (+38%).
- **User-facing** — the carve-out keeps Honey from compressing polish, yet it
  still trims output (−4%) while earning the top quality score (100% of baseline);
  Ponytail strips hardest and loses the most quality.
- **Agent-to-agent** — Honey's ESO/compact-JSON lever roughly halves handoff size
  (−49%) with zero loss of recovery: its biggest, cleanest win.

The same pattern holds on GPT-5.5 (full two-provider table in
[`bench/results/cross-provider.md`](bench/results/cross-provider.md)): Honey is the
only variant that keeps 100% tests and top-tier quality on both models while cutting
tokens on every tier.

## Efficient Structured Output

Honey includes [ESO](eso/SPEC.md), a zero-dependency, schema-first format for
agent handoffs. Repeated record keys are emitted once; declared row counts catch
truncated messages; JSON-compatible cells preserve types.

The reproducible [ESO/TOON/JSON benchmark](bench/eso/RESULTS.md) measures bytes,
two tokenizer estimates, codec speed, and lossless recovery across five agent
handoff shapes. Run it with `npm run bench:eso`.

```bash
printf '%s' '{"from":"reviewer","findings":[{"sev":"H","issue":"expired token"}]}' | eso encode
eso decode < handoff.eso
```

### CCR — for huge, redundant array tool output

ESO is lossless, for handoffs where every row matters. **CCR** (Compress-Cache-Retrieve)
is the lossy-but-recoverable lever for the opposite case: a long uniform array you must
read but mostly skim — logs, scan results, event streams. It keeps an informative sample
(endpoints, anomalies/change-points, head/tail), caches the dropped rows locally, and
leaves a `<<ccr:HASH N_rows_offloaded>>` sentinel. Nothing is lost — `retrieve` restores
the original by hash on demand.

```bash
some-tool | eso crush          # → sampled view + sentinel; originals cached in .honey-ccr/
eso retrieve <hash>            # → the full original array, verbatim
```

Validated on a 90-row log (opus-4.8 + gpt-5.5): **−82% tokens**, crushed-only **96%**
answer accuracy, **100%** with retrieve — and the lone crushed miss was a refusal, not a
hallucination. Benches: `npm run bench:ccr` (tokens) and `npm run bench:ccr:comprehension`
(quality). The `honey-ccr` skill tells the agent when to reach for it.

Pick Honey when you want the best quality-per-token, especially in Claude Code.

## Skills & subagents

Honey is one always-on core plus a family of on-demand tools. The core is a
*writing style* (it must be the default to pay off); the rest are *actions* you
reach for at a specific moment.

| Name | Kind | What it does |
|------|------|--------------|
| `honey` | core skill (always-on) | the three levers, applied reflexively to every response. `/honey [lite\|full\|ultra\|off]` |
| `honey-design` | satellite skill | for user-facing UI (landing pages, components): keeps the full rendered polish, cuts tokens by writing the design densely (CSS vars, shared classes, `clamp()`) — same pixels, fewer tokens |
| `honey-review` | satellite skill | review a diff for over-engineering + over-verbosity; terse delete-list |
| `honey-eco` | satellite skill | this session's CO₂ / $ / tokens saved, from the committed EcoLogits port |
| `honey-gain` | satellite skill | the committed benchmark scoreboard (reads `bench/results/` at runtime) |
| `honey-compress` | satellite skill | rewrite a re-read memory file (CLAUDE.md, AGENTS.md) tersely to cut *input* tokens; backs up the original |
| `honey-memory` | satellite skill | create + maintain one committed per-project `PROJECT.md` so agents stop re-discovering the same facts every cold session; stores only stable, not-in-the-code context, kept honest by living in git |
| `honey-ccr` | satellite skill | crush huge redundant array tool output (logs, scan results) to a sampled view; lossy-but-recoverable via `eso crush`/`retrieve` |
| `honey-hive` | guide skill | decide when to delegate to the hive vs. work inline |
| `hive-scout` | subagent (haiku, read-only) | locate symbols / callers / configs; returns a compact id-keyed JSON map |
| `hive-reviewer` | subagent (haiku, read-only) | review a diff/files; returns columnar id-keyed JSON findings |
| `hive-builder` | subagent (sonnet, ≤2 files) | make a surgical edit under the ladder; returns a compact change-manifest |

The **hive** is Lever 3 with a runtime: each subagent returns a compressed handoff,
so the result injected back into the orchestrator's context is **−44–53%** smaller
with zero loss (`npm run bench:hive`). Live, the skills hold up too — honey −86%,
honey-review −70%, hive-reviewer −43% output tokens at passing correctness
(`npm run bench:skills`). See [`bench/hive/RESULTS.md`](bench/hive/RESULTS.md) and
[`bench/skills/RESULTS.md`](bench/skills/RESULTS.md).

On **user-facing** work — where the core skill *spends* tokens because polish is the
spec — `honey-design` keeps the same rendered polish for **−19% output tokens** vs no
skill (judge 92 vs 90), beating the core skill on both axes across 7 landing-page/UI
tasks. See [`bench/results/honey-design.md`](bench/results/honey-design.md).

> **Honesty note.** Earlier versions of this README quoted `92% / 78% / 73%` quality
> and `−57% / −65% / −70%` tokens from an unpublished run. Those don't reproduce —
> the real quality spread is far narrower and the token savings are tier-dependent
> (and Ponytail *adds* tokens on simple code). The table above is what the committed
> [`bench/`](bench/) harness actually produces; see
> [`bench/results/combined.md`](bench/results/combined.md) for the full breakdown.

## Install

### Claude Code (plugin marketplace)

```
/plugin marketplace add Green-PT/honey-for-devs
/plugin install honey@greenpt
```

Then `/honey` to turn it on (`/honey lite|full|ultra` to set intensity,
`/honey off` to stop). A 🍯 badge shows the active mode in your statusline.

### One-line installer (interactive wizard)

In a terminal it asks which agents you use, whether to wire the CO₂ badge, drop
per-repo rule files, and your default mode — then sets up exactly that. The wizard
prompts on `/dev/tty`, so it works through `curl | bash`. CI/pipes and `--yes`
fall back to auto-detect.

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
```

Windows (`irm | iex`) runs non-interactive; clone and run `node bin/install.js`
for the wizard. Add `bash -s -- --yes` to skip prompts. Requires Node.js on your
PATH. Safe to re-run; skips tools you don't have.

### Every supported platform

| Platform | Install |
|----------|---------|
| Claude Code | `/plugin marketplace add Green-PT/honey-for-devs` then `/plugin install honey@greenpt` |
| Codex | `codex plugin marketplace add Green-PT/honey-for-devs` then enable via `/plugins` |
| GitHub Copilot CLI | `copilot plugin marketplace add Green-PT/honey-for-devs` then `copilot plugin install honey@greenpt` |
| Gemini CLI | `gemini extensions install https://github.com/Green-PT/honey-for-devs` |
| Cursor | copy `.cursor/rules/honey.mdc` into your project |
| Windsurf | copy `.windsurf/rules/honey.md` into your project |
| Cline | copy `.clinerules/honey.md` into your project |
| GitHub Copilot (editor) | copy `.github/copilot-instructions.md` into your project |
| Kiro | copy `.kiro/steering/honey.md` (project or `~/.kiro/steering/`) |
| OpenCode | copy `.opencode/AGENTS.md` into your project |
| Aider / Zed / any AGENTS.md reader | copy `AGENTS.md` into your project |

All of these are also handled automatically by the one-line installer. See
[INSTALL.md](INSTALL.md) for manual steps, flags, and uninstall.

## Carbon badge (Claude Code)

When Honey is active, the statusline also shows a live **CO₂ estimate** for the
session and the **CO₂/$ saved** vs a no-Honey baseline:

```
🍯 honey:full · 🌿 44g CO₂ (saved ~26g · $0.18)
```

(Illustrative — a ~2k-output-token Opus session.) The estimate is a faithful port
of [EcoLogits](https://github.com/genai-impact/ecologits) v0.8.2 (verified to match
the package exactly). **Model params come from EcoLogits' own registry**
([`hooks/eco-models.json`](hooks/eco-models.json), exported by
[`scripts/build-eco-models.py`](scripts/build-eco-models.py)) — matched by exact id,
falling back to a per-family alias for frontier models too new for the registry.
**Grid switches per provider** — Anthropic on AWS Trainium (~500 gCO₂/kWh), OpenAI
on Azure (~400), Google on GCP (~330). Aliases, grids, and per-mode savings live in
[`hooks/eco-config.json`](hooks/eco-config.json).

The badge itself renders **only in Claude Code** (it reads Claude Code's
transcript, where every model is a Claude model). The provider switching matters
for [`scripts/eco_report.py`](scripts/eco_report.py), which runs against any
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

## How it stays in sync

The skill is authored **once** in [`skills/honey/SKILL.md`](skills/honey/SKILL.md).
Every per-platform rule file (and `AGENTS.md`) is generated from it:

```bash
node scripts/build-rules.js          # regenerate all rule files
node scripts/build-rules.js --check  # CI: fail if any copy drifted
```

## License

MIT — see [LICENSE](LICENSE).

The carbon-estimation data and coefficients in `hooks/eco-models.json` and
`hooks/eco.js` are derived from [EcoLogits](https://github.com/genai-impact/ecologits)
and remain under the **MPL-2.0**. See [NOTICE](NOTICE) for details.
