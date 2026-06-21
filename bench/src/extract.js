"use strict";
// Pull runnable source out of a model reply. Returns the code a grader will execute.

const FENCE = /```([\w+-]*)\n([\s\S]*?)```/g;

const LANG_ALIASES = {
  python: ["python", "py", "python3"],
  javascript: ["javascript", "js", "node", "mjs", "cjs"],
  html: ["html", "htm"],
};

// A usage/example block imports the solution under test rather than defining it. Chatty
// replies append one ("const x = require('./solution'); x(1,2)"); gluing it onto the real
// code breaks the import. Drop those — keep only definition blocks.
function isUsageBlock(body, lang) {
  if (lang === "python") return /^\s*(from\s+solution\s+import|import\s+solution)\b/m.test(body);
  return /\brequire\(\s*['"]\.\//.test(body) || /^\s*import\s+.*\bfrom\s+['"]\.\//m.test(body);
}

// Concatenate every fenced block whose tag matches the task language (in document order),
// minus usage/example blocks. Untagged blocks count too — terse variants often drop the
// ```python tag. If nothing matches the language and nothing is untagged, fall back to all.
function extractCode(text, lang) {
  const want = new Set(LANG_ALIASES[lang] || [lang]);
  const matched = [];
  const untagged = [];
  const all = [];
  let m;
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(text)) !== null) {
    const tag = m[1].trim().toLowerCase();
    const body = m[2];
    if (isUsageBlock(body, lang)) continue; // skip example blocks in any bucket
    all.push(body);
    if (tag === "") untagged.push(body);
    else if (want.has(tag)) matched.push(body);
  }
  const pick = matched.length ? matched : untagged.length ? untagged : all;
  return pick.join("\n\n").trim();
}

module.exports = { extractCode };
