#!/usr/bin/env node
// Read/write the Honey active-flag at $CLAUDE_CONFIG_DIR/.honey-active.
// Usage: honey-state.js get | set <lite|full|ultra|off> | off
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const FLAG = path.join(DIR, ".honey-active");
const MODES = ["lite", "full", "ultra"];

function read() {
  try {
    return fs.readFileSync(FLAG, "utf8").trim() || null;
  } catch {
    return null;
  }
}
function write(mode) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FLAG, mode + "\n");
}
function clear() {
  try {
    fs.unlinkSync(FLAG);
  } catch {}
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "get") {
  process.stdout.write(read() || "off");
} else if (cmd === "off") {
  clear();
  process.stdout.write("off");
} else if (cmd === "set") {
  const m = (arg || "full").toLowerCase();
  if (m === "off") {
    clear();
    process.stdout.write("off");
  } else {
    const mode = MODES.includes(m) ? m : "full";
    write(mode);
    process.stdout.write(mode);
  }
} else {
  process.stderr.write(
    "usage: honey-state.js get | set <lite|full|ultra|off> | off\n"
  );
  process.exit(1);
}
