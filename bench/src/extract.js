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

// Top-level symbols a block defines. Used to detect when a single block is the complete
// final answer vs. when blocks genuinely split a helper from the main function.
function defs(body, lang) {
  const pats =
    lang === "python"
      ? [/^(?:async\s+)?def\s+([A-Za-z_]\w*)/gm, /^class\s+([A-Za-z_]\w*)/gm]
      : [
          /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
          /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
          /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
        ];
  const names = new Set();
  for (const p of pats) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(body)) !== null) names.add(m[1]);
  }
  return names;
}

// Pick the code a grader will execute. Collect fenced blocks matching the task language
// (untagged count too — terse variants drop the tag), minus usage/example blocks.
//
// If one block already defines every top-level symbol seen across the blocks, that block IS
// the complete answer — use it ALONE (the LAST such block = the final version). This stops a
// chatty reply that shows the solution plus an alternative/buggy variant from getting both
// glued together and failing — an artifact that penalized verbosity, not correctness. Only
// when no single block is complete (a real helper+main split) do we concatenate.
function extractInfo(text, lang) {
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
  if (!pick.length) return { code: "", nblocks: 0 };

  const union = new Set();
  const blockDefs = pick.map((b) => {
    const d = defs(b, lang);
    for (const n of d) union.add(n);
    return d;
  });
  let code;
  if (union.size) {
    let chosen = -1;
    for (let i = 0; i < pick.length; i++)
      if ([...union].every((n) => blockDefs[i].has(n))) chosen = i; // last complete block wins
    code = chosen >= 0 ? pick[chosen] : pick.join("\n\n");
  } else {
    code = pick.join("\n\n");
  }
  return { code: code.trim(), nblocks: pick.length };
}

function extractCode(text, lang) {
  return extractInfo(text, lang).code;
}

module.exports = { extractCode, extractInfo };
