# 🍯 Honey (I Shrunk the AI)

**Write less code and say less about it.** Honey is a coding skill that makes AI
agents emit less — less code *and* less prose — without losing correctness. Two
independent levers, applied reflexively:

1. **Less code** — YAGNI first. Walk a ladder (does it need to exist? → stdlib →
   language native → existing dependency → one line → minimum block) and stop at
   the first rung that works. The cheapest line is the one you never write.
2. **Less prose** — drop the wind-up, the hedging, the narration of code that
   already speaks for itself. Answer first.

Honey combines what [Ponytail](https://github.com/DietrichGebert/ponytail)
(minimal code) and [Caveman](https://github.com/JuliusBrussee/caveman) (terse
prose) do separately, and adds two things that matter:

- **Auto-intensity** — `lite` / `full` / `ultra` chosen reflexively from the
  request, with no deliberation tax (it never spends reasoning tokens deciding
  *how* to comply — that would defeat the purpose on reasoning models).
- **Safety carve-outs** — input validation, error handling, auth, secrets,
  migrations, deletes, and anything you explicitly asked for are **never**
  compressed. Lazy ≠ broken.

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
| **Code** (12 unit-tested tasks) | 99% · −26% | 99% · **+42%** | **100% · −37%** |
| **User-facing** (3 landing/UI tasks) | 99% · −14% | 93% · −41% | **101% · +10%** |
| **Agent-to-agent** (2 handoff tasks) | 100% · −27% | 100% · −25% | **100% · −54%** |

Honey is the **quality leader in every tier** — it ties or beats the no-skill
baseline and is never the lowest-quality skill — while cutting tokens where it's
safe to:

- **Code** — best on both axes: top quality *and* the deepest cut (−37% output,
  −21% $). Caveman saves less; Ponytail's mandatory self-check *inflates* trivial code.
- **User-facing** — the carve-out keeps Honey from compressing polish, so it spends
  *more* (+10%) and earns the top quality score; Ponytail strips hardest and loses
  the most quality.
- **Agent-to-agent** — Honey's ESF/compact-JSON lever cuts handoff size in half
  with zero loss of recovery: its biggest, cleanest win.

## Efficient Structured Format

Honey includes [ESF](esf/SPEC.md), a zero-dependency, schema-first format for
agent handoffs. Repeated record keys are emitted once; declared row counts catch
truncated messages; JSON-compatible cells preserve types.

The reproducible [ESF/TOON/JSON benchmark](bench/esf/RESULTS.md) measures bytes,
two tokenizer estimates, codec speed, and lossless recovery across five agent
handoff shapes. Run it with `npm run bench:esf`.

```bash
printf '%s' '{"from":"reviewer","findings":[{"sev":"H","issue":"expired token"}]}' | esf encode
esf decode < handoff.esf
```

Pick Honey when you want the best quality-per-token, especially in Claude Code.

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

### One-line installer (auto-detects every agent you have)

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
```

Add `bash -s -- --with-init` to also drop editor rule files into the current
repo. Requires Node.js on your PATH. Safe to re-run; skips tools you don't have.

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
🍯 honey:full · 🌿 8.3g CO₂ (saved ~4.9g · $0.02)
```

The estimate is a faithful port of [EcoLogits](https://github.com/genai-impact/ecologits)
v0.8.2 (verified to match the package exactly). **Model params come from
EcoLogits' own registry** ([`hooks/eco-models.json`](hooks/eco-models.json),
exported by [`scripts/build-eco-models.py`](scripts/build-eco-models.py)) — matched
by exact id, falling back to a per-family alias for frontier models too new for
the registry. **Grid switches per provider** — Anthropic on AWS Trainium (~500
gCO₂/kWh), OpenAI on Azure (~400), Google on GCP (~330). Aliases, grids, and
per-mode savings live in [`hooks/eco-config.json`](hooks/eco-config.json).

The badge itself renders **only in Claude Code** (it reads Claude Code's
transcript, where every model is a Claude model). The provider switching matters
for [`scripts/eco_report.py`](scripts/eco_report.py), which runs against any
transcript — Codex/Gemini CLIs would each need their own statusline hook to show
a live badge there.

> Params are **speculative** — Anthropic discloses none. EcoLogits' coefficient is
> a single-stream upper bound; heavily-batched production serving is lower. Treat
> these as a range, not a meter reading.

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
