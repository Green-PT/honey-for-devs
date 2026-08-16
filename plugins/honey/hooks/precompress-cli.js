#!/usr/bin/env node
"use strict";
// CLI filter for the deterministic input precompressor: prose in -> compressed out.
//   echo "Hi, please could you ..." | node hooks/precompress-cli.js
//   node hooks/precompress-cli.js --stats < prompt.txt   # also print chars saved
const { compress } = require("./precompress");

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (buf += d));
process.stdin.on("end", () => {
  const { text, saved } = compress(buf);
  process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
  if (process.argv.includes("--stats")) {
    process.stderr.write(`precompress: ${buf.length} -> ${text.length} chars (-${saved})\n`);
  }
});
