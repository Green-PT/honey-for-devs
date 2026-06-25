// Generate a padded corpus from the bench's REAL task prompts. Each task's prompt.md
// already carries the exact signature/export contract its unit test needs (so it grades
// green), and we wrap it in verbose filler. Compression should strip the filler and leave
// the contract intact — so test-pass full vs compressed isolates compression damage, not a
// missing contract. Writes bench/input/corpus-padded.json.
//   node bench/input/gen-padded.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, "..", "tasks");
const IDS = ["median-bugfix", "slugify", "csv-column-sum", "flatten", "deep-merge", "format-bytes", "retry-backoff", "chunk", "parse-query", "interval-merge"];

// deterministic filler wrappers, varied by index so the corpus isn't 10 identical paddings
const PRE = [
  "Hi there! Hope you're doing well. I was wondering if you could please help me out with something. ",
  "Hey! Sorry to bother you. Could you please please help me with a quick thing? ",
  "Hello! I'd really appreciate it if you could help me out here. So basically, ",
  "Hi! Quick favor if you don't mind. Honestly I've been stuck on this for a while. ",
  "Heyyy! Hope your week is going well. :) Pretty please could you help me with this one? ",
];
const POST = [
  "\n\nThanks so much in advance, I really really appreciate it!",
  "\n\nAgain, I'd really appreciate it if you could help with this. Thanks a million, you're a lifesaver!",
  "\n\nJust to be clear, that's the whole ask. Thank you so so much, you rock!",
  "\n\nSorry if this is a dumb question. Thanks a ton, much appreciated!",
  "\n\nThat's it, that's the whole thing. Thanks a bunch in advance!",
];

const corpus = IDS.map((id, i) => {
  const md = readFileSync(join(TASKS, id, "prompt.md"), "utf8").trim();
  // also inject a redundant restatement of the first line (compressor should dedupe it)
  const firstLine = md.split("\n")[0];
  const prompt = PRE[i % PRE.length] + md + "\n\n" + firstLine + POST[i % POST.length];
  return { id: `padded-${id}`, task: id, prompt };
});

writeFileSync(join(HERE, "corpus-padded.json"), JSON.stringify(corpus, null, 2) + "\n");
console.log(`wrote corpus-padded.json: ${corpus.length} tasks (real prompt.md + verbose wrapper)`);
