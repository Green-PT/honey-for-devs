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

## Option A4 — Hermes Agent

```bash
node bin/install.js --only hermes
```

Copies the generated Hermes skill package ([`.hermes/skills/`](.hermes/skills/))
into `~/.hermes/skills/` — the core `honey` skill plus the companions
(`honey-review`, `honey-design`, and so on), in the portable SKILL.md format
Hermes reads natively. Skills aren't always-on in Hermes: activate with
`/honey` (or just ask); for per-project always-on, drop the root `AGENTS.md`
into your workspace — Hermes reads workspace `AGENTS.md` automatically.
Manual alternative: `cp -r .hermes/skills/* ~/.hermes/skills/`.

## Option A5 — oh-my-pi (`omp`)

```bash
omp plugin marketplace add Green-PT/honey-for-devs
omp plugin install honey@greenpt
```

omp reads Claude Code marketplace catalogs, so Honey's existing
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) installs
as-is — all skills, commands, and agents. Run `/reload-plugins` to pick them up
without restarting the session. `node bin/install.js --only omp` does the same
and also copies the root `AGENTS.md` to `~/.omp/agent/AGENTS.md` for always-on
user-scope context.

## Option A6 — OpenCode

```bash
node bin/install.js --only opencode
```

Global, no per-repo step: copies the root `AGENTS.md` to
`~/.config/opencode/AGENTS.md`, which OpenCode loads as always-on instructions in
every project, and the canonical [`skills/`](skills/) as native SKILL.md packages
in `~/.config/opencode/skills/` — the core `honey` skill plus the companions.
Restart OpenCode, then verify it actually loaded:

```bash
opencode debug skill     # lists honey + companions and the path each came from
```

Manual alternative: `cp AGENTS.md ~/.config/opencode/AGENTS.md` and
`cp -r skills/* ~/.config/opencode/skills/`.

Earlier versions dropped `.opencode/AGENTS.md` into the project and registered it
in `opencode.json` `instructions`; without that registration OpenCode never read
the file, so an install could silently do nothing. For repo-scoped Honey,
commit the root `AGENTS.md` instead (`node bin/install.js --only agents
--with-init`) — OpenCode reads it natively.

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
| `--only <id>` | Restrict to one agent (repeatable). IDs: `claude`, `codex`, `omp`, `copilot`, `gemini`, `cursor`, `windsurf`, `cline`, `copilot-editor`, `opencode`, `openclaw`, `hermes`, `kilo`, `kiro`, `agents` |
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
| Aider / Zed / universal | `AGENTS.md` | `<project>/` |

OpenClaw and OpenCode are not rule-file copies — they use native skills; see
Options A3 and A6.

These files are generated from `skills/honey/SKILL.md`; don't edit them by hand —
edit the source and run `node scripts/build-rules.js`.

## Uninstall

```bash
# via the one-liner
curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash -s -- --uninstall

# or from a clone
node bin/install.js --uninstall
```

In Claude Code you can also run `/plugin uninstall honey@greenpt`, but that leaves
the `greenpt` marketplace and its plugin cache behind; `bin/install.js --uninstall`
removes those too. Per-repo rule files you copied are left in place — delete them
manually if you want them gone.
