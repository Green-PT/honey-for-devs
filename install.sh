#!/usr/bin/env bash
# Honey one-line installer (macOS / Linux / WSL / Git Bash).
#   curl -fsSL https://raw.githubusercontent.com/Green-PT/honey-for-devs/main/install.sh | bash
# Pass flags through bash -s, e.g. to also drop editor rule files into the cwd:
#   curl -fsSL .../install.sh | bash -s -- --with-init
set -euo pipefail

REPO="https://github.com/Green-PT/honey-for-devs"
DEST="${HOME}/.honey-src"

if ! command -v node >/dev/null 2>&1; then
  echo "Honey needs Node.js on your PATH. Install Node, then re-run." >&2
  exit 1
fi

if command -v git >/dev/null 2>&1; then
  if [ -d "$DEST/.git" ]; then
    git -C "$DEST" pull --ff-only --quiet || true
  else
    rm -rf "$DEST"
    git clone --depth 1 --quiet "${REPO}.git" "$DEST"
  fi
else
  echo "git not found — downloading tarball…"
  rm -rf "$DEST" && mkdir -p "$DEST"
  curl -fsSL "${REPO}/archive/refs/heads/main.tar.gz" | tar xz -C "$DEST" --strip-components=1
fi

# Reconnect stdin to the terminal so the installer's wizard can prompt even when
# this script itself arrived over a pipe (curl | bash).
if [ -e /dev/tty ]; then
  exec node "$DEST/bin/install.js" "$@" < /dev/tty
else
  exec node "$DEST/bin/install.js" "$@"
fi
