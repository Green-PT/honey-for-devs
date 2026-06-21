"use strict";
// Agent-to-agent (Lever 3) round-trip. The variant encodes a handoff for another agent; a
// neutral receiver agent then answers questions using ONLY that handoff. Lossless dense
// formats (TOON / compact JSON) score full accuracy at fewer tokens; a too-clever format
// that the receiver misparses loses accuracy — exactly the silent-misparse risk Lever 3 warns of.

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");
const isNum = (s) => s !== "" && s != null && !isNaN(Number(s));

function receiverPrompt(handoff, queries) {
  return (
    "You are an agent that received a handoff message from another agent. Using ONLY the " +
    "message below, answer the questions. Reply with ONLY a JSON array of answers as strings, " +
    "in order — no other text.\n\nMESSAGE:\n" +
    handoff +
    "\n\nQUESTIONS:\n" +
    queries.map((q, i) => `${i + 1}. ${q.q}`).join("\n")
  );
}

function parseAnswers(text, n) {
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const a = JSON.parse(m[0]);
      if (Array.isArray(a)) return a.map((x) => String(x));
    } catch {}
  }
  // fallback: one answer per line, strip leading numbering
  return text
    .trim()
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[).\s:-]*/, "").trim())
    .slice(0, n);
}

function scoreRelay(answers, queries) {
  let correct = 0;
  const miss = [];
  queries.forEach((q, i) => {
    const got = answers[i] != null ? answers[i] : "";
    const ok = norm(got) === norm(q.a) || (isNum(got) && isNum(q.a) && Number(got) === Number(q.a));
    if (ok) correct++;
    else miss.push(`q${i + 1}: got "${got}" want "${q.a}"`);
  });
  return {
    accuracy: queries.length ? correct / queries.length : 0,
    passed: correct === queries.length,
    detail: miss.length ? miss.join("; ") : "ok",
  };
}

module.exports = { receiverPrompt, parseAnswers, scoreRelay };
