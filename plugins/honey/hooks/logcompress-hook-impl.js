#!/usr/bin/env node
"use strict";
// PostToolUse hook — context GC at entry. Big Bash output is compressed BEFORE it
// lands in context (history is immutable once it's in — no hook can rewrite it later),
// and the original is stashed so any detail stays retrievable via `eson retrieve <hash>`.
// Two transforms, tried in order:
//   1. uniform JSON array (≥20 items, ≥2k chars) → CCR crush: endpoints + anomalies +
//      head/tail sample + sentinel hash (measured -38..-84% on ≥5-item arrays)
//   2. repetitive text (≥25 lines) → collapse consecutive same-template lines ⟨×N⟩
//      (measured 0.4% on typical coding output — real wins are retry storms/installers)
// Loaded via logcompress-hook.js (ES5 guard — keeps old node from parsing the `??` here);
// fires only while Honey mode is active (`/honey off` disables).
// NOTE: Claude Code builds hit by anthropics/claude-code#68951 ignore updatedToolOutput
// for built-in Bash — the hook then runs and stashes but the rewrite is dropped.
// honey-session.js warns at session start on affected versions.
// Emits `updatedToolOutput` (replaces the tool result the model sees). Fail-open
// everywhere: any uncertainty → no output → the original result reaches the model unchanged.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { compress } = require("./logcompress");
const { crush } = require("../eso/ccr");

// Forced (hook) crush is more conservative than the model-invoked `eson crush`:
// the model can't veto it, so only clearly-bulk arrays qualify.
const CRUSH_MIN_ITEMS = 20;
const CRUSH_MIN_CHARS = 2000;

function emit(obj) { process.stdout.write(JSON.stringify(obj)); }
function passthrough() { process.exit(0); } // no output → original result is kept

function stash(text) {
  const cacheDir = process.env.HONEY_CCR_DIR || path.join(os.tmpdir(), "honey-ccr");
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${hash}.json`), text);
  return hash;
}

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  if ((input.tool_name || input.toolName) !== "Bash") passthrough();

  // gate: any active Honey mode — same flag honey-session.js reads
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  let mode = "";
  try { mode = fs.readFileSync(path.join(dir, ".honey-active"), "utf8").trim(); } catch {}
  if (!mode || mode === "off") passthrough();

  const resp = input.tool_response ?? input.toolResponse ?? input.tool_result;
  const text = typeof resp === "string" ? resp
    : resp && typeof resp === "object" ? (resp.stdout ?? resp.output ?? resp.content ?? "") : "";
  if (typeof text !== "string" || !text) passthrough();

  // 1. uniform JSON array → CCR crush
  if (text.length >= CRUSH_MIN_CHARS && text.trimStart().startsWith("[")) {
    let array;
    try { array = JSON.parse(text); } catch {}
    if (Array.isArray(array) && array.length >= CRUSH_MIN_ITEMS) {
      const { view, dropped } = crush(array);
      if (dropped > 0) {
        const hash = stash(text);
        const note = `\n[honey: kept ${array.length - dropped} of ${array.length} rows. Full array: \`eson retrieve ${hash}\`]`;
        emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: JSON.stringify(view) + note } });
        process.exit(0);
      }
    }
  }

  // 2. repetitive text → collapse consecutive repeats
  const { view, dropped } = compress(text);
  if (dropped < 1) passthrough(); // nothing collapsed → leave it

  const hash = stash(text);
  const note = `\n[honey: collapsed ${dropped} repeated line(s). Full output: \`eson retrieve ${hash}\`]`;
  emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: view + note } });
} catch {
  passthrough(); // fail open — never corrupt a tool result
}
