"use strict";
// Deterministic input-prompt compressor — NO model. Strips filler, redundant
// whitespace, and duplicate lines from PROSE only. Protected spans (fenced code,
// inline code, URLs, paths, quoted strings) pass through verbatim.
//
// Safety contract (enforced by hooks/precompress.test.js property checks):
//   - every protected span in the input survives byte-for-byte in the output
//   - every digit run and every long identifier in the input survives
//   - idempotent: compress(compress(x)) === compress(x)
//
// Usage:  const { compress } = require("./precompress");
//         const { text, saved } = compress(prompt);

// --- protected spans: masked before prose edits, restored after --------------
const PROTECT = [
  /```[\s\S]*?```/g, // fenced code blocks
  /~~~[\s\S]*?~~~/g, // fenced code blocks (tilde)
  /`[^`\n]+`/g, // inline code
  /<https?:\/\/[^>\s]+>|https?:\/\/\S+/gi, // URLs
  /\b[\w.-]*\/[\w./-]+/g, // paths (anything containing a slash)
  /\b[\w-]+\.(?:js|ts|tsx|jsx|py|json|md|html|css|sh|ya?ml|toml|go|rs|java|rb|sql|txt|csv)\b/gi, // filenames
  /"[^"\n]{0,200}"/g, // double-quoted strings (single-quote skipped: apostrophe-ambiguous)
];

// Sentinel uses a private-use codepoint so prose edits (whitespace collapse,
// word-boundaried filler removal) never touch a placeholder.
const S = "";

function mask(text) {
  const spans = [];
  let out = text;
  for (const re of PROTECT) {
    out = out.replace(re, (m) => {
      const token = S + spans.length + S;
      spans.push(m);
      return token;
    });
  }
  return { out, spans };
}

function unmask(text, spans) {
  // restore in reverse so nested placeholders resolve correctly
  let out = text;
  for (let i = spans.length - 1; i >= 0; i--) {
    out = out.split(S + i + S).join(spans[i]);
  }
  return out;
}

// --- prose filler: whole-word/phrase removal, case-insensitive ---------------
// Conservative. Each entry must be safe to drop without changing the task.
const FILLER_PHRASES = [
  // gratitude / closings
  "thanks in advance",
  "thanks a million",
  "thanks a lot",
  "thank you so much",
  "thank you very much",
  "thanks so much",
  "i really appreciate it",
  "i really really appreciate it",
  "i'd really appreciate it",
  "i would really appreciate it",
  "really appreciate it",
  "i appreciate it",
  // openers / pleasantries
  "sorry to bother you",
  "hope you're doing well",
  "hope you are doing well",
  "i hope you're doing well",
  "i was wondering if you could (?:help me out with something|maybe)?",
  "i was wondering if you might",
  "i was just wondering",
  "if you don't mind",
  "if it's not too much trouble",
  "when you get a chance",
  "i'd really appreciate it if you could",
  "i would really appreciate it if you could",
  "i'd appreciate it if you could",
  "as i mentioned(?: (?:earlier|before|above))?",
  "as i said(?: to [^,.]{1,30})?(?: (?:earlier|before|again))?",
  "as you (?:probably )?(?:already )?know",
  "needless to say",
  "for what it's worth",
  "at the end of the day",
  // restatement preambles (the clause after them is usually a repeat)
  "just to be clear",
  "just to be safe(?: let me restate(?: the examples)?)?",
  "just to repeat(?: because it's important)?",
  "to be clear",
  "i know i'm repeating myself",
  "i'll say it once more(?: because it bit me last time)?",
  "and i know i'm repeating myself",
  "again, just to be clear",
  // low-content openers / closings / pleasantries
  "quick favor if you don't mind",
  "quick one for you if that's cool",
  "if that's cool",
  "sorry if this is a dumb question",
  "sorry to be a pain",
  "hope you're having an awesome day",
  "hope your week is going well",
  "hope your day is going well",
  "you're a lifesaver",
  "you're the best",
  "you rock",
  "thanks a ton",
  "thanks a bunch",
  "thanks a lot",
  "much appreciated",
  "super grateful",
  "and that's it",
  "that's the whole thing",
  "that's it",
  // request wrappers (leave the imperative that follows)
  "could you (?:please )?(?:maybe )?",
  "can you (?:please )?",
  "would you (?:please )?(?:maybe )?",
  "will you (?:please )?",
  "i'd like you to",
  "i would like you to",
  "i want you to",
  "whether you could (?:maybe )?",
  "if you could (?:maybe )?",
  "please please",
  // low-content hedges
  "a little bit of",
  "a bit of",
  "a little bit",
  "a little",
  "a bit",
  "for your help",
  "kind of",
  "sort of",
  "take a look",
];
const FILLER_WORDS = [
  "please",
  "kindly",
  "basically",
  "actually",
  "literally",
  "honestly",
  "essentially",
  "simply",
  "really",
  "very",
  "quite",
  "maybe",
];

function compressProse(s) {
  let t = s;
  // 1. multi-word filler phrases
  for (const p of FILLER_PHRASES) {
    t = t.replace(new RegExp(`\\b${p}\\b[,:]?\\s*`, "gi"), "");
  }
  // 2. filler words (word-boundaried)
  for (const w of FILLER_WORDS) {
    t = t.replace(new RegExp(`\\b${w}\\b\\s*`, "gi"), "");
  }
  // 2b. drop emoticons
  t = t.replace(/[:;]-?[)D(P]\B/g, "");
  // 3. tidy punctuation orphaned by phrase/word removal
  t = t.replace(/[^\S\n]+([,.;:!?])/g, "$1"); // " ," -> ","
  t = t.replace(/([,.;:!?])[^\S\n]*([,.;:!?])/g, "$2"); // ", ." -> "."  ",," -> ","
  t = t.replace(/(^|\n|[.!?][^\S\n])[^\S\n]*[,;:]+[^\S\n]*/g, "$1"); // sentence-leading stray comma
  // 4. collapse intra-line whitespace runs
  t = t.replace(/[^\S\n]{2,}/g, " ");
  // 4. trim trailing whitespace per line
  t = t.replace(/[^\S\n]+$/gm, "");
  // 5. collapse 3+ newlines to a paragraph break
  t = t.replace(/\n{3,}/g, "\n\n");
  // 6. drop leading greeting ("Hi, " / "Hello! ")
  t = t.replace(/^[ \t]*(hi|hey|hello)\b[,!. ]*/gim, "");
  return t;
}

// --- dedupe identical non-empty lines, keeping first occurrence --------------
function dedupeLines(text) {
  const seen = new Set();
  return text
    .split("\n")
    .filter((line) => {
      const key = line.trim();
      if (!key) return true; // keep blank lines (structure)
      if (key.includes(S)) return true; // never dedupe a line holding a placeholder
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

// --- dedupe identical sentences within a line (catches inline repeats) -------
function dedupeSentences(text) {
  return text
    .split("\n")
    .map((line) => {
      const parts = line.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
      if (!parts || parts.length < 2) return line;
      const seen = new Set();
      return parts
        .filter((p) => {
          const key = p.trim().toLowerCase();
          if (!key) return true;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .join("")
        .replace(/[^\S\n]{2,}/g, " ");
    })
    .join("\n");
}

function compress(input) {
  if (typeof input !== "string" || !input) return { text: input || "", saved: 0 };
  // fail open: if the input already contains our placeholder sentinel, masking would
  // collide and corrupt it — leave the input untouched rather than risk a bad edit.
  if (input.includes(S)) return { text: input, saved: 0 };
  const { out, spans } = mask(input);
  let t = compressProse(out);
  t = dedupeSentences(t);
  t = dedupeLines(t);
  t = unmask(t, spans).trim();
  return { text: t, saved: input.length - t.length };
}

module.exports = { compress, mask, unmask, _PROTECT: PROTECT };
