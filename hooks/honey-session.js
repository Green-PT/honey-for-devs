#!/usr/bin/env node
// SessionStart hook: if Honey is active, inject a short always-on directive so
// the skill applies reflexively without the user re-invoking it. Kept brief on
// purpose — the full skill lives in skills/honey/SKILL.md; re-injecting it every
// session would itself burn the tokens Honey exists to save.
// Also warns (once per version, via systemMessage) when the Bash log compressor
// is inert: old node on the hook PATH, or a Claude Code build affected by
// anthropics/claude-code#68951 (updatedToolOutput ignored for built-in Bash).
// Must stay parseable on old node: no `??`, no `?.` — this file IS the warning path.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// anthropics/claude-code#68951 — PostToolUse updatedToolOutput ignored for Bash.
// Regression surface is v2.1.121 (where the field shipped for built-in tools).
// When upstream ships a fix, set CCR_FIXED_IN to that version.
const CCR_BROKEN_SINCE = "2.1.121";
const CCR_FIXED_IN = null;

function claudeCodeVersion(env) {
  let m = (env.CLAUDE_CODE_VERSION || "").match(/^\d+\.\d+\.\d+/);
  if (m) return m[0];
  m = (env.AI_AGENT || "").match(/claude-code_(\d+)-(\d+)-(\d+)/);
  if (m) return m[1] + "." + m[2] + "." + m[3];
  m = (env.CLAUDE_CODE_EXECPATH || "").match(/claude-code[\/\\](\d+\.\d+\.\d+)[\/\\]/);
  if (m) return m[1];
  return null;
}

function cmpVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// null version → unknown build → assume fine (README covers it); don't cry wolf.
function ccrInert(version) {
  if (!version) return false;
  if (cmpVersions(version, CCR_BROKEN_SINCE) < 0) return false;
  return !CCR_FIXED_IN || cmpVersions(version, CCR_FIXED_IN) < 0;
}

function main() {
  const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

  let mode = null;
  try {
    mode = fs.readFileSync(path.join(DIR, ".honey-active"), "utf8").trim() || null;
  } catch (e) {}

  if (!mode || mode === "off") process.exit(0);

  const warnings = [];
  const nodeMajor = parseInt(process.versions.node, 10);
  if (nodeMajor < 14) {
    warnings.push(
      "honey: hooks are running with node " + process.versions.node + " (" +
      process.execPath + ") but need Node >= 14 — the Bash log compressor is " +
      "disabled. Desktop-app sessions use the launchd PATH, not your shell profile."
    );
  }
  const cc = claudeCodeVersion(process.env);
  if (ccrInert(cc)) {
    warnings.push(
      "honey: Claude Code " + cc + " ignores PostToolUse updatedToolOutput for the " +
      "built-in Bash tool (anthropics/claude-code#68951), so the Bash log compressor " +
      "is inert on this version. Piping through `eson crush` still works."
    );
  }

  const out = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        `Honey mode is ACTIVE (intensity: ${mode}). Apply the "honey" skill ` +
        "reflexively to every response this session: write the minimum code that " +
        "needs to exist (YAGNI; stdlib/native before custom) and say it in the fewest " +
        "clear words — but keep code, commands, identifiers, and safety-critical paths " +
        "(auth, money, migrations, deletes, secrets) exact and uncompressed. If a " +
        "committed memory file (PROJECT.md, or a CLAUDE.md memory section) records a " +
        "fact a change invalidates, update it in the same change. Do not " +
        "spend reasoning tokens deciding how to comply.",
    },
  };

  // One-time: re-warn only when the environment changes (upgrade/downgrade),
  // not on every session start.
  if (warnings.length) {
    const MARK = path.join(DIR, ".honey-warned");
    const key = (cc || "?") + "/node" + nodeMajor;
    let prev = "";
    try { prev = fs.readFileSync(MARK, "utf8"); } catch (e) {}
    if (prev !== key) {
      try { fs.writeFileSync(MARK, key); } catch (e) {}
      out.systemMessage = warnings.join("\n");
    }
  }

  process.stdout.write(JSON.stringify(out));
}

if (require.main === module) main();
module.exports = { claudeCodeVersion, cmpVersions, ccrInert };
