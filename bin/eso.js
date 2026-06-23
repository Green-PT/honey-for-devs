#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { decode, encode } = require("../eso");
const { crush } = require("../eso/ccr");

// CCR cache: one <hash>.json per crushed array. Override dir with HONEY_CCR_DIR.
// Default is a fixed absolute dir so retrieve finds what crush wrote regardless
// of the caller's cwd (a relative default loses the originals across dirs).
const ccrDir = () => process.env.HONEY_CCR_DIR || path.join(os.tmpdir(), "honey-ccr");

try {
  const cmd = process.argv[2];
  if (cmd === "encode") {
    process.stdout.write(encode(JSON.parse(fs.readFileSync(0, "utf8"))));
  } else if (cmd === "decode") {
    // Emit BigInt as a bare JSON number literal (sentinel + unquote): stock
    // JSON.stringify throws on BigInt, and a quoted string would change the type.
    const out = JSON.stringify(decode(fs.readFileSync(0, "utf8")), (_, v) =>
      typeof v === "bigint" ? `${v}` : v).replace(/"(-?\d+)"/g, "$1");
    process.stdout.write(out + "\n");
  } else if (cmd === "crush") {
    const array = JSON.parse(fs.readFileSync(0, "utf8"));
    const { view, hash } = crush(array);
    if (hash) {
      const dir = ccrDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${hash}.json`), JSON.stringify(array));
    }
    process.stdout.write(JSON.stringify(view) + "\n");
  } else if (cmd === "retrieve") {
    const hash = process.argv[3];
    if (!hash) throw new Error("Usage: eso retrieve <hash>");
    if (!/^[0-9a-f]{16}$/.test(hash)) throw new Error(`Invalid hash: ${hash}`);
    process.stdout.write(fs.readFileSync(path.join(ccrDir(), `${hash}.json`), "utf8") + "\n");
  } else {
    throw new Error("Usage: eso <encode|decode|crush|retrieve>");
  }
} catch (error) {
  console.error(`eso: ${error.message}`);
  process.exitCode = 1;
}
