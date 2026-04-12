#!/usr/bin/env bash
# scripts/smoke.sh — OE3 v0.1 smoke test runner
#
# Covers smoke checklist items 1–2 (Docker preflight + seed) and then
# runs the Playwright suite (items 3–13).
#
# Usage:
#   ./scripts/smoke.sh              # full run (starts stack if needed)
#   ./scripts/smoke.sh --tests-only # skip preflight, assume stack is up
#
# Prerequisites:
#   - Docker + Docker Compose v2
#   - Node.js / npm installed
#   - npx playwright install --with-deps chromium  (run once)
#
set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
DEV_URL="http://localhost:5173"
ORTHANC_URL="http://localhost:8042/studies"
TIMEOUT_SECS=90
DEV_PID=""

# ─── colours ───────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

# ─── cleanup on exit ───────────────────────────────────────────────────────
cleanup() {
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    echo "Stopping dev server (PID $DEV_PID)..."
    kill "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─── helpers ───────────────────────────────────────────────────────────────
wait_for_url() {
  local url="$1" label="$2" elapsed=0
  echo -n "Waiting for $label"
  until curl -sf "$url" >/dev/null 2>&1; do
    sleep 2; elapsed=$((elapsed + 2))
    echo -n "."
    if [[ $elapsed -ge $TIMEOUT_SECS ]]; then
      echo
      fail "$label did not become ready within ${TIMEOUT_SECS}s"
    fi
  done
  echo
  ok "$label is ready"
}

tests_only=false
for arg in "$@"; do [[ "$arg" == "--tests-only" ]] && tests_only=true; done

# ─── item 1: Docker stack ──────────────────────────────────────────────────
if [[ "$tests_only" == "false" ]]; then
  echo
  echo "═══ Item 1: Docker stack ═══════════════════════════════════════════"
  docker compose -f "$COMPOSE_FILE" up -d

  echo "Waiting for all services to be healthy..."
  elapsed=0
  until [[ $(docker compose -f "$COMPOSE_FILE" ps --format json \
             | grep -c '"Health":"healthy"' 2>/dev/null || echo 0) -ge 3 ]]; do
    sleep 3; elapsed=$((elapsed + 3))
    if [[ $elapsed -ge $TIMEOUT_SECS ]]; then
      warn "Timed out waiting for healthy status — continuing anyway"
      break
    fi
  done
  ok "Docker stack is up"

  # ─── item 2: Seed data ──────────────────────────────────────────────────
  echo
  echo "═══ Item 2: Seed sample data ════════════════════════════════════════"
  docker compose -f "$COMPOSE_FILE" --profile seed run --rm seeder
  ok "Seeder complete"

  # Verify at least one study exists
  count=$(curl -sf "$ORTHANC_URL" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  if [[ "$count" -lt 1 ]]; then
    fail "No studies found in Orthanc after seeding (got $count)"
  fi
  ok "Orthanc has $count seeded study/studies"
fi

# ─── Start dev server ──────────────────────────────────────────────────────
if ! curl -sf "$DEV_URL" >/dev/null 2>&1; then
  echo
  echo "═══ Starting dev server ═════════════════════════════════════════════"
  npm run dev &
  DEV_PID=$!
  wait_for_url "$DEV_URL" "dev server"
else
  ok "Dev server already running at $DEV_URL"
fi

# ─── items 3–13: Playwright suite ─────────────────────────────────────────
echo
echo "═══ Items 3–13: Playwright smoke tests ══════════════════════════════"
npx playwright test --config playwright.smoke.config.ts
PLAYWRIGHT_EXIT=$?

echo
if [[ $PLAYWRIGHT_EXIT -eq 0 ]]; then
  ok "All smoke tests passed"
else
  fail "Smoke tests failed — run: npx playwright show-report"
fi
