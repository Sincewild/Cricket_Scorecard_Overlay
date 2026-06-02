#!/usr/bin/env bash
# Smoke test: verify app is running and responding
# Usage: ./scripts/smoke-test.sh [base-url]
# Example: ./scripts/smoke-test.sh https://overlay.maharj.com

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check_status() {
  local label="$1" endpoint="$2" expected_code="$3"
  local code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$endpoint" 2>/dev/null)
  if [ "$code" = "$expected_code" ]; then
    echo "  PASS  $label (HTTP $code)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label (expected HTTP $expected_code, got $code)"
    FAIL=$((FAIL+1))
  fi
}

check_json() {
  local label="$1" endpoint="$2" key="$3"
  local response=$(curl -sf "$BASE$endpoint" 2>/dev/null)
  if echo "$response" | grep -q "$key"; then
    echo "  PASS  $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label (missing key: $key)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Smoke test: $BASE ==="
echo ""
echo "Checking HTTP endpoints..."
check_status "GET / (app root)" "/" "200"
check_status "GET /health" "/health" "200"
check_status "GET /score" "/score" "200"
check_status "GET /overlay" "/overlay" "200"
check_status "GET /admin" "/admin" "200"

echo ""
echo "Checking JSON responses..."
check_json "/health has status field" "/health" '"status"'
check_json "/health has browserRunning field" "/health" '"browserRunning"'
check_json "/score has team1 field" "/score" '"team1"'

echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✓ Smoke test PASSED - app is running"
  exit 0
else
  echo "✗ Smoke test FAILED"
  exit 1
fi
