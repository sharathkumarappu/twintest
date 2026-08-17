#!/usr/bin/env bash
# winappdriver-session-guard.sh — PreToolUse:Bash guard.
#
# Ensures Appium + windows driver is set up before test execution commands.
# When @wdio/appium-service is configured (default), Appium auto-starts;
# this guard catches manual runs or missing driver installs.
# Silent-allows in non-twintest sessions.

set -euo pipefail
INPUT=$(cat)

# Source the activation library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/twintest-activation.sh"
twintest_require_active "$INPUT"

JQ="${JQ:-$(command -v jq || true)}"
[ -z "$JQ" ] && exit 0

COMMAND=$(printf '%s' "$INPUT" | "$JQ" -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only gate commands that look like test runs
case "$COMMAND" in
  *wdio*|*"npm test"*|*"npm run test"*|*"npx wdio"*)
    # Check if Appium is installed
    if ! command -v appium &>/dev/null; then
      echo "WARN: Appium is not installed globally."
      echo "Run: npm run appium:setup"
      echo "  (this installs Appium globally + the appium-windows-driver)"
    fi
    # Check if Appium is reachable (may already be running or will auto-start)
    if command -v curl &>/dev/null; then
      if ! curl -s --connect-timeout 2 "http://127.0.0.1:4723/status" &>/dev/null; then
        # Not running yet — that's OK if @wdio/appium-service will auto-start it.
        # Only warn if the driver isn't installed.
        if command -v appium &>/dev/null; then
          DRIVERS=$(appium driver list --installed 2>/dev/null || echo "")
          if ! echo "$DRIVERS" | grep -qi "windows"; then
            echo "WARN: appium-windows-driver is not installed."
            echo "Run: npm run appium:setup"
          fi
        fi
      fi
    fi
    ;;
esac

exit 0
