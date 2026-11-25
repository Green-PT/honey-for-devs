# Changelog

Every manifest carries the same version (`tests/versions.test.js` checks it). Releases are
tagged on `main`.

## Unreleased

### Changed
- CO₂ now uses the token-based method of Llopis-Garcia (2026, *Sustainable Production
  and Consumption* 70, doi:10.1016/j.spc.2026.11.003) with SAEF v3.2.0 factors (CC BY
  4.0), replacing the EcoLogits port. Input and cache tokens count, size classes replace
  per-model params, and the grid is the global average. Opus figures drop ~60× per
  output token, and the CO₂ saved shrinks to the output share of the session.
- Water estimate (on-site + off-site) in the badge, `honey-eco` and `honey-usage`.
- Badge no longer shows $ saved: session cost x saving ratio overclaimed, since most cost
  is input and cache. `honey-usage --savings` prices saved output tokens.
- Pricing for Claude Fable 5.2 / Mythos 5.2, the Sonnet 5.5 cache rate, and GPT-6.x
  (Astra, Sol, Terra, Luna); OpenAI cache writes no longer billed at 1.25x.
- Bench client: adaptive thinking on current Claude models (`budget_tokens` 400s there).
- CI on Node 22; `@toon-format/toon` 2.3.1 (GHSA-p95v-992w-h6c3).

### Fixed
- The CO₂ badge never rendered since 1.4.0: the statusline referenced a removed `DIR`.

### Removed
- `hooks/eco-models.json`, `scripts/eco_report.py`, `scripts/build-eco-models.py`.

## 1.4.0 — 2026-10-18

### Added
- `honey-check`: no-model `memory` lint (stale paths, dead `@imports`, duplicated rules, a
  `MEMORY.md` past what loads) and `fidelity` check for compressed rewrites.
  `honey-compress` restores its backup when fidelity fails.
- Honey mode per project; `/honey default <mode>` sets the fallback for every repo.
- Repo map at session start (~50 tokens) so the agent reuses before writing; `HONEY_MAP=0`
  turns it off.
- Core rule: never cut a name a provided stub, interface or public API defines. Found by
  the external suite (Honey dropped stub constants the hidden tests import); with it Honey
  passes 63/63 there (was 60/63) and the regression gate passes.
- Core rule: end with one line naming what was skipped or not verified. Benched free:
  output +0.3% (p=0.90) against the skill without it.
- New hosts: Kimi Code, Devin CLI, Grok Build, Qoder, Antigravity, CodeBuddy, oh-my-pi.
- `honey-usage`: actual token usage across local coding agents, with `--savings`.
- `honey-chat` compact edition for 1,500-character custom-instruction fields.
- GPT-6 Astra pricing and alias.
- Animated README banner; the README is one screen, with detail in `docs/`.

### Changed
- Shortcuts are marked `shortcut:` instead of `honey:` (`honey-debt` reads both).
- `honey-review` numbers its findings.
- Bench: Opus 5.5 reference stamp `full-opus55b` against the competitor skills re-pinned on
  2026-10-18. Honey vs no skill: output −40%, lines of code −52%, cost −31% (p<0.001),
  judge a tie, 100% tests. Opus 5, Sonnet 5, Haiku 4.5 and Fable 5 stamps added.
- Bench pricing: Opus 5.5 $4/$20, Sonnet 5 corrected to $2/$10, Haiku 5.5 added.

### Measured (all Opus 5.5 unless named)
- External suite: 21 Exercism tasks picked by rule. Honey −20% output, −36% LOC, −13%
  cost, 95% tests (baseline 98%); after the stub-names rule −21% / −37% / −10% at 100%.
- Agent loop (Cline): compact rule −39% output with no extra turns, cost flat (−1%, ns);
  the full skill as a per-turn rule costs 36% more.
- Sonnet 5.5: −37% output (gets a savings entry). Haiku 5.5: −38% LOC but output −3% (ns),
  because thinking grows; no savings claim.
- `honey-design` cuts 52% but loses the web judge on all 7 pages; stays opt-in.

### Fixed
- Log compressor returns Bash's output object as `updatedToolOutput`, so Claude Code
  applies it.
- Bench judges on thinking-by-default models: 4096-token budget (200 left 40–57% of scores
  empty) and a parser that takes the last `{"score": …}` object.
- Bench refuses to overwrite a live stamp without `--resume`, locks a stamp while a run
  writes it, fails a run with more than 5% empty judge seats, and keeps mock runs in
  `mock-latest`.
- `--uninstall` removes Honey; the Codex plugin installs from the marketplace; OpenCode
  installs globally.
- Bench grader sanitizes its child-process call; refused cells are excluded from pairing.

## 1.3.1 — 2026-08-03

Multi-tool skill, reproducible benchmark with paired per-task reporting, and the ESON
handoff format. 23-task mixed suite on Opus 4.8: 29% lower median output, 100% tests, no
measurable overall quality loss.

## 1.1.0 — 2026-07-03

Honey harness and ESON.
