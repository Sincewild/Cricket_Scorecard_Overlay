#!/usr/bin/env bash
# Usage: ./scripts/smoke-test.sh [base-url]
# Example: ./scripts/smoke-test.sh https://cricket-scorecard-overlay.onrender.com

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  PASS  $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label (got: ${actual:0:120})"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Smoke test: $BASE ==="

# Health
HEALTH=$(curl -sf "$BASE/health" 2>/dev/null)
check "/health status=ok"           '"status":"ok"'    "$HEALTH"
check "/health browserRunning=true" '"browserRunning":true' "$HEALTH"

# Score — team names must not be defaults
SCORE=$(curl -sf "$BASE/score" 2>/dev/null)
check "/score has team1 field"      '"team1"'          "$SCORE"
if echo "$SCORE" | grep -q '"team1":"Team 1"'; then
  echo "  FAIL  /score team1 is still default placeholder"
  FAIL=$((FAIL+1))
else
  echo "  PASS  /score team1 is real team name"
  PASS=$((PASS+1))
fi

# Debug scrape — confirm raw text exists
RAW=$(curl -sf "$BASE/debug-scrape" 2>/dev/null)
if [ ${#RAW} -gt 100 ]; then
  echo "  PASS  /debug-scrape has content (${#RAW} chars)"
  PASS=$((PASS+1))
else
  echo "  FAIL  /debug-scrape empty or missing"
  FAIL=$((FAIL+1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
