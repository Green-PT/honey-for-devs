#!/usr/bin/env node
// SubagentStart hook: dispatched subagents run in isolated context and never
// inherit the session's Honey directive — they'd emit full-fat code and verbose
// reports, multiplied per dispatch. If Honey is active, inject the levers into
// every subagent at spawn. Reviewers get a prose-only variant: compress the
// report, never the verdict.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const WORKER =
  "Apply Honey: write the minimum code that needs to exist — YAGNI, stdlib/native " +
  "before custom; no speculative params, branches, or single-caller abstractions. " +
  "Never cut validation, error handling, auth, or anything the task asked for. " +
  "Keep code, identifiers, paths, and the brief's exact spec values verbatim. " +
  "Report terse: status, one-line test summary, concerns. No narration.";

const REVIEWER =
  "Report findings tersely: id · severity · file:line · one-line fix. Don't narrate " +
  "or restate the diff. Honey governs your prose only — never your verdict or " +
  "severity. Flag everything you normally would; do not suppress or downgrade a " +
  "finding to save words.";

function directiveFor(agentType) {
  return /review|audit|critic|judge/i.test(agentType || "") ? REVIEWER : WORKER;
}

function activeMode() {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  try {
    const mode = fs.readFileSync(path.join(dir, ".honey-active"), "utf8").trim();
    return mode && mode !== "off" ? mode : null;
  } catch {
    return null;
  }
}

module.exports = { WORKER, REVIEWER, directiveFor, activeMode };

if (require.main === module) {
  if (!activeMode()) process.exit(0);
  let input = "";
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => {
    let agentType = "";
    try {
      agentType = JSON.parse(input).agent_type || "";
    } catch {}
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SubagentStart",
          additionalContext: directiveFor(agentType),
        },
      })
    );
  });
}
