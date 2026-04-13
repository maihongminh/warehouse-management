#!/usr/bin/env bash
# Sao chép SQLite backend (chạy khi app đang tắt hoặc chỉ đọc để tránh file đang khóa).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/backend/data/app.db"
DEST_DIR="$ROOT/backend/data/backup"
mkdir -p "$DEST_DIR"
if [[ ! -f "$SRC" ]]; then
  echo "Không thấy $SRC — chưa chạy alembic / chưa có DB." >&2
  exit 1
fi
STAMP="$(date +%Y%m%d_%H%M%S)"
cp -a "$SRC" "$DEST_DIR/app_${STAMP}.db"
echo "Đã lưu: $DEST_DIR/app_${STAMP}.db"
