#!/usr/bin/env node
// Honey mode state. The global default lives at $CLAUDE_CONFIG_DIR/.honey-active;
// `/honey <mode>` writes a per-project override under honey-projects/, so a session
// in one repo can't switch or clear another repo's mode.
// Usage: honey-state.js get | set <lite|full|ultra|off> | set default <mode> | off
// Required by every hook: must stay parseable on old node (no `??`, `?.`, bare catch).
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const MODES = ["lite", "full", "ultra"];

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}
function globalFlag() {
  return path.join(configDir(), ".honey-active");
}
function projectFlag(dir) {
  const id = crypto.createHash("sha1").update(path.resolve(dir)).digest("hex").slice(0, 16);
  return path.join(configDir(), "honey-projects", id);
}
function real(p) {
  try {
    return fs.realpathSync(p);
  } catch (e) {
    return path.resolve(p);
  }
}
function readFile(f) {
  try {
    return fs.readFileSync(f, "utf8").trim() || null;
  } catch (e) {
    return null;
  }
}

// Nearest project override walking up from the project dir, else the global default.
// Walking up (not `git rev-parse`) keeps the hot path — every Bash call — process-free.
function readMode(start) {
  let d = real(start || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  for (;;) {
    const m = readFile(projectFlag(d));
    if (m) return m;
    const up = path.dirname(d);
    if (up === d) return readFile(globalFlag());
    d = up;
  }
}
function activeMode(start) {
  const m = readMode(start);
  return m && m !== "off" ? m : null;
}

function projectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 1000,
    }).trim() || process.cwd();
  } catch (e) {
    return process.cwd();
  }
}
function write(f, mode) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, mode + "\n");
}
function normalize(m) {
  m = (m || "full").toLowerCase();
  return m === "off" || MODES.indexOf(m) >= 0 ? m : "full";
}

module.exports = { readMode, activeMode, projectFlag, globalFlag };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd === "get") {
    process.stdout.write(readMode() || "off");
  } else if (cmd === "off" || cmd === "set") {
    if (cmd === "set" && (args[1] || "").toLowerCase() === "default") {
      const mode = normalize(args[2]);
      if (mode === "off") {
        try { fs.unlinkSync(globalFlag()); } catch (e) {}
      } else write(globalFlag(), mode);
      process.stdout.write("default " + mode);
    } else {
      // "off" is written, not deleted: it must override an active global default.
      const mode = cmd === "off" ? "off" : normalize(args[1]);
      write(projectFlag(real(projectRoot())), mode);
      process.stdout.write(mode);
    }
  } else {
    process.stderr.write(
      "usage: honey-state.js get | set <lite|full|ultra|off> | set default <mode> | off\n"
    );
    process.exit(1);
  }
}
