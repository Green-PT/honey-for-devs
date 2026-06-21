#!/usr/bin/env node
// Unified Honey installer. Detects installed coding agents and runs each one's
// native install pathway: plugin-marketplace / extension commands for CLI agents,
// and generated rule-file copies for editor agents (with --with-init).
//
// Flags (mirror the reference installers):
//   --all          full install: detected CLI agents + statusline (default)
//   --minimal      CLI/plugin installs only; skip the statusline wiring
//   --only <id>    restrict to one agent id (repeatable)
//   --with-init    also drop per-repo rule files into the current directory
//   --dry-run      print every action without executing it
//   --list         show the agent matrix and detection status, then exit
//   --uninstall    remove Honey from detected agents
//   --help         this message
"use strict";

const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SLUG = "Green-PT/honey-for-devs";
const URL = "https://github.com/" + SLUG;
const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude");

// ---- argv -----------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const onlyIds = argv.reduce((acc, a, i) => {
  if (a === "--only" && argv[i + 1]) acc.push(argv[i + 1].toLowerCase());
  return acc;
}, []);
const DRY = has("--dry-run");
const MINIMAL = has("--minimal");
const WITH_INIT = has("--with-init");
const wanted = (id) => onlyIds.length === 0 || onlyIds.includes(id);

// ---- helpers --------------------------------------------------------------
function which(cmd) {
  try {
    cp.execSync((process.platform === "win32" ? "where " : "command -v ") + cmd, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
const dirExists = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const note = (m) => console.log(m);
function run(cmd) {
  if (DRY) return note("  [dry-run] $ " + cmd);
  note("  $ " + cmd);
  try {
    cp.execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    note("  ! command failed (continuing): " + cmd);
  }
}
function copy(srcRel, destAbs) {
  const src = path.join(REPO, srcRel);
  if (DRY) return note("  [dry-run] copy " + srcRel + " -> " + destAbs);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(src, destAbs);
  note("  copy " + srcRel + " -> " + destAbs);
}

// ---- statusline (Claude Code) ---------------------------------------------
const SL_DIR = path.join(CLAUDE_DIR, "honey");
const SL_PATH = path.join(SL_DIR, "statusline.js");
const settingsPath = path.join(CLAUDE_DIR, "settings.json");

function installStatusline() {
  if (MINIMAL) return;
  copy("hooks/statusline.js", SL_PATH);
  copy("hooks/eco.js", path.join(SL_DIR, "eco.js")); // statusline requires these
  copy("hooks/eco-config.json", path.join(SL_DIR, "eco-config.json"));
  copy("hooks/eco-models.json", path.join(SL_DIR, "eco-models.json"));
  const cmd = 'node "' + SL_PATH + '"';
  if (DRY) return note("  [dry-run] wire statusLine in " + settingsPath);
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {}
  if (settings.statusLine) {
    note("  statusLine already set — add this manually if you want the badge:");
    note('    "statusLine": { "type": "command", "command": ' + JSON.stringify(cmd) + " }");
    return;
  }
  settings.statusLine = { type: "command", command: cmd };
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  note("  wired 🍯 statusLine into " + settingsPath);
}
function removeStatusline() {
  if (DRY) return note("  [dry-run] remove statusLine + " + SL_DIR);
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings.statusLine && String(settings.statusLine.command || "").includes(SL_PATH)) {
      delete settings.statusLine;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      note("  removed statusLine from settings.json");
    }
  } catch {}
  try {
    fs.rmSync(SL_DIR, { recursive: true, force: true });
  } catch {}
}

// ---- agent matrix ---------------------------------------------------------
// CLI agents install globally via their plugin/extension manager.
const CLI_AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    detect: () => which("claude") || dirExists(CLAUDE_DIR),
    install: () => {
      run("claude plugin marketplace add " + SLUG);
      run("claude plugin install honey@greenpt");
      installStatusline();
    },
    uninstall: () => {
      run("claude plugin uninstall honey@greenpt");
      removeStatusline();
    },
  },
  {
    id: "codex",
    name: "Codex",
    detect: () => which("codex") || dirExists(path.join(HOME, ".codex")),
    install: () => {
      run("codex plugin marketplace add " + SLUG);
      note("  then enable honey via Codex `/plugins` UI");
      copy("AGENTS.md", path.join(HOME, ".codex", "AGENTS.md"));
    },
    uninstall: () => run("codex plugin uninstall honey@greenpt"),
  },
  {
    id: "copilot",
    name: "GitHub Copilot CLI",
    detect: () => which("copilot"),
    install: () => {
      run("copilot plugin marketplace add " + SLUG);
      run("copilot plugin install honey@greenpt");
    },
    uninstall: () => run("copilot plugin uninstall honey@greenpt"),
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    detect: () => which("gemini"),
    install: () => run("gemini extensions install " + URL),
    uninstall: () => run("gemini extensions uninstall honey"),
  },
];

// Editor agents are configured by dropping a generated rule file into a repo.
const RULE_AGENTS = [
  { id: "cursor", name: "Cursor", src: ".cursor/rules/honey.mdc", dest: ".cursor/rules/honey.mdc" },
  { id: "windsurf", name: "Windsurf", src: ".windsurf/rules/honey.md", dest: ".windsurf/rules/honey.md" },
  { id: "cline", name: "Cline", src: ".clinerules/honey.md", dest: ".clinerules/honey.md" },
  { id: "copilot-editor", name: "Copilot (editor)", src: ".github/copilot-instructions.md", dest: ".github/copilot-instructions.md" },
  { id: "opencode", name: "OpenCode", src: ".opencode/AGENTS.md", dest: ".opencode/AGENTS.md" },
  { id: "kiro", name: "Kiro", src: ".kiro/steering/honey.md", dest: ".kiro/steering/honey.md" },
  { id: "agents", name: "AGENTS.md (Aider/Zed/universal)", src: "AGENTS.md", dest: "AGENTS.md" },
];

// ---- commands -------------------------------------------------------------
function list() {
  note("Honey agent matrix (cwd: " + process.cwd() + ")\n");
  note("CLI agents (global install):");
  for (const a of CLI_AGENTS) note("  [" + (a.detect() ? "x" : " ") + "] " + a.id.padEnd(16) + a.name);
  note("\nEditor rule files (use --with-init to drop into the current repo):");
  for (const a of RULE_AGENTS) note("      " + a.id.padEnd(16) + a.name + "  (" + a.dest + ")");
}

function install() {
  let any = false;
  note("Installing Honey…\n");
  for (const a of CLI_AGENTS) {
    if (!wanted(a.id)) continue;
    if (!a.detect() && onlyIds.length === 0) continue; // skip undetected on broad install
    any = true;
    note(a.name + ":");
    a.install();
  }
  if (WITH_INIT || onlyIds.length) {
    const targets = RULE_AGENTS.filter((a) => wanted(a.id));
    if (targets.length) {
      note("\nPer-repo rule files:");
      for (const a of targets) {
        any = true;
        copy(a.src, path.join(process.cwd(), a.dest));
      }
    }
  } else {
    note("\n(tip: re-run with --with-init to drop editor rule files into this repo)");
  }
  if (!any) note("\nNo matching agents detected. See --list, or use --only <id>.");
  note("\nDone." + (DRY ? " (dry-run — nothing was written)" : ""));
}

function uninstall() {
  note("Uninstalling Honey…\n");
  for (const a of CLI_AGENTS) {
    if (!wanted(a.id)) continue;
    if (!a.detect() && onlyIds.length === 0) continue;
    note(a.name + ":");
    a.uninstall();
  }
  note("\nPer-repo rule files are left in place — delete them manually if you added any.");
  note("Done." + (DRY ? " (dry-run)" : ""));
}

function help() {
  note(fs.readFileSync(__filename, "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
}

// ---- dispatch -------------------------------------------------------------
if (has("--help")) help();
else if (has("--list")) list();
else if (has("--uninstall")) uninstall();
else install();
