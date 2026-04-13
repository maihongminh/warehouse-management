#!/usr/bin/env bash
# Phase 6: chạy FastAPI + cửa sổ Tauri (dev). Cần: Rust, Node, backend .venv đã cài deps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [[ ! -f "$BACKEND/.venv/bin/uvicorn" ]]; then
  echo "Chưa thấy $BACKEND/.venv — hãy: cd backend && python3 -m venv .venv && pip install -r requirements.txt && alembic upgrade head" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$BACKEND/.venv/bin/activate"
cd "$BACKEND"
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!
sleep 1

cd "$FRONTEND"
exec npm run tauri:dev
