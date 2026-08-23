"use strict";
// Objective grader: write the extracted code beside the task's test, run the test,
// pass = exit 0. No network, no model — pure execution.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ALLOWED = {
  node: {
    setup: (code, testContent) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-grade-"));
      fs.writeFileSync(path.join(dir, "solution.js"), code);
      fs.writeFileSync(path.join(dir, "test.js"), testContent);
      return dir;
    },
    run: (d) => spawnSync("node", ["test.js"], { cwd: d, timeout: 20000, encoding: "utf8", shell: false }),
  },
  python3: {
    setup: (code, testContent) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-grade-"));
      fs.writeFileSync(path.join(dir, "solution.py"), code);
      fs.writeFileSync(path.join(dir, "test.py"), testContent);
      return dir;
    },
    run: (d) => spawnSync("python3", ["test.py"], { cwd: d, timeout: 20000, encoding: "utf8", shell: false }),
  },
};

function grade(task, code) {
  if (!code) return { passed: false, detail: "no code block in reply" };

  const lang = ALLOWED[task.meta.test_cmd[0]];
  if (!lang) {
    return { passed: false, detail: `disallowed test command: ${task.meta.test_cmd[0]}` };
  }

  const testContent = fs.readFileSync(task.testPath);
  const dir = lang.setup(code, testContent);
  try {
    const r = lang.run(dir);
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
