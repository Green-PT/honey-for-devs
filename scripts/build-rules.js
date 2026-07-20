#!/usr/bin/env node
// Generate every per-platform rule file from the single source of truth:
// skills/honey/SKILL.md. Run after editing the skill. `--check` verifies the
// committed copies are in sync (CI / pre-commit) and exits non-zero on drift.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "skills", "honey", "SKILL.md");

const BANNER =
  "<!-- AUTO-GENERATED from skills/honey/SKILL.md by scripts/build-rules.js. " +
  "Edit the source, then run: node scripts/build-rules.js -->";

const SHORT_DESC =
  "Honey — write less code and say less about it. A reflexive minimal-code " +
  "(YAGNI/stdlib-first) and terse-prose discipline that cuts token cost while " +
  "keeping code, commands, and safety-critical paths exact.";

// Split frontmatter from body. Returns { body } (frontmatter is stripped — each
// platform gets its own header).
function readSource() {
  const raw = fs.readFileSync(SOURCE, "utf8");
  const m = raw.match(/^---\n[\s\S]*?\n---\n?/);
  if (!m) throw new Error("SKILL.md is missing YAML frontmatter");
  // Claude-Code-only sections (e.g. the /honey toggle) stay out of editor rules.
  const body = raw
    .slice(m[0].length)
    .replace(/^\n+/, "")
    .split("<!-- claude-code-only -->")[0]
    .replace(/\n+$/, "\n");
  return { body };
}

// Each target: where it lives + how to wrap the shared body for that tool.
const TARGETS = [
  {
    path: ".cursor/rules/honey.mdc",
    wrap: (body) =>
      `---\ndescription: ${SHORT_DESC}\nalwaysApply: true\n---\n${BANNER}\n\n${body}`,
  },
  {
    path: ".windsurf/rules/honey.md",
    wrap: (body) => `---\ntrigger: always_on\n---\n${BANNER}\n\n${body}`,
  },
  {
    path: ".clinerules/honey.md",
    wrap: (body) => `${BANNER}\n\n${body}`,
  },
  {
    path: ".github/copilot-instructions.md",
    wrap: (body) => `${BANNER}\n\n${body}`,
  },
  {
    path: ".kiro/steering/honey.md",
    wrap: (body) => `---\ninclusion: always\n---\n${BANNER}\n\n${body}`,
  },
  {
    path: ".opencode/AGENTS.md",
    wrap: (body) => `${BANNER}\n\n${body}`,
  },
  {
    // Kilo Code: reads both `.kilo/rules/` and `.kilocode/rules/`; we emit the
    // newer `.kilo/` layout. Auto-injected into instructions at engine startup.
    path: ".kilo/rules/honey.md",
    wrap: (body) => `${BANNER}\n\n${body}`,
  },
  {
    // Universal fallback (Aider, Codex global, Zed, CodeWhale, and any AGENTS.md
    // reader). Root-level so `cp AGENTS.md <project>` just works.
    path: "AGENTS.md",
    wrap: (body) => `${BANNER}\n\n${body}`,
  },
];

function render(body, target) {
  let out = target.wrap(body);
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

function main() {
  const check = process.argv.includes("--check");
  const { body } = readSource();
  const drifted = [];

  for (const target of TARGETS) {
    const abs = path.join(ROOT, target.path);
    const next = render(body, target);
    if (check) {
      const cur = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
      if (cur !== next) drifted.push(target.path);
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, next);
      console.log("wrote " + target.path);
    }
  }

  if (check) {
    if (drifted.length) {
      console.error(
        "Out of sync with skills/honey/SKILL.md:\n  " +
          drifted.join("\n  ") +
          "\nRun: node scripts/build-rules.js"
      );
      process.exit(1);
    }
    console.log("OK — all " + TARGETS.length + " rule files in sync.");
  } else {
    console.log("Generated " + TARGETS.length + " rule files from SKILL.md.");
  }
}

main();
