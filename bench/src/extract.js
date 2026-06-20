"use strict";
// Pull runnable source out of a model reply. Returns the code a grader will execute.

const FENCE = /```([\w+-]*)\n([\s\S]*?)```/g;

const LANG_ALIASES = {
  python: ["python", "py", "python3"],
  javascript: ["javascript", "js", "node", "mjs", "cjs"],
  html: ["html", "htm"],
};

// Concatenate every fenced block whose tag matches the task language (in document
// order). Untagged blocks count too — terse variants often drop the ```python tag.
// If nothing matches the language and nothing is untagged, fall back to all blocks.
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
    all.push(body);
    if (tag === "") untagged.push(body);
    else if (want.has(tag)) matched.push(body);
  }
  const pick = matched.length ? matched : untagged.length ? untagged : all;
  return pick.join("\n\n").trim();
}

module.exports = { extractCode };
