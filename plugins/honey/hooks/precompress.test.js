"use strict";
// Deterministic safety + behaviour tests for the input precompressor. No API.
//   node hooks/precompress.test.js
const assert = require("assert");
const { compress, _PROTECT } = require("./precompress");

let n = 0;
const ok = (name, cond) => {
  n++;
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  }
};

// --- protected-content survival (the core safety claim) ----------------------
const cases = [
  "Hi! Please could you fix the bug in `parseQuery()` — thanks in advance!",
  "Run `pytest tests/ -q` and check src/app/main.py at line 42.",
  "See https://example.com/docs?x=1&y=2 for the very detailed spec.",
  "```python\ndef f(x):\n    return x + 1\n```\nPlease just make it faster.",
  'Set the flag "max_retries" to 5 and basically simplify the loop.',
  "Numbers must survive: 3.14159, 0xFF, 1_000_000, version 2.6.0.",
];

for (const c of cases) {
  const { text } = compress(c);
  // every fenced/inline/url/path/quoted span present verbatim
  for (const re of _PROTECT) {
    for (const span of c.match(re) || []) {
      ok(`span survives: ${JSON.stringify(span)}`, text.includes(span));
    }
  }
  // every digit run survives
  for (const d of c.match(/\d+/g) || []) {
    ok(`digits survive ${d} in ${JSON.stringify(c)}`, text.includes(d));
  }
  // idempotent
  ok("idempotent", compress(text).text === text);
}

// --- it actually removes filler ---------------------------------------------
ok("drops greeting", !/^Hi/.test(compress("Hi! Fix the bug.").text));
ok("drops please", !/please/i.test(compress("Please fix it.").text));
ok("drops thanks-in-advance", !/thanks in advance/i.test(compress("Fix it. Thanks in advance!").text));
ok("collapses whitespace", !/  /.test(compress("a      b").text));
ok("dedupes lines", compress("do x\ndo x\ndo x").text === "do x");
ok(
  "collapses blank runs",
  compress("a\n\n\n\n\nb").text === "a\n\nb"
);

// --- it must NOT mangle a clean technical prompt -----------------------------
const clean = "Implement `flatten(xs)` that flattens nested lists. Strings count as leaves.";
ok("clean prompt nearly untouched", compress(clean).text.includes("flatten(xs)") && compress(clean).text.includes("leaves"));

console.log(`precompress: ${n} checks, ${process.exitCode ? "FAILED" : "all passed"}`);
