#!/usr/bin/env node
// Generate the Codex plugin package (plugins/honey/) from the repo root.
//
// Codex will not resolve a marketplace plugin whose `source.path` is the
// marketplace root — `codex plugin add honey@greenpt` answers "plugin `honey`
// was not found in marketplace `greenpt`". A path pointing at a subdirectory
// resolves; `./` does not. Symlinking that subdirectory back at the root does
// not work either: Codex copies the plugin into its cache and silently drops
// symlinks, installing a plugin with zero skills. So the tree is a real copy,
// generated and committed the same way .openclaw/skills/ is.
//
// `hooks` is dropped from the copied manifest: `codex features list` reports
// plugin_hooks as removed, so hooks/hooks.json can never fire under Codex.
//
// Run:  node scripts/build-codex-plugin.js
// tests/codex-plugin.test.js fails if the committed copy is stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'plugins', 'honey');

function manifest() {
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'));
  delete src.hooks;
  return JSON.stringify(src, null, 2) + '\n';
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, '.codex-plugin'), { recursive: true });
  fs.writeFileSync(path.join(OUT, '.codex-plugin', 'plugin.json'), manifest());
  // Skip dotfiles: .DS_Store is gitignored at the root, so copying it would ship
  // junk that the committed tree never has.
  fs.cpSync(path.join(ROOT, 'skills'), path.join(OUT, 'skills'), {
    recursive: true,
    filter: (src) => !path.basename(src).startsWith('.'),
  });
}

if (require.main === module) {
  build();
  console.log('built plugins/honey/ (manifest + ' + fs.readdirSync(path.join(OUT, 'skills')).length + ' skills)');
}

module.exports = { OUT, manifest, build };
