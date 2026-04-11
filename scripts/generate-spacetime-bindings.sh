#!/usr/bin/env bash
# Generate SpacetimeDB TypeScript client bindings.
#
# Usage:
#   ./scripts/generate-spacetime-bindings.sh
#
# Prerequisites:
#   - spacetime CLI installed (https://spacetimedb.com/install)
#   - SpacetimeDB module published (spacetime publish -p spacetime/nexus nexus)
#
# The generated bindings are committed to the repo so that app builds
# don't require the SpacetimeDB CLI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

OUT_DIR="$ROOT_DIR/src/lib/spacetime/module_bindings"

echo "Generating SpacetimeDB TypeScript bindings..."
echo "  Module: spacetime/nexus"
echo "  Output: $OUT_DIR"

spacetime generate \
  --lang typescript \
  --out-dir "$OUT_DIR" \
  --module-path "$ROOT_DIR/spacetime/nexus"

echo "Bindings generated successfully."
echo ""
echo "If the module schema changed, commit the updated bindings:"
echo "  git add src/lib/spacetime/module_bindings/"
