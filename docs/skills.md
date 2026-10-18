# Skills and subagents


Honey is one always-on core plus a family of on-demand tools. The core is a
*writing style* (it must be the default to pay off); the rest are *actions* you
reach for at a specific moment.

| Name | Kind | What it does |
|------|------|--------------|
| `honey` | core skill (always-on) | the three levers, applied reflexively to every response — plus loop cost discipline for recurring `/loop` runs. `/honey [lite\|full\|ultra\|off]` |
| `honey-chat` | standalone prompt | Honey for plain chat — the terse-prose core, no tools required. Paste [`skills/honey-chat/SKILL.md`](../skills/honey-chat/SKILL.md) into a claude.ai Project's custom instructions, a Style, or an API system prompt (~500 tokens); [`COMPACT.md`](../skills/honey-chat/COMPACT.md) (≤1,500 chars) fits ChatGPT/Gemini custom-instruction fields |
| `honey-design` | satellite skill | for user-facing UI (landing pages, components): keeps the full rendered polish, cuts tokens by writing the design densely (CSS vars, shared classes, `clamp()`) — same pixels, fewer tokens |
| `honey-review` | satellite skill | review a diff for over-engineering + over-verbosity; terse numbered delete-list ("cut 1 and 3") |
| `honey-eco` | satellite skill | this session's CO₂ / $ / tokens saved, from the committed EcoLogits port |
| `honey-gain` | satellite skill | the committed benchmark scoreboard (reads `bench/results/` at runtime) |
| `honey-debt` | satellite skill | harvest every `shortcut:` marker (and legacy `honey:` ones) into a debt ledger, flagging the ones with no revisit trigger — so a deliberate simplification can't quietly go permanent |
| `honey-compress` | satellite skill | rewrite a re-read memory file (CLAUDE.md, AGENTS.md) tersely to cut *input* tokens; backs up the original, then `honey-check fidelity` undoes any rewrite that lost a number, code span, negation or safety word, or didn't shrink |
| `honey-memory` | satellite skill | create + maintain one committed per-project `PROJECT.md` so agents stop re-discovering the same facts every cold session; stores only stable, not-in-the-code context, kept honest by living in git and linted by `honey-check memory` (stale paths, dead `@imports`, duplicated rules, a `MEMORY.md` past what loads) |
| `honey-ccr` | satellite skill | crush huge redundant array tool output (logs, scan results) to a sampled view; lossy-but-recoverable via `eson crush`/`retrieve` |
| `honey-px` | satellite skill | read huge dense *read-only* bulk as rendered PNG pages (`npx pxpipe-proxy export`) — image tokens scale with pixels, not chars: **up to −85%** on token-dense content (Fable-class readers only); lossy on exact strings, never for files you'll edit |
| `honey-loop` | satellite skill | cost discipline for recurring `/loop` runs: cache-aware pacing (skip the 300s dead zone), event-driven-over-polling, no-change short-circuit, compact state handle, stop condition |
| `honey-superpowers` | satellite skill | stack Honey onto Superpowers-style subagent workflows: the Honey directive to inject into each dispatch prompt (worker + reviewer variants). On Claude Code the plugin's `SubagentStart` hook injects it automatically |
| `honey-hive` | guide skill | decide when to delegate to the hive vs. work inline |
| `hive-scout` | subagent (haiku, read-only) | locate symbols / callers / configs; returns a compact id-keyed JSON map |
| `hive-reviewer` | subagent (haiku, read-only) | review a diff/files; returns columnar id-keyed JSON findings |
| `hive-builder` | subagent (sonnet, ≤2 files) | make a surgical edit under the ladder; returns a compact change-manifest |

The **hive** is Lever 3 with a runtime: each subagent returns a compressed handoff,
so the result injected back into the orchestrator's context is **−44–53%** smaller
with zero loss (`npm run bench:hive`). Live, the skills hold up too — honey −86%,
honey-review −70%, hive-reviewer −43% output tokens at passing correctness
(`npm run bench:skills`). See [`bench/hive/RESULTS.md`](../bench/hive/RESULTS.md) and
[`bench/skills/RESULTS.md`](../bench/skills/RESULTS.md).

On **user-facing** work — where the core skill *spends* tokens because polish is the
spec — `honey-design` keeps the same rendered polish for **−19% output tokens** vs no
skill (judge 92 vs 90), beating the core skill on both axes across 7 landing-page/UI
tasks. See [`bench/results/honey-design.md`](../bench/results/honey-design.md).

> **Honesty note.** Earlier versions of this README quoted `92% / 78% / 73%` quality
> and `−57% / −65% / −70%` tokens from an unpublished run. Those don't reproduce —
> the real quality spread is far narrower and the token savings are tier-dependent
> (and Ponytail *adds* tokens on simple code).
>
> A second correction, 2026-07-29: the figures before that were **ratios of arm
> totals** (`sum(honey)/sum(baseline)`), which one long task can dominate. Everything
> above is now a paired per-task median with a p-value. That moved honey's headline
> from −15% to **−29%** — the old method was understating it — but it also retired
> two numbers that turned out to be outlier artifacts: Ponytail's "−22% output" is
> really −7% (ns), and Caveman's "tied quality" is a 16-of-23-task loss (p=0.004).
> Both corrections concern the July 2026 versions. Re-run on Opus 5.5 against the
> current upstream skills, Ponytail 5 is −28% output (p=0.002) and Caveman −29%
> (p<0.001); Ponytail's own harness reports −45% on the same model.
> Method and pre-registered endpoints: [`bench/METHODOLOGY.md`](../bench/METHODOLOGY.md).
> Regenerate any figure offline with
> `node bench/src/report.js --stamp full-opus55b --by-type`.
