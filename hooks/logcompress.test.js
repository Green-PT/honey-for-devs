"use strict";
// Tests for LogCompressor + its PostToolUse hook. No API.
//   node hooks/logcompress.test.js
const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { compress, expand } = require("./logcompress");

let n = 0;
const ok = (name, cond) => { n++; if (!cond) { console.error(`FAIL: ${name}`); process.exitCode = 1; } };

// --- pure compressor ---------------------------------------------------------
const storm =
  "[12:00:00] INFO start\n" +
  Array.from({ length: 26 }, (_, i) => `[12:00:${String(i + 1).padStart(2, "0")}] WARN db refused, retrying`).join("\n") +
  "\n[12:00:27] ERROR gave up: host=db-primary\n[12:00:28] INFO ok\n";
const { view, dropped } = compress(storm);
ok("collapses timestamped run", dropped === 25); // 26 WARN → 1 + (×26)
ok("view is smaller", view.length < storm.length);
ok("count recoverable via expand", (expand(view).match(/\bWARN\b/g) || []).length === 26);
ok("keeps non-collapsed lines", view.includes("ERROR gave up: host=db-primary"));
ok("strips ANSI", !compress("\x1b[31m" + storm).view.includes("\x1b["));

// below size gate → only ANSI strip, no collapse
const small = "\x1b[32mline\x1b[0m\na\na\na\n";
ok("small output not collapsed", compress(small).dropped === 0);
ok("small output ANSI stripped", !compress(small).view.includes("\x1b["));

// distinct lines (a real stack trace / test output) are untouched
const trace = Array.from({ length: 30 }, (_, i) => `  File "app/x${i}.py", line ${i}, in f${i}`).join("\n");
ok("distinct lines untouched", compress(trace).dropped === 0);

// --- hook: ultra-gated, fail-open, emits updatedToolOutput -------------------
const HOOK = path.join(__dirname, "logcompress-hook.js");
const run = (payload, env) =>
  execFileSync("node", [HOOK], { input: JSON.stringify(payload), env: { ...process.env, ...env }, encoding: "utf8" });

const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "honey-cfg-"));
const cache = fs.mkdtempSync(path.join(os.tmpdir(), "honey-cache-"));
fs.writeFileSync(path.join(cfg, ".honey-active"), "ultra");
const envUltra = { CLAUDE_CONFIG_DIR: cfg, HONEY_CCR_DIR: cache };

const bashStorm = { tool_name: "Bash", tool_response: storm };
const out = run(bashStorm, envUltra);
ok("hook emits updatedToolOutput on storm", out.includes("updatedToolOutput") && out.includes("×26"));
const handle = JSON.parse(out).hookSpecificOutput.updatedToolOutput.match(/eson retrieve (\w+)/)[1];
ok("hook stashed original", fs.readFileSync(path.join(cache, `${handle}.json`), "utf8") === storm);

// non-ultra → no output (passthrough)
fs.writeFileSync(path.join(cfg, ".honey-active"), "full");
ok("non-ultra passes through", run(bashStorm, envUltra) === "");
fs.writeFileSync(path.join(cfg, ".honey-active"), "ultra");

// non-Bash tool → passthrough
ok("non-Bash passes through", run({ tool_name: "Read", tool_response: storm }, envUltra) === "");
// non-repetitive Bash → passthrough (nothing collapsed)
ok("non-repetitive passes through", run({ tool_name: "Bash", tool_response: trace }, envUltra) === "");
// malformed input → fail open (no throw, no output)
ok("malformed fails open", execFileSync("node", [HOOK], { input: "not json", encoding: "utf8" }) === "");

console.log(`logcompress: ${n} checks, ${process.exitCode ? "FAILED" : "all passed"}`);
