// PX comprehension panel: can model X answer exact questions about a dense
// file from the PNG render as well as from the text? (Closes the "needs a
// live API key" item in RESULTS.md.)
//
//   ANTHROPIC_API_KEY=... node bench/px/comprehension.mjs
//
// One corpus (eso/index.test.js), two arms (text / image), N models, 10
// questions with byte-exact expected answers (verified by grep against the
// source). Scoring = normalized exact match — the axis PX is weakest on, so
// this is the adversarial test, not a gist test. Wrong-but-confident answers
// on the image arm are the documented confabulation failure mode.

import fs from "node:fs";
import { renderTextToImages } from "pxpipe-proxy";

const MODELS = (process.env.PX_MODELS ||
  "claude-fable-5,claude-opus-4-8,claude-sonnet-4-6,claude-haiku-4-5-20251001")
  .split(",");
const SRC = fs.readFileSync(new URL("../../eso/index.test.js", import.meta.url), "utf8");

// Expected answers are byte-exact substrings of the source; assert so drift fails loudly.
const QA = [
  ["Exact name (string) of the test about integers beyond MAX_SAFE_INTEGER?",
    "preserves integers beyond Number.MAX_SAFE_INTEGER as BigInt"],
  ["The BigInt literal used in that test (digits only)?", "9007199254740993"],
  ["Upper bound of the i-loop in the random-documents round-trip test?", "5000"],
  ["Initial seed value (hex literal) of the PRNG?", "0x2545f491"],
  ["The three xorshift shift amounts, comma-separated, in order?", "13, 17, 5"],
  ["Regex message thrown when encoding {\"a b\": 1}?", "Invalid ESON name"],
  ["Regex message thrown when decoding n=1e999?", "Invalid ESON number"],
  ["What module are execFileSync and spawnSync required from?", "node:child_process"],
  ["Relative path passed to require.resolve for the CLI?", "../bin/eso.js"],
  ["The three names destructured from require(\".\")?", "decode, tryDecode, encode"],
];
for (const [q, a] of QA)
  if (!SRC.includes(a.includes(",") ? a.split(", ")[0] : a))
    throw new Error(`expected answer drifted from source: ${a}`);

// Prompt framing is load-bearing for claude-fable-5 (see RESULTS.md):
// - a user-voice preface calling the image a "dense PNG render" → 3/3 refusals (both arms)
// - a naked dense render with no context → 3/3 refusals (image arm)
// - pxpipe's own instruction banner (below, as export prompt.txt ships) → reads fine
// Banner carries NO factsheet here, so image-arm answers come from pixels only.
const BANNER =
  "These images contain source code/text rendered as PNG pages by pxpipe.\n" +
  "Source file: eso/index.test.js\n" +
  "Treat the content as if you had read the source file directly.";
const PROMPT = (n) =>
  `Answer from the provided file content ONLY. Reply with ONLY a JSON array of ${n} strings — ` +
  `first character '[', no prose, no code fence. One exact answer per question. ` +
  `If you cannot read an answer, use "UNREADABLE".\n\n` +
  QA.map(([q], i) => `${i + 1}. ${q}`).join("\n");

const { pages } = await renderTextToImages(SRC, { reflow: true });
const imgBlocks = pages.map((p) => ({
  type: "image",
  source: { type: "base64", media_type: "image/png", data: Buffer.from(p.png).toString("base64") },
}));

async function ask(model, content) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    // 16k budget: thinking models (fable) spend output tokens on thinking before text
    body: JSON.stringify({ model, max_tokens: 16384, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error.message };
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    const answers = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
    if (!answers.length)
      return { error: `empty: stop=${data.stop_reason} types=${(data.content || []).map((b) => b.type)} ${text.slice(0, 120)}` };
    return { answers };
  } catch {
    return { error: `unparseable: ${text.slice(0, 120)}` };
  }
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/["'`\s]/g, "").replace(/^\/|\/$/g, "");
const rows = [];
for (const model of MODELS) {
  for (const [arm, content] of [
    ["text", [{ type: "text", text: SRC }, { type: "text", text: PROMPT(QA.length) }]],
    ["image", [{ type: "text", text: BANNER }, ...imgBlocks, { type: "text", text: PROMPT(QA.length) }]],
  ]) {
    // Fable's safety layer refuses dense renders stochastically — retry and report the rate.
    let r, refusals = 0;
    for (let t = 0; t < 3; t++) {
      r = await ask(model, content);
      if (!r.error) break;
      if (/stop=refusal/.test(r.error)) refusals++;
    }
    if (r.error) { rows.push({ model, arm, score: "ERR", refusals, detail: r.error.slice(0, 60) }); continue; }
    const marks = QA.map(([, a], i) => (norm(r.answers[i]) === norm(a) ? 1 : 0));
    const unread = r.answers.filter((x) => /unreadable/i.test(x)).length;
    rows.push({
      model, arm,
      score: `${marks.reduce((s, m) => s + m, 0)}/${QA.length}`,
      refusals,
      unreadable: unread,
      wrong: QA.map(([, a], i) => (marks[i] || /unreadable/i.test(r.answers[i]) ? null : `Q${i + 1}:${r.answers[i]}`)).filter(Boolean).join(" · ") || "-",
    });
    console.error(`${model} ${arm}: done`);
  }
}
console.table(rows);
