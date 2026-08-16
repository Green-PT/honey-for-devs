"use strict";
// Issue #40: VS Code + Copilot + WSL2 expands ${CLAUDE_PLUGIN_ROOT} with
// win32-mangled separators (\home\user\... — microsoft/vscode#313201), which
// POSIX Node resolves against cwd → MODULE_NOT_FOUND. The commands in
// hooks.json wrap each entry path in a node -e normalizer (\ → /) run via
// Module.runMain so require.main guards still fire. These tests execute the
// shipped command strings verbatim — with clean and mangled roots — from a
// foreign cwd, and assert real hook output, not just exit 0.
// Hooks must stay CJS: a "type":"module" in package.json would flip runMain
// to the ESM loader.
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANGLED = ROOT.replaceAll("/", "\\");
const HOOKS = JSON.parse(fs.readFileSync(path.join(__dirname, "hooks.json"), "utf8")).hooks;
const { REVIEWER } = require("./honey-subagent");

const posixOnly = { skip: process.platform === "win32" ? "sh -c is POSIX-only" : false };

function command(event) {
  return HOOKS[event][0].hooks[0].command;
}

function runCommand(cmd, root, { input = "", env = {} } = {}) {
  return execFileSync("sh", ["-c", cmd.replaceAll("${CLAUDE_PLUGIN_ROOT}", root)], {
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), "honey-cwd-")),
    input,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function activeConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "honey-cfg-"));
  fs.writeFileSync(path.join(dir, ".honey-active"), "full");
  return dir;
}

for (const [label, root] of [["clean", ROOT], ["mangled", MANGLED]]) {
  test(`SessionStart command runs main() with ${label} plugin root`, posixOnly, () => {
    const out = JSON.parse(runCommand(command("SessionStart"), root, {
      env: {
        CLAUDE_CONFIG_DIR: activeConfigDir(),
        CLAUDE_CODE_VERSION: "2.1.120", AI_AGENT: "", CLAUDE_CODE_EXECPATH: "",
      },
    }));
    assert.match(out.hookSpecificOutput.additionalContext, /Honey mode is ACTIVE/);
  });

  test(`SubagentStart command runs main() with ${label} plugin root`, posixOnly, () => {
    const out = JSON.parse(runCommand(command("SubagentStart"), root, {
      input: JSON.stringify({ agent_type: "hive-reviewer" }),
      env: { CLAUDE_CONFIG_DIR: activeConfigDir() },
    }));
    assert.equal(out.hookSpecificOutput.additionalContext, REVIEWER);
  });

  test(`PostToolUse command crushes output with ${label} plugin root`, posixOnly, () => {
    const cfg = activeConfigDir();
    const bigArray = Array.from({ length: 50 }, (_, i) => ({
      id: i, level: i === 37 ? "error" : "info", msg: `event ${i} on worker ${i % 4}`,
    }));
    const out = JSON.parse(runCommand(command("PostToolUse"), root, {
      input: JSON.stringify({ tool_name: "Bash", tool_response: { stdout: JSON.stringify(bigArray) } }),
      env: { CLAUDE_CONFIG_DIR: cfg, HONEY_CCR_DIR: path.join(cfg, "ccr") },
    }));
    assert.match(out.hookSpecificOutput.updatedToolOutput, /eson retrieve [0-9a-f]{16}/);
  });
}

test("SKILL.md /honey toggle command matches hooks.json wrapper and survives mangling", posixOnly, () => {
  const skill = fs.readFileSync(path.join(ROOT, "skills", "honey", "SKILL.md"), "utf8");
  const m = skill.match(/`(node -e "[^`]+honey-state\.js" set \$ARGUMENTS)`/);
  assert.ok(m, "SKILL.md documents the honey-state toggle command");
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "honey-cfg-"));
  const out = runCommand(m[1].replace("$ARGUMENTS", "full"), MANGLED, {
    env: { CLAUDE_CONFIG_DIR: cfg },
  });
  assert.equal(out, "full");
  assert.equal(fs.readFileSync(path.join(cfg, ".honey-active"), "utf8").trim(), "full");
});
