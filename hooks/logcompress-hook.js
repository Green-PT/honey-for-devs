#!/usr/bin/env node
"use strict";
// PostToolUse hook (Phase 3): when Honey mode is `ultra`, collapse repetitive Bash output
// before it lands in context, and stash the original so any detail stays retrievable.
// Emits `updatedToolOutput` (replaces the tool result the model sees). Fail-open everywhere:
// any uncertainty → no output → the original result reaches the model unchanged.
//
// NOT auto-registered in hooks.json: measured 0.4% on real coding Bash output (repetitive
// runs are rare), so it isn't worth a node spawn on every Bash call. Enable deliberately —
// add a PostToolUse/Bash entry pointing here — if your workload emits retry storms / verbose
// installers. Ungated by mode it still no-ops unless mode==ultra.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { compress } = require("./logcompress");

function emit(obj) { process.stdout.write(JSON.stringify(obj)); }
function passthrough() { process.exit(0); } // no output → original result is kept

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  if ((input.tool_name || input.toolName) !== "Bash") passthrough();

  // ultra-gate: read the same flag honey-session.js uses
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  let mode = "";
  try { mode = fs.readFileSync(path.join(dir, ".honey-active"), "utf8").trim(); } catch {}
  if (mode !== "ultra") passthrough();

  const resp = input.tool_response ?? input.toolResponse ?? input.tool_result;
  const text = typeof resp === "string" ? resp
    : resp && typeof resp === "object" ? (resp.stdout ?? resp.output ?? resp.content ?? "") : "";
  if (typeof text !== "string" || !text) passthrough();

  const { view, dropped } = compress(text);
  if (dropped < 1) passthrough(); // nothing collapsed → leave it

  // stash the original so a per-line detail is recoverable (same cache as `eson retrieve`)
  const cacheDir = process.env.HONEY_CCR_DIR || path.join(os.tmpdir(), "honey-ccr");
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${hash}.json`), text);

  const note = `\n[honey: collapsed ${dropped} repeated line(s). Full output: \`eson retrieve ${hash}\`]`;
  emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: view + note } });
} catch {
  passthrough(); // fail open — never corrupt a tool result
}
