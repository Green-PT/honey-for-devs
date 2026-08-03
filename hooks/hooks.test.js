"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, "hooks.json"), "utf8"));
const commands = Object.values(hooks.hooks).flat().flatMap((group) => group.hooks).map((hook) => hook.command);

test("hook commands normalize Windows plugin roots for Linux", () => {
  assert.equal(commands.length, 3);
  for (const command of commands) {
    assert.match(command, /printf '%s'/);
    assert.match(command, /s#\\\\#\/#g/);
    assert.match(command, /\/mnt\/\\L\\1/);
  }
});