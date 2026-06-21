#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { decode, encode } = require("../esf");

try {
  const input = fs.readFileSync(0, "utf8");
  if (process.argv[2] === "encode") process.stdout.write(encode(JSON.parse(input)));
  else if (process.argv[2] === "decode") process.stdout.write(JSON.stringify(decode(input)) + "\n");
  else throw new Error("Usage: esf <encode|decode>");
} catch (error) {
  console.error(`esf: ${error.message}`);
  process.exitCode = 1;
}
