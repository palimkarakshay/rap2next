#!/usr/bin/env bash
# Mirror the sample package into the dedicated abapGit repo
# (rap2next-sample-catalog uses the standard /src/ layout that the
# cloud abapGit ADT plugin imports reliably). Run after ANY change
# under examples/product-catalog/abap/.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)/examples/product-catalog/abap"
DST="${1:-$(cd "$(dirname "$0")/../.." && pwd)/rap2next-sample-catalog}"

[ -d "$DST/src" ] || { echo "target repo not found: $DST" >&2; exit 1; }

rm -f "$DST"/src/*
cp "$SRC"/* "$DST/src/"
echo "synced $(ls "$DST/src" | wc -l) files -> $DST/src (commit + push there separately)"
