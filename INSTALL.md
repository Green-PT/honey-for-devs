# Installing Honey

Honey installs the same way Ponytail and Caveman do: a Claude Code plugin
marketplace one-liner, a unified one-line installer that auto-detects every agent
you have, or a manual per-tool copy. Pick whichever fits.

## Requirements

- **Node.js** on your PATH (the installer and the Claude Code hooks are tiny Node
  scripts). Check with `node --version`.
- `git` is used by the one-line installer when available; it falls back to a
  tarball/zip download if not.

## Option A — Claude Code plugin marketplace (recommended for Claude Code)

```
/plugin marketplace add Green-PT/honey-for-devs
/plugin install honey@greenpt
```

This installs the `honey` skill, the `/honey` command, and a SessionStart hook
that keeps Honey active across sessions once you turn it on.

Usage:

- `/honey` — turn Honey on at `full` intensity
- `/honey lite` · `/honey full` · `/honey ultra` — set intensity
- `/honey off` — turn it off

A `🍯 honey:<mode>` badge appears in your statusline while it's active.

## Option A2 — Codex plugin marketplace (recommended for Codex)

```
codex plugin marketplace add Green-PT/honey-for-devs
```

Then enable `honey` from Codex's `/plugins` UI. This installs the same
`skills/` (read natively via the Agent Skills standard) and the SessionStart
hook (Codex honors the `CLAUDE_PLUGIN_ROOT` env var for backwards compat, so the
hook runs unchanged).

Codex also reads a root `AGENTS.md` automatically, so for a single project you
can skip the plugin entirely and just `cp AGENTS.md <project>/` — or drop it at
`~/.codex/AGENTS.md` for a global install.

## Option A3 — ClawHub (recommended for OpenClaw)

```
clawhub install honey
```

Installs Honey as a native OpenClaw skill from ClawHub; the companion skills
install the same way (`clawhub install honey-review`, `clawhub install
honey-design`, and so on). OpenClaw applies it on coding tasks and also exposes a
`/honey` command. Without ClawHub, copy [`.openclaw/skills/honey`](.openclaw/skills/)
into `~/.openclaw/skills/`.

## Option B — One-line installer (all agents)

macOS / Linux / WSL / Git Bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
```

Windows (PowerShell 5.1+):

```powershell
irm https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.ps1 | iex
```

Run in a terminal, it launches an **interactive wizard**: it asks which coding
agents you use (detected ones pre-selected), whether to wire the CO₂ statusline
badge, whether to drop per-repo rule files, and your default Honey mode — then
configures exactly that. The wizard prompts on `/dev/tty`, so it works even
through `curl | bash`. It's safe to re-run.

Non-interactive (CI, pipes with no terminal, or `--yes`) falls back to
auto-detect: it finds your installed agents, runs each one's native install
pathway, and skips the rest. Any explicit flag also skips the wizard.

> Windows (`irm … | iex`) has no `/dev/tty`, so it runs non-interactive. For the
> wizard on Windows, clone the repo and run `node bin/install.js`.

### Flags

Pass flags through the pipe with `bash -s --`, e.g.
`curl -fsSL .../install.sh | bash -s -- --yes --with-init`.

| Flag | Effect |
|------|--------|
| *(none, terminal)* | Interactive wizard |
| `--yes`, `-y` | Skip the wizard; non-interactive auto-detect install |
| `--all` | Install detected CLI agents + statusline badge |
| `--minimal` | Plugin/extension installs only; skip the statusline wiring |
| `--only <id>` | Restrict to one agent (repeatable). IDs: `claude`, `codex`, `copilot`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot-editor`, `opencode`, `openclaw`, `kiro`, `agents` |
| `--with-init` | Also drop editor rule files into the **current directory** |
| `--dry-run` | Print every action without writing anything (works inside the wizard too) |
| `--list` | Show the agent matrix and what's detected |
| `--uninstall` | Remove Honey from detected agents |

### Manual (no piping)

```bash
git clone https://github.com/Green-PT/honey-for-devs.git
cd honey-for-devs
node bin/install.js                  # interactive wizard
node bin/install.js --list           # see what's detected
node bin/install.js --dry-run        # preview the wizard's actions
node bin/install.js --yes            # non-interactive auto-detect install
```

## Option C — Per-tool manual copy

Each editor reads an always-on rule file. Copy the matching one into your project
(or the tool's global config dir):

| Tool | File | Destination |
|------|------|-------------|
| Cursor | `.cursor/rules/honey.mdc` | `<project>/.cursor/rules/` |
| Windsurf | `.windsurf/rules/honey.md` | `<project>/.windsurf/rules/` |
| Cline | `.clinerules/honey.md` | `<project>/.clinerules/` |
| Copilot (editor) | `.github/copilot-instructions.md` | `<project>/.github/` |
| Kiro | `.kiro/steering/honey.md` | `<project>/.kiro/steering/` or `~/.kiro/steering/` |
| OpenCode | `.opencode/AGENTS.md` + `opencode.json` | `<project>/.opencode/` (installer also registers it in `opencode.json` `instructions`, since OpenCode doesn't auto-load nested `.opencode/AGENTS.md`; alternatively copy to `~/.config/opencode/AGENTS.md`) |
| Aider / Zed / universal | `AGENTS.md` | `<project>/` |

OpenClaw is not a rule-file copy — it uses native skills; see Option A3.

These files are generated from `skills/honey/SKILL.md`; don't edit them by hand —
edit the source and run `node scripts/build-rules.js`.

## Uninstall

```bash
# via the one-liner
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash -s -- --uninstall

# or from a clone
node bin/install.js --uninstall
```

In Claude Code you can also run `/plugin uninstall honey@greenpt`. Per-repo rule
files you copied are left in place — delete them manually if you want them gone.
