"use strict";
// Objective grader: write the extracted code beside the task's test, run the test,
// pass = exit 0. No network, no model — pure execution.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function grade(task, code) {
  if (!code) return { passed: false, detail: "no code block in reply" };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bench-${task.meta.id}-`));
  try {
    fs.writeFileSync(path.join(dir, task.meta.solution_file), code);
    fs.copyFileSync(task.testPath, path.join(dir, task.meta.test_file));

    const [cmd, ...args] = task.meta.test_cmd;
    const r = spawnSync(cmd, args, {
      cwd: dir,
      timeout: 20000,
      encoding: "utf8",
    });
    const passed = r.status === 0;
    const detail = passed
      ? "ok"
      : (r.stderr || r.stdout || `exit ${r.status}` || "no output")
          .trim()
          .split("\n")
          .slice(-4)
          .join("\n");
    return { passed, detail };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { grade };
