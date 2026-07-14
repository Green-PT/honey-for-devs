#!/usr/bin/env node
// Unified Honey installer. Detects installed coding agents and runs each one's
// native install pathway: plugin-marketplace / extension commands for CLI agents,
// and generated rule-file copies for editor agents (with --with-init).
//
// Run in a terminal with no flags, it launches an interactive wizard that asks
// which agents to set up, whether to wire the CO₂ statusline badge, whether to
// drop per-repo rule files, and the default Honey mode. Non-TTY runs (CI / pipes)
// and any explicit flag fall back to the auto-detect install below.
//
// Flags (mirror the reference installers):
//   --all          full install: detected CLI agents + statusline (default)
//   --minimal      CLI/plugin installs only; skip the statusline wiring
//   --only <id>    restrict to one agent id (repeatable)
//   --with-init    also drop per-repo rule files into the current directory
//   --yes, -y      skip the wizard; run the non-interactive auto-detect install
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
const { NAMES: OPENCLAW_SKILLS } = require("../scripts/build-openclaw-skills");
const SLUG = "Green-PT/honey-for-devs";
const URL = "https://github.com/" + SLUG;
const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude");

// ---- argv -----------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
// These are `let` so the wizard can rewrite them before delegating to install().
let onlyIds = argv.reduce((acc, a, i) => {
  if (a === "--only" && argv[i + 1]) acc.push(argv[i + 1].toLowerCase());
  return acc;
}, []);
const DRY = has("--dry-run");
let MINIMAL = has("--minimal");
let WITH_INIT = has("--with-init");
const YES = has("--yes") || has("-y");
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
// OpenCode auto-loads root AGENTS.md / global / opencode.json `instructions` —
// NOT a nested .opencode/AGENTS.md. Register the copied file so it's actually read.
function registerOpencode(cwd, rel) {
  const cfg = path.join(cwd, "opencode.json");
  if (DRY) return note("  [dry-run] register " + rel + " in " + cfg);
  let json = { $schema: "https://opencode.ai/config.json" };
  if (fs.existsSync(cfg)) {
    try {
      json = JSON.parse(fs.readFileSync(cfg, "utf8"));
    } catch {
      note('  ! opencode.json is not valid JSON — add "instructions": ["' + rel + '"] yourself.');
      return;
    }
  }
  const instr = Array.isArray(json.instructions) ? json.instructions : [];
  if (!instr.includes(rel)) instr.push(rel);
  json.instructions = instr;
  fs.writeFileSync(cfg, JSON.stringify(json, null, 2) + "\n");
  note("  registered " + rel + " in " + cfg);
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
  {
    id: "openclaw",
    name: "OpenClaw",
    detect: () => which("clawhub") || which("openclaw") || dirExists(path.join(HOME, ".openclaw")),
    // Native OpenClaw skills via ClawHub. The core skill plus each companion
    // (-review, -design, -gain, …) install separately, mirroring `honey@greenpt`.
    install: () => {
      for (const s of OPENCLAW_SKILLS) run("clawhub install " + s);
      note("  applied on coding tasks; also exposes /honey");
    },
    uninstall: () => OPENCLAW_SKILLS.forEach((s) => run("clawhub uninstall " + s)),
  },
];

// Editor agents are configured by dropping a generated rule file into a repo.
const RULE_AGENTS = [
  { id: "cursor", name: "Cursor", src: ".cursor/rules/honey.mdc", dest: ".cursor/rules/honey.mdc" },
  { id: "windsurf", name: "Windsurf", src: ".windsurf/rules/honey.md", dest: ".windsurf/rules/honey.md" },
  { id: "cline", name: "Cline", src: ".clinerules/honey.md", dest: ".clinerules/honey.md" },
  { id: "copilot-editor", name: "Copilot (editor)", src: ".github/copilot-instructions.md", dest: ".github/copilot-instructions.md" },
  { id: "opencode", name: "OpenCode", src: ".opencode/AGENTS.md", dest: ".opencode/AGENTS.md", post: (cwd, dest) => registerOpencode(cwd, dest) },
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
        if (a.post) a.post(process.cwd(), a.dest);
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

// ---- interactive wizard ---------------------------------------------------
const readline = require("readline");

// A readable stream we can prompt on: the real TTY even when stdin is a pipe
// (curl|bash feeds the script through stdin, so /dev/tty is the user's keyboard).
function openTty() {
  if (process.stdin.isTTY) return { stream: process.stdin, close: () => {} };
  if (process.platform !== "win32") {
    try {
      const fd = fs.openSync("/dev/tty", "r");
      const stream = fs.createReadStream(null, { fd });
      return { stream, close: () => { try { fs.closeSync(fd); } catch {} } };
    } catch {}
  }
  return null;
}
function ttyAvailable() {
  if (process.stdin.isTTY) return true;
  if (process.platform === "win32") return false;
  try { fs.closeSync(fs.openSync("/dev/tty", "r")); return true; } catch { return false; }
}

const ask = (rl, q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));
async function askYesNo(rl, q, def) {
  const a = (await ask(rl, q + (def ? " [Y/n] " : " [y/N] "))).toLowerCase();
  if (!a) return def;
  return a[0] === "y";
}

async function wizard() {
  const tty = openTty();
  const rl = readline.createInterface({ input: tty.stream, output: process.stdout });
  rl.on("SIGINT", () => { rl.close(); tty.close(); note("\nAborted."); process.exit(130); });

  note("🍯 Honey installer\n");
  const agents = [...CLI_AGENTS.map((a) => ({ ...a, kind: "cli" })),
                  ...RULE_AGENTS.map((a) => ({ ...a, kind: "rule" }))];
  const detected = new Set(CLI_AGENTS.filter((a) => a.detect()).map((a) => a.id));
  note("Which coding agents do you use? (detected ones are pre-selected)\n");
  agents.forEach((a, i) => {
    const mark = detected.has(a.id) ? "x" : " ";
    const tag = a.kind === "cli" ? "" : "  (per-repo rule file)";
    note("  " + String(i + 1).padStart(2) + ") [" + mark + "] " + a.name + tag);
  });
  note("\nEnter numbers (e.g. 1,3,5), or `all` / `detected` / blank = detected.");

  let chosen = [];
  for (let tries = 0; tries < 2; tries++) {
    const raw = (await ask(rl, "> ")).toLowerCase();
    if (raw === "all") chosen = agents.map((a) => a.id);
    else if (raw === "" || raw === "detected") chosen = [...detected];
    else {
      chosen = raw.split(",").map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => n >= 0 && n < agents.length).map((n) => agents[n].id);
    }
    if (chosen.length) break;
    note("No agents selected — pick at least one.");
  }
  if (!chosen.length) { rl.close(); tty.close(); note("Nothing selected. Exiting."); return; }

  const chosenSet = new Set(chosen);
  const claude = chosenSet.has("claude");
  const editorPicked = RULE_AGENTS.some((a) => chosenSet.has(a.id));

  let statusline = false;
  if (claude) statusline = await askYesNo(rl, "\nWire the 🍯 CO₂ statusline badge into Claude Code?", true);

  let withInit = false;
  if (editorPicked)
    withInit = await askYesNo(rl, "\nDrop editor rule files into this repo (" + process.cwd() + ")?", false);

  let mode = (await ask(rl, "\nDefault Honey mode — lite / full / ultra [full]: ")).toLowerCase();
  if (!["lite", "full", "ultra"].includes(mode)) mode = "full";

  rl.close();
  tty.close();

  // Feed the answers into the existing install() path. Editor agents only ever
  // produce rule files, so they belong in onlyIds *only* when the user opted into
  // dropping them — otherwise install() would copy them off the bare selection.
  const cliIds = new Set(CLI_AGENTS.map((a) => a.id));
  const cliChosen = chosen.filter((id) => cliIds.has(id));
  WITH_INIT = withInit && editorPicked;
  onlyIds = WITH_INIT ? chosen : cliChosen;
  MINIMAL = !statusline;
  if (!onlyIds.length && !WITH_INIT) { note("\nNothing to install."); return; }
  note("");
  install();
  note("\nDefault mode: " + mode);
  run('node "' + path.join(REPO, "hooks", "honey-state.js") + '" set ' + mode);
}

// ---- dispatch -------------------------------------------------------------
const explicit = onlyIds.length || has("--all") || MINIMAL || WITH_INIT || YES;
if (has("--help")) help();
else if (has("--list")) list();
else if (has("--uninstall")) uninstall();
else if (!explicit && ttyAvailable()) wizard();
else install();
