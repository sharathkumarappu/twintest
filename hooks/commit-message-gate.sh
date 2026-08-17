#!/usr/bin/env bash
# commit-message-gate.sh — PreToolUse:Bash guard.
#
# Enforces commit message conventions for twintest framework commits.
# Requires conventional commit format: type(scope): description
# Silent-allows in non-twintest sessions.

set -euo pipefail
INPUT=$(cat)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/twintest-activation.sh"
twintest_require_active "$INPUT"

JQ="${JQ:-$(command -v jq || true)}"
[ -z "$JQ" ] && exit 0

COMMAND=$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only gate git commit commands
case "$COMMAND" in
  *"git commit"*)
    # Extract the commit message
    MSG=$(printf '%s' "$COMMAND" | grep -oP '(?<=-m\s["\x27])[^"\x27]+' 2>/dev/null || echo "")
    if [ -n "$MSG" ]; then
      # Check for conventional commit format
      if ! printf '%s' "$MSG" | grep -qE '^(feat|fix|test|refactor|docs|chore|style|perf|ci|build|revert)(\([a-z0-9-]+\))?: .+'; then
        echo "WARN: Commit message does not follow conventional format."
        echo "Expected: type(scope): description"
        echo "Types: feat, fix, test, refactor, docs, chore, style, perf, ci, build, revert"
        echo "Example: feat(calculator): add scientific mode step definitions"
      fi
    fi
    ;;
esac

exit 0
