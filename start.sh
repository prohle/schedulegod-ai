#!/usr/bin/env bash
set -euo pipefail

# ScheduleGod AI — single-command local deploy.
#
# Bootstraps the Python backend (FastAPI + OR-Tools CP-SAT) and the Next.js
# frontend, wires them together, auto-assigns free ports, and stops both on
# Ctrl-C. Safe to re-run: installs are skipped when already present.
#
# Usage:
#   ./start.sh          # dev mode  (Next.js dev server, auto-recompiles)
#   ./start.sh --prod   # prod mode (next build && next start — faster runtime)
#
# Optional env overrides:
#   BACKEND_PORT=8011 FRONTEND_PORT=3011 ./start.sh
#   MODEL_API_KEY=... ./start.sh   # live Muse Spark (default: deterministic mock, zero credits)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-dev}"

# Pick up the repo-root .env so the banner (and the backend) agree on the key.
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT/.env"
  set +a
fi

# Python interpreter (backend requires it).
PYTHON_BIN="python3"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || PYTHON_BIN="python"

# Print the first free TCP port at or after $1 (reliable via bind(), portable).
free_port() {
  "$PYTHON_BIN" - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
while True:
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            print(port); break
        except OSError:
            port += 1
PY
}

# --- backend ---------------------------------------------------------------
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  echo "==> Creating Python virtualenv (.venv)"
  "$PYTHON_BIN" -m venv .venv
fi
echo "==> Installing backend dependencies"
.venv/bin/pip install -q -r requirements.txt
BACKEND_PORT="$(free_port "${BACKEND_PORT:-8000}")"

# --- frontend --------------------------------------------------------------
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "==> Installing frontend dependencies (one-time, ~1 min)"
  npm install
fi
FRONTEND_PORT="$(free_port "${FRONTEND_PORT:-3000}")"
BACKEND_URL="http://localhost:${BACKEND_PORT}"

if [ "$MODE" = "--prod" ] || [ "$MODE" = "prod" ]; then
  echo "==> Building frontend (production)"
  npm run build
  FRONTEND_CMD=(npx next start -p "$FRONTEND_PORT")
else
  FRONTEND_CMD=(npx next dev -p "$FRONTEND_PORT")
fi

MUSE_MODE="mock parser/tightener (no MODEL_API_KEY — zero credits)"
if [ -n "${MODEL_API_KEY:-}" ] || [ -n "${MUSE_API_KEY:-}" ]; then
  MUSE_MODE="live Muse Spark (Meta Model API key set)"
fi

echo ""
echo "  ScheduleGod AI starting…"
echo "  · Frontend  http://localhost:${FRONTEND_PORT}"
echo "  · Backend   http://localhost:${BACKEND_PORT}   (API docs: /docs)"
echo "  · Muse mode ${MUSE_MODE}"
echo "  Press Ctrl-C to stop both."
echo ""

cleanup() {
  echo ""
  echo "Shutting down…"
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup INT TERM EXIT

cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --port "$BACKEND_PORT" --log-level warning &

cd "$ROOT/frontend"
BACKEND_URL="$BACKEND_URL" "${FRONTEND_CMD[@]}" &

wait