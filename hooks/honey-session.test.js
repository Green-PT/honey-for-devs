"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { claudeCodeVersion, ccrInert } = require("./honey-session");
const HOOK = path.join(__dirname, "honey-session.js");

test("claudeCodeVersion reads env in priority order", () => {
  assert.strictEqual(claudeCodeVersion({ CLAUDE_CODE_VERSION: "2.1.206" }), "2.1.206");
  assert.strictEqual(claudeCodeVersion({ AI_AGENT: "claude-code_2-1-205_agent" }), "2.1.205");
  assert.strictEqual(
    claudeCodeVersion({ CLAUDE_CODE_EXECPATH: "/x/claude-code/2.1.205/claude.app/Contents/MacOS/claude" }),
    "2.1.205"
  );
  assert.strictEqual(claudeCodeVersion({}), null);
});

test("ccrInert only below the version that added updatedToolOutput", () => {
  assert.strictEqual(ccrInert("2.1.120"), true);
  assert.strictEqual(ccrInert("2.1.121"), false);
  assert.strictEqual(ccrInert("2.1.300"), false);
  assert.strictEqual(ccrInert(null), false); // unknown build → no warning
});

function runHook(env) {
  return execFileSync("node", [HOOK], { env: { ...process.env, ...env }, encoding: "utf8" });
}

test("affected version → systemMessage once, silent on repeat, re-warns on upgrade", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "honey-session-test-"));
  fs.writeFileSync(path.join(tmp, ".honey-active"), "full");
  const env = { CLAUDE_CONFIG_DIR: tmp, CLAUDE_CODE_VERSION: "2.1.100", AI_AGENT: "", CLAUDE_CODE_EXECPATH: "" };

  const first = JSON.parse(runHook(env));
  assert.match(first.systemMessage, /needs 2\.1\.121\+/);
  assert.match(first.hookSpecificOutput.additionalContext, /Honey mode is ACTIVE/);

  const second = JSON.parse(runHook(env));
  assert.strictEqual(second.systemMessage, undefined);

  const upgraded = JSON.parse(runHook({ ...env, CLAUDE_CODE_VERSION: "2.1.110" }));
  assert.match(upgraded.systemMessage, /needs 2\.1\.121\+/);
});

test("unaffected version → no systemMessage", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "honey-session-test-"));
  fs.writeFileSync(path.join(tmp, ".honey-active"), "full");
  const out = JSON.parse(runHook({
    CLAUDE_CONFIG_DIR: tmp, CLAUDE_CODE_VERSION: "2.1.300", AI_AGENT: "", CLAUDE_CODE_EXECPATH: "",
  }));
  assert.strictEqual(out.systemMessage, undefined);
});
