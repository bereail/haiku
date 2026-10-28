#!/usr/bin/env bash
# Backup de las imágenes subidas (marketplace). Pensado para cron en el VPS, p. ej. diario:
#   15 3 * * * /var/www/haiku-api/scripts/backup-uploads.sh
# Guarda un .tar.gz por corrida y conserva los últimos KEEP_DAYS días. NO se instala solo.
#
# La carpeta es la MISMA que usa el servidor: UPLOADS_DIR del entorno o, si no está, la del
# .env del servidor (../.env). Sin default propio: antes asumía /var/lib/haiku/uploads y,
# si el servidor usaba otra, respaldaba una carpeta equivocada sin avisar.
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [ -z "${UPLOADS_DIR:-}" ] && [ -f "$ENV_FILE" ]; then
  UPLOADS_DIR="$(grep -E '^[[:space:]]*UPLOADS_DIR=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
fi
SRC="${UPLOADS_DIR:-}"
[ -n "$SRC" ] || { echo "UPLOADS_DIR no está configurada (ni en el entorno ni en $ENV_FILE)" >&2; exit 1; }
case "$SRC" in /*) ;; *) echo "UPLOADS_DIR tiene que ser una ruta absoluta (es \"$SRC\")" >&2; exit 1 ;; esac
DEST="${BACKUP_DIR:-/root/haiku-backups/uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"

[ -d "$SRC" ] || { echo "No existe $SRC" >&2; exit 1; }
mkdir -p "$DEST"
chmod 700 "$DEST"

FILE="$DEST/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"
tar czf "$FILE" -C "$SRC" .
chmod 600 "$FILE"
find "$DEST" -name 'uploads_*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
