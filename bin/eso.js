#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { decode, encode } = require("../eso");
const { crush } = require("../eso/ccr");

// CCR cache: one <hash>.json per crushed array. Override dir with HONEY_CCR_DIR.
// Default is a fixed absolute dir so retrieve finds what crush wrote regardless
// of the caller's cwd (a relative default loses the originals across dirs).
const ccrDir = () => process.env.HONEY_CCR_DIR || path.join(os.tmpdir(), "honey-ccr");

// Emit BigInt as a bare JSON number literal: stock JSON.stringify throws on
// BigInt, and a quoted string would change the type.
const toJSON = (v) =>
  typeof v === "bigint" ? `${v}` :
  Array.isArray(v) ? `[${v.map(toJSON).join(",")}]` :
  v && typeof v === "object"
    ? `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}:${toJSON(x)}`).join(",")}}`
    : JSON.stringify(v);

try {
  const cmd = process.argv[2];
  if (cmd === "encode") {
    process.stdout.write(encode(JSON.parse(fs.readFileSync(0, "utf8"))));
  } else if (cmd === "decode") {
    process.stdout.write(toJSON(decode(fs.readFileSync(0, "utf8"))) + "\n");
  } else if (cmd === "crush") {
    const array = JSON.parse(fs.readFileSync(0, "utf8"));
    const { view, hash } = crush(array);
    if (hash) {
      const dir = ccrDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${hash}.json`), JSON.stringify(array));
    }
    process.stdout.write(JSON.stringify(view) + "\n");
  } else if (cmd === "stash") {
    // Offload an arbitrary text block (a file body, bulky tool output) and print a handle.
    // The model references the handle instead of re-pasting; `eso retrieve <hash>` restores
    // it verbatim. Lossless — unlike `crush`, nothing is dropped, the bytes just move out of
    // context until needed.
    const text = fs.readFileSync(0, "utf8");
    const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
    const dir = ccrDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${hash}.json`), text);
    process.stdout.write(`<<honey:${hash} ${Buffer.byteLength(text)}_bytes_stashed>>\n`);
  } else if (cmd === "retrieve") {
    const hash = process.argv[3];
    if (!hash) throw new Error("Usage: eso retrieve <hash>");
    if (!/^[0-9a-f]{16}$/.test(hash)) throw new Error(`Invalid hash: ${hash}`);
    const file = path.join(ccrDir(), `${hash}.json`);
    if (!fs.existsSync(file)) throw new Error(`No stash for ${hash} (fail open: use the original)`);
    process.stdout.write(fs.readFileSync(file, "utf8"));
  } else {
    throw new Error("Usage: eso <encode|decode|crush|stash|retrieve>");
  }
} catch (error) {
  console.error(`eso: ${error.message}`);
  process.exitCode = 1;
}
