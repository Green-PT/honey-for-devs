#!/usr/bin/env node
// SessionStart hook: if Honey is active, inject a short always-on directive so
// the skill applies reflexively without the user re-invoking it. Kept brief on
// purpose — the full skill lives in skills/honey/SKILL.md; re-injecting it every
// session would itself burn the tokens Honey exists to save.
// Also warns (once per version, via systemMessage) when the Bash log compressor
// is inert: old node on the hook PATH, or a Claude Code build too old to rewrite
// built-in tool output via PostToolUse updatedToolOutput.
// Must stay parseable on old node: no `??`, no `?.` — this file IS the warning path.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// PostToolUse updatedToolOutput for built-in tools shipped in 2.1.121. (#68951 was the
// hook sending a bare string instead of Bash's output object — fixed in
// logcompress-hook-impl.js, not a Claude Code bug.)
const CCR_MIN_VERSION = "2.1.121";

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

// Short map of what already exists, so the agent reuses before it writes (Lever 1,
// rung 2). Hardened because file names are repo-controlled text injected into hidden
// context: only plain path characters pass, symlinks are skipped, and a 1s cap means
// a huge or slow repo just gets no map. HONEY_MAP=0 turns it off.
var SAFE_PATH = /^[A-Za-z0-9._@+\/-]{1,120}$/;
var SHARED_DIR = /(^|\/)(utils?|helpers?|lib|common|shared|core)\//i;

function repoMap(cwd) {
  if (!cwd || process.env.HONEY_MAP === "0") return "";
  var out;
  try {
    out = require("child_process").execFileSync("git", ["-C", cwd, "ls-files", "-s"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 1000, maxBuffer: 64 << 20,
    });
  } catch (e) {
    return "";
  }
  var dirs = {}, shared = [];
  out.split("\n").forEach(function (line) {
    var tab = line.indexOf("\t");
    if (tab < 0 || line.slice(0, 6) === "120000") return; // symlink
    var p = line.slice(tab + 1);
    if (!SAFE_PATH.test(p)) return;
    var slash = p.indexOf("/");
    var top = slash < 0 ? "." : p.slice(0, slash + 1);
    dirs[top] = (dirs[top] || 0) + 1;
    if (SHARED_DIR.test(p) && !/(test|spec)/i.test(p)) shared.push(p);
  });
  var tops = Object.keys(dirs).sort(function (a, b) { return dirs[b] - dirs[a]; }).slice(0, 12);
  if (!tops.length) return "";
  var map = "Repo map (reuse before writing): " +
    tops.map(function (d) { return d + " " + dirs[d]; }).join(", ") + ".";
  if (shared.length) {
    map += " Shared code: " + shared.slice(0, 15).join(", ") +
      (shared.length > 15 ? " (+" + (shared.length - 15) + " more)" : "") + ".";
  }
  return map;
}

// null version → unknown build → assume fine (README covers it); don't cry wolf.
function ccrInert(version) {
  return !!version && cmpVersions(version, CCR_MIN_VERSION) < 0;
}

function main() {
  const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

  var hookInput = null;
  try { hookInput = JSON.parse(fs.readFileSync(0, "utf8")); } catch (e) {}

  const mode = require("./honey-state.js").activeMode(hookInput && hookInput.cwd);
  if (!mode) process.exit(0);

  // Ledger for `honey-usage --savings`: one line per Honey session start, so
  // savings can later be claimed only for sessions verifiably run under Honey
  // (and in which mode). Append-only; never let it break the hook.
  try {
    if (hookInput && hookInput.transcript_path) {
      fs.appendFileSync(
        path.join(DIR, ".honey-usage-ledger.jsonl"),
        JSON.stringify({ ts: Date.now(), transcript_path: hookInput.transcript_path, mode: mode }) + "\n"
      );
    }
  } catch (e) {}

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
      "honey: Claude Code " + cc + " predates PostToolUse updatedToolOutput for " +
      "built-in tools (needs " + CCR_MIN_VERSION + "+), so the Bash log compressor " +
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
  const map = repoMap((hookInput && hookInput.cwd) || process.env.CLAUDE_PROJECT_DIR);
  if (map) out.hookSpecificOutput.additionalContext += "\n" + map;

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
module.exports = { claudeCodeVersion, cmpVersions, ccrInert, repoMap };
