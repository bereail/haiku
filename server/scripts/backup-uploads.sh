#!/usr/bin/env bash
# Backup de las imágenes subidas (marketplace). Pensado para cron en el VPS, p. ej. diario:
#   15 3 * * * UPLOADS_DIR=/var/lib/librook/uploads /var/www/librook-api/scripts/backup-uploads.sh
# Guarda un .tar.gz por corrida y conserva los últimos KEEP_DAYS días. NO se instala solo.
set -euo pipefail

SRC="${UPLOADS_DIR:-/var/lib/librook/uploads}"
DEST="${BACKUP_DIR:-/root/librook-backups/uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"

[ -d "$SRC" ] || { echo "No existe $SRC" >&2; exit 1; }
mkdir -p "$DEST"
chmod 700 "$DEST"

FILE="$DEST/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"
tar czf "$FILE" -C "$SRC" .
chmod 600 "$FILE"
find "$DEST" -name 'uploads_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
