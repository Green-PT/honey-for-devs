#!/usr/bin/env node
"use strict";
// ES5 on purpose — this entry file must PARSE on any old system node (desktop-app
// sessions inherit the launchd PATH, where /usr/local/bin/node can be ancient).
// The real hook (logcompress-hook-impl.js) uses `??` etc. and needs Node >= 14;
// requiring it from here keeps old node from ever parsing it. On old node: warn
// once per node version (stderr + exit 1 so Claude Code surfaces it), then stay
// silent and fail open. No template literals, arrows, `??`, `?.`, or bare catch here.
var major = parseInt(process.versions.node, 10);
if (major >= 14) {
  require("./logcompress-hook-impl.js");
} else {
  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var marker = path.join(os.tmpdir(), "honey-node-guard-" + process.versions.node);
  var warned = false;
  try { warned = fs.existsSync(marker); } catch (e) {}
  if (warned) process.exit(0); // fail open, already warned
  try { fs.writeFileSync(marker, ""); } catch (e) {}
  process.stderr.write(
    "honey: the Bash log compressor needs Node >= 14, but hooks run with node " +
    process.versions.node + " (" + process.execPath + "). Bash output will NOT be " +
    "compressed. Fix the node on your system PATH (desktop-app sessions use the " +
    "launchd PATH, not your shell profile).\n"
  );
  process.exit(1); // non-blocking: original tool result is kept, stderr shown to user
}
