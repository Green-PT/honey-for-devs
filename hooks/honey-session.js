#!/usr/bin/env node
// SessionStart hook: if Honey is active, inject a short always-on directive so
// the skill applies reflexively without the user re-invoking it. Kept brief on
// purpose — the full skill lives in skills/honey/SKILL.md; re-injecting it every
// session would itself burn the tokens Honey exists to save.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const FLAG = path.join(DIR, ".honey-active");

let mode = null;
try {
  mode = fs.readFileSync(FLAG, "utf8").trim() || null;
} catch {}

if (!mode || mode === "off") process.exit(0);

const ctx =
  `Honey mode is ACTIVE (intensity: ${mode}). Apply the "honey" skill ` +
  "reflexively to every response this session: write the minimum code that " +
  "needs to exist (YAGNI; stdlib/native before custom) and say it in the fewest " +
  "clear words — but keep code, commands, identifiers, and safety-critical paths " +
  "(auth, money, migrations, deletes, secrets) exact and uncompressed. If a " +
  "committed memory file (PROJECT.md, or a CLAUDE.md memory section) records a " +
  "fact a change invalidates, update it in the same change. Do not " +
  "spend reasoning tokens deciding how to comply.";

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ctx,
    },
  })
);
