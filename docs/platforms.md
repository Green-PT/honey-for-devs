# Install on every platform

Claude Code is in the README. Manual steps, flags and uninstall: [INSTALL.md](../INSTALL.md).

### Plain Claude (claude.ai / API) — no install

The chat edition, [`skills/honey-chat/SKILL.md`](../skills/honey-chat/SKILL.md)
(~500 tokens), is the terse-prose core with the agent-harness levers removed —
nothing in it needs tools. Two ways to use it:

- **Project custom instructions or a Style (recommended):** paste the file in.
  Instructions become part of the system prompt, so Honey applies to **every
  message in every conversation** — always on, no triggering needed. The prefix
  is prompt-cached, and the ~500 input tokens are repaid many times over by the
  halved output.
- **Uploaded Skill (paid plans):** zip the `honey-chat/` folder and upload it as
  a Skill. Cheaper at rest (only the description stays in context) but loads
  only when Claude judges it relevant — for an always-on writing style, Project
  instructions are the better default.

On the API, use the file as (part of) your `system` prompt. Pin intensity by
appending one line: `Default to honey ultra` or `Default to honey lite`.

**Other chat UIs (ChatGPT, Gemini, …):** the prompt is model-agnostic — nothing
in it is Claude-specific. Web custom-instruction fields often cap input
(ChatGPT: 1,500 characters), so paste the compact edition,
[`skills/honey-chat/COMPACT.md`](../skills/honey-chat/COMPACT.md) (&le;1,500
chars, test-guarded), into ChatGPT's "How would you like ChatGPT to respond?"
field or Gemini's saved-info/instructions field. Same rules, condensed; where
the field allows more (Claude Projects, API system prompts), prefer the full
`SKILL.md`.

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
| Codex | `codex plugin marketplace add Green-PT/honey-for-devs` then `codex plugin add honey@greenpt` |
| oh-my-pi (`omp`) | `omp plugin marketplace add Green-PT/honey-for-devs` then `omp plugin install honey@greenpt` |
| GitHub Copilot CLI | `copilot plugin marketplace add Green-PT/honey-for-devs` then `copilot plugin install honey@greenpt` |
| Gemini CLI | `gemini extensions install https://github.com/Green-PT/honey-for-devs` |
| OpenClaw | `clawhub install honey` (companions: `clawhub install honey-review`, …) |
| Hermes Agent | `hermes plugins install Green-PT/honey-for-devs/.hermes --enable` — always-on plugin with `/honey` levels and the skills as `honey:<name>`. Skills only: `node bin/install.js --only hermes` copies `.hermes/skills/` into the Hermes home's `skills/` (`$HERMES_HOME`, else `~/.hermes`; `%LOCALAPPDATA%\hermes` on native Windows); activate with `/honey` (workspace `AGENTS.md` is always-on) |
| Cursor | copy `.cursor/rules/honey.mdc` into your project |
| Windsurf | copy `.windsurf/rules/honey.md` into your project |
| Cline | copy `.clinerules/honey.md` into your project (token-conscious: the compact `skills/honey/cline-rule.md`) |
| GitHub Copilot (editor) | copy `.github/copilot-instructions.md` into your project |
| Kiro | copy `.kiro/steering/honey.md` (project or `~/.kiro/steering/`) |
| OpenCode | `node bin/install.js --only opencode` — copies `AGENTS.md` to `~/.config/opencode/AGENTS.md` (always-on in every project) and `skills/` into `~/.config/opencode/skills/` as native skills; verify with `opencode debug skill` |
| Kilo Code | copy `.kilo/rules/honey.md` into your project (auto-discovered; `.kilocode/rules/` also works) |
| Kimi Code | `/plugins install https://github.com/Green-PT/honey-for-devs`, then `/reload` (`AGENTS.md` goes into the system prompt, skills load on demand) |
| Devin CLI | `devin plugins install Green-PT/honey-for-devs` |
| Grok Build | `grok plugin install Green-PT/honey-for-devs --trust`, then enable it under `/plugins` |
| Qoder | `qodercli plugins install <path-to-checkout>`, or copy `.qoder/rules/honey.md` into your project (`AGENTS.md` at the repo root also auto-loads) |
| Antigravity | copy `.agents/rules/honey.md` into your project |
| CodeBuddy | same two `/plugin` commands as Claude Code |
| Aider / Zed / any AGENTS.md reader | copy `AGENTS.md` into your project |

All of these are also handled automatically by the one-line installer. See
[INSTALL.md](../INSTALL.md) for manual steps, flags, and uninstall.
