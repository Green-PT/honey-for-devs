const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const STATE = path.join(__dirname, "honey-state.js");
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function cli(cfg, cwd, ...args) {
  const env = { ...process.env, CLAUDE_CONFIG_DIR: cfg };
  delete env.CLAUDE_PROJECT_DIR;
  return execFileSync("node", [STATE, ...args], { cwd, env, encoding: "utf8" });
}

test("a project's /honey off doesn't touch another project or the default", () => {
  const cfg = tmp("honey-cfg-"), a = tmp("honey-a-"), b = tmp("honey-b-");
  assert.equal(cli(cfg, a, "set", "default", "full"), "default full");
  assert.equal(cli(cfg, a, "off"), "off");
  assert.equal(cli(cfg, a, "get"), "off");
  assert.equal(cli(cfg, b, "get"), "full");
  assert.equal(cli(cfg, b, "set", "ultra"), "ultra");
  assert.equal(cli(cfg, a, "get"), "off");
  assert.equal(fs.readFileSync(path.join(cfg, ".honey-active"), "utf8").trim(), "full");
});

test("a subdirectory inherits its project's override", () => {
  const cfg = tmp("honey-cfg-"), proj = tmp("honey-p-");
  const sub = path.join(proj, "src", "deep");
  fs.mkdirSync(sub, { recursive: true });
  cli(cfg, proj, "set", "lite");
  assert.equal(cli(cfg, sub, "get"), "lite");
});

test("no flag at all reads as off; unknown mode falls back to full", () => {
  const cfg = tmp("honey-cfg-"), proj = tmp("honey-p-");
  assert.equal(cli(cfg, proj, "get"), "off");
  assert.equal(cli(cfg, proj, "set", "bogus"), "full");
});
