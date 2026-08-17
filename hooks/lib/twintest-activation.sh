#!/usr/bin/env bash
# twintest-activation.sh — session-scoped protocol activation.
#
# Adapted from achilles-activation.sh. Gates fire only when the twintest
# protocol is active in the current session. Plain dev sessions are
# silent-allowed.
#
# Activation signals:
#   1. TWINTEST_PROTOCOL=1|true|on  → ACTIVE
#   2. Session marker exists        → ACTIVE
#   3. TWINTEST_PROTOCOL=0|false    → INACTIVE
#   4. Skill invocation detected    → ACTIVE
#   5. Otherwise                    → INACTIVE (dev session)
#
# Caller contract:
#   . "$(dirname "${BASH_SOURCE[0]}")/lib/twintest-activation.sh"
#   twintest_require_active "$INPUT"

TWINTEST_SKILL_ALT='desktop-interactions|onboarding|self-repair'

twintest__jq() {
  if [ -n "${JQ:-}" ] && [ -x "${JQ:-}" ]; then
    printf '%s' "$JQ"
    return 0
  fi
  local candidate
  candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/bin/jq"
  if [ -x "$candidate" ]; then
    printf '%s' "$candidate"
    return 0
  fi
  command -v jq || true
}

twintest__state_dir() {
  printf '%s' "${TWINTEST_SESSION_STATE_DIR:-$HOME/.claude/twintest/sessions}"
}

twintest_mark_session_active() {
  local sid="$1"
  [ -n "$sid" ] || return 0
  local dir
  dir="$(twintest__state_dir)"
  mkdir -p "$dir" 2>/dev/null || return 0
  : > "$dir/${sid}.active" 2>/dev/null || true
  return 0
}

twintest_session_active() {
  local input="$1"
  local jq_bin sid env_off=0

  case "${TWINTEST_PROTOCOL:-}" in
    1|true|on|ON|active) return 0 ;;
    0|false|off|OFF) env_off=1 ;;
  esac

  jq_bin="$(twintest__jq)"
  if [ -z "$jq_bin" ]; then
    [ "$env_off" = "1" ] && return 1
    return 0
  fi

  sid=$(printf '%s' "$input" | "$jq_bin" -r '.session_id // empty' 2>/dev/null || echo "")

  if [ -z "$sid" ]; then
    [ "$env_off" = "1" ] && return 1
    return 0
  fi

  # Active marker
  if [ -f "$(twintest__state_dir)/${sid}.active" ]; then
    return 0
  fi

  [ "$env_off" = "1" ] && return 1

  # Check current tool call
  local tool_name skill_name
  tool_name=$(printf '%s' "$input" | "$jq_bin" -r '.tool_name // empty' 2>/dev/null || echo "")
  if [ "$tool_name" = "Skill" ]; then
    skill_name=$(printf '%s' "$input" | "$jq_bin" -r '.tool_input.skill // empty' 2>/dev/null || echo "")
    if printf '%s' "$skill_name" | grep -qE "(^|:)(${TWINTEST_SKILL_ALT})$"; then
      twintest_mark_session_active "$sid"
      return 0
    fi
  fi

  return 1
}

twintest_require_active() {
  if ! twintest_session_active "$1"; then
    exit 0
  fi
  return 0
}
