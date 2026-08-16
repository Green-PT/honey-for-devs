"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "honey-subagent.js");
const { directiveFor, WORKER, REVIEWER } = require("./honey-subagent");

function run(configDir, stdin) {
  return execFileSync("node", [SCRIPT], {
    input: stdin,
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf8",
  });
}

test("directiveFor routes reviewers to the prose-only variant", () => {
  assert.equal(directiveFor("hive-reviewer"), REVIEWER);
  assert.equal(directiveFor("code-audit"), REVIEWER);
  assert.equal(directiveFor("general-purpose"), WORKER);
  assert.equal(directiveFor(""), WORKER);
});

test("inactive (no flag) emits nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "honey-"));
  assert.equal(run(dir, "{}"), "");
});

test("mode off emits nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "honey-"));
  fs.writeFileSync(path.join(dir, ".honey-active"), "off");
  assert.equal(run(dir, "{}"), "");
});

test("active emits SubagentStart additionalContext matched to agent_type", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "honey-"));
  fs.writeFileSync(path.join(dir, ".honey-active"), "full");
  const worker = JSON.parse(run(dir, JSON.stringify({ agent_type: "general-purpose" })));
  assert.equal(worker.hookSpecificOutput.hookEventName, "SubagentStart");
  assert.equal(worker.hookSpecificOutput.additionalContext, WORKER);
  const reviewer = JSON.parse(run(dir, JSON.stringify({ agent_type: "honey:hive-reviewer" })));
  assert.equal(reviewer.hookSpecificOutput.additionalContext, REVIEWER);
});

test("malformed stdin still emits the worker directive", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "honey-"));
  fs.writeFileSync(path.join(dir, ".honey-active"), "full");
  const out = JSON.parse(run(dir, "not json"));
  assert.equal(out.hookSpecificOutput.additionalContext, WORKER);
});
