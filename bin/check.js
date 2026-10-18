#!/usr/bin/env node
"use strict";
// honey-check — deterministic, no-model checks for the files agents re-read every session.
//   honey-check memory [FILE...]          lint memory/rules files (default: this repo's + its Claude Code auto memory)
//   honey-check fidelity ORIGINAL NEW     did a compressed rewrite keep every fact and get smaller?
// Exit 0 = clean, 1 = findings, 2 = usage error. Ideas from Caveman's memory doctor and
// fidelity scorer (github.com/JuliusBrussee/caveman), reimplemented for Honey.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Claude Code docs (code.claude.com/docs/en/memory): only the first 200 lines or 25KB of
// MEMORY.md load at session start, whichever comes first.
const MEMORY_LINES = 200;
const MEMORY_BYTES = 25 * 1024;
const DUP_MIN_WORDS = 6;
const RULE_FILES = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "GEMINI.md", "PROJECT.md"];
const TEXT_EXT = /\.(md|mdc|txt|json|ya?ml|toml|js|ts|tsx|jsx|py|sh|go|rs|rb|java|css|html|sql)$/i;
const REMOVAL = /\b(removed|deleted|renamed|moved|dropped|retired|no longer)\b/i;

// Lines inside fenced code blocks are examples, not instructions.
function proseLines(text) {
  let fenced = false;
  return text.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return null; }
    return fenced ? null : line;
  });
}

const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
const normalize = (l) => l.replace(/^[\s>*+-]+|^\s*\d+\.\s+/g, "").replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[.,;:!]+$/, "");

function memoryIssues(files, root) {
  const issues = [];
  const add = (file, line, kind, msg) => issues.push({ file, line, kind, msg });
  const seen = new Map(); // normalized rule -> [file:line]

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const lines = proseLines(text);
    const dir = path.dirname(file);

    if (path.basename(file) === "MEMORY.md") {
      let bytes = 0;
      const all = text.split("\n");
      const cut = all.findIndex((l, i) => (bytes += Buffer.byteLength(l) + 1) > MEMORY_BYTES || i >= MEMORY_LINES);
      if (cut >= 0) add(file, cut + 1, "truncated", `only the first ${MEMORY_LINES} lines / 25KB load; lines ${cut + 1}-${all.length} are never seen`);
      // index links → missing files, and memory files the index never links
      const linked = new Set();
      all.forEach((l, i) => {
        for (const [, target] of l.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
          if (target.includes("://") || target.startsWith("mailto:")) continue;
          linked.add(path.resolve(dir, target));
          if (!exists(path.resolve(dir, target))) add(file, i + 1, "dead-link", `index links to missing ${target}`);
        }
      });
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".md") && f !== "MEMORY.md" && !linked.has(path.resolve(dir, f))) add(path.join(dir, f), 1, "orphan", "memory file the index never links");
      }
    }

    lines.forEach((line, i) => {
      if (line === null) return;
      const bare = line.replace(/`[^`]*`/g, " ");
      // @imports that resolve to nothing
      for (const [, raw] of bare.matchAll(/(?:^|\s)@([^\s]+)/g)) {
        const tok = raw.replace(/[.,;:!?)"']+$/, "");
        if (tok.includes("@") || tok.includes("://") || tok.startsWith("//")) continue;
        if (!/^(\.\.?\/|~\/|\/)/.test(tok) && !TEXT_EXT.test(tok)) continue;
        const p = tok.startsWith("~/") ? path.join(os.homedir(), tok.slice(2)) : path.resolve(dir, tok);
        if (!exists(p)) add(file, i + 1, "broken-import", `@${tok} points at nothing`);
      }
      // backticked repo paths that no longer exist (anchored: top-level entry must exist)
      if (root && !REMOVAL.test(bare)) {
        for (const [, ref0] of line.matchAll(/`([^`\s]+)`/g)) {
          const ref = ref0.replace(/^\.\//, "").replace(/:\d+(-\d+)?$/, "");
          if (!ref.includes("/") || /[<>{}*$]|:\/\/|\.\./.test(ref) || /^[.~/-]/.test(ref)) continue;
          if (!ref.endsWith("/") && !TEXT_EXT.test(ref)) continue;
          if (exists(path.join(root, ref.split("/")[0])) && !exists(path.join(root, ref))) add(file, i + 1, "stale-path", `\`${ref}\` no longer exists`);
        }
      }
      // the same rule loaded from two files costs tokens every turn
      const norm = normalize(line);
      if (!line.trim().startsWith("#") && norm.split(" ").length >= DUP_MIN_WORDS) {
        const locs = seen.get(norm) || [];
        if (!locs.some((l) => l.file === file)) locs.push({ file, line: i + 1 });
        seen.set(norm, locs);
      }
    });
  }
  for (const locs of seen.values()) {
    if (locs.length > 1) for (const l of locs.slice(1)) add(l.file, l.line, "duplicate", `same rule as ${locs[0].file}:${locs[0].line}`);
  }
  return issues;
}

function defaultMemoryFiles(cwd) {
  let root = cwd;
  try { root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
  const files = RULE_FILES.map((f) => path.join(root, f)).filter(exists);
  const rulesDir = path.join(root, ".claude", "rules");
  if (exists(rulesDir)) files.push(...fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md")).map((f) => path.join(rulesDir, f)));
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const memory = path.join(configDir, "projects", root.replace(/[^a-zA-Z0-9]/g, "-"), "memory", "MEMORY.md");
  if (exists(memory)) files.push(memory);
  return { root, files };
}

// --- fidelity: every exact fact in ORIGINAL must survive in NEW -----------------------
const NEGATION = /\b(not|no|never|none|nothing|without|cannot|\w+n['’]t)\b/gi;
const SAFETY = /\b(must|never|always|only|required?|warning|danger|irreversible|secrets?|passwords?|tokens?|credentials?|delete|drop|migrations?|production|auth\w*)\b/gi;
const EXACT = [
  ["code block", /```[\s\S]*?```|~~~[\s\S]*?~~~/g],
  ["inline code", /`[^`\n]+`/g],
  ["URL", /https?:\/\/[^\s)>\]]+/g],
  ["number", /\d+(?:[.,:_]\d+)*%?/g],
];
const count = (text, re) => (text.match(re) || []).length;

function fidelity(original, rewritten) {
  const problems = [];
  for (const [kind, re] of EXACT) {
    for (const item of new Set(original.match(re) || [])) {
      if (!rewritten.includes(item)) problems.push(`${kind} lost: ${item.length > 80 ? item.slice(0, 77) + "..." : item}`);
    }
  }
  for (const [kind, re] of [["negation", NEGATION], ["safety word", SAFETY]]) {
    const before = count(original, re), after = count(rewritten, re);
    if (after < before) problems.push(`${kind}s dropped from ${before} to ${after} — check no rule flipped or vanished`);
  }
  const a = Buffer.byteLength(original), b = Buffer.byteLength(rewritten);
  if (b >= a) problems.push(`not smaller: ${a} → ${b} bytes — restore the original`);
  return { problems, before: a, after: b };
}

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === "memory") {
    const { root, files } = args.length ? { root: process.cwd(), files: args } : defaultMemoryFiles(process.cwd());
    if (!files.length) { console.log("honey-check: no memory files found"); return 0; }
    const issues = memoryIssues(files, root);
    for (const x of issues) console.log(`${x.file}:${x.line}  ${x.kind}  ${x.msg}`);
    console.log(issues.length ? `honey-check: ${issues.length} finding(s) in ${files.length} file(s)` : `honey-check: ${files.length} file(s) clean`);
    return issues.length ? 1 : 0;
  }
  if (cmd === "fidelity" && args.length === 2) {
    const { problems, before, after } = fidelity(fs.readFileSync(args[0], "utf8"), fs.readFileSync(args[1], "utf8"));
    for (const p of problems) console.log(`- ${p}`);
    console.log(problems.length ? `honey-check: FAIL (${problems.length})` : `honey-check: OK, ${before} → ${after} bytes (−${Math.round((1 - after / before) * 100)}%)`);
    return problems.length ? 1 : 0;
  }
  console.error("usage: honey-check memory [FILE...] | honey-check fidelity ORIGINAL NEW");
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { memoryIssues, fidelity, MEMORY_LINES, MEMORY_BYTES };
