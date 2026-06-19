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

Benchmarked across 20 real coding tasks × 3 runs on Claude Opus 4.8 (adaptive
thinking, high effort):

| Skill | Quality (vs baseline) | Billed tokens (vs baseline) |
|-------|----------------------:|----------------------------:|
| **Honey** | **92%** | **−57%** |
| Ponytail | 78% | −65% |
| Caveman | 73% | −70% |

Honey is the **quality leader** while still cutting tokens by more than half, and
it wins or ties every task category. On forced-reasoning models (e.g. OpenAI
gpt-5.5 high) the reflex design keeps it net-positive; pure-prose Caveman saves
more there. Pick Honey when you want the best quality-per-token, especially in
Claude Code.

## Install

### Claude Code (plugin marketplace)

```
/plugin marketplace add Green-PT/honey-for-devs
/plugin install honey@honey
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
| Claude Code | `/plugin marketplace add Green-PT/honey-for-devs` then `/plugin install honey@honey` |
| Codex | `codex plugin marketplace add Green-PT/honey-for-devs` then enable via `/plugins` |
| GitHub Copilot CLI | `copilot plugin marketplace add Green-PT/honey-for-devs` then `copilot plugin install honey@honey` |
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

## How it stays in sync

The skill is authored **once** in [`skills/honey/SKILL.md`](skills/honey/SKILL.md).
Every per-platform rule file (and `AGENTS.md`) is generated from it:

```bash
node scripts/build-rules.js          # regenerate all rule files
node scripts/build-rules.js --check  # CI: fail if any copy drifted
```

## License

MIT — see [LICENSE](LICENSE).
