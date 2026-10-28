#!/usr/bin/env bash
# Uso: bash deploy_analytics.sh <usuario_ssh>
# Ejemplo: bash deploy_analytics.sh root
# O si tenés clave: bash deploy_analytics.sh ubuntu
#
# Requiere un archivo .env.deploy.local (no versionado, ver .env.deploy.local.example)
# en la raíz del proyecto con VPS_HOST y VPS_PORT.

set -e
[ -f .env.deploy.local ] && source .env.deploy.local

USER=${1:-root}
HOST="${VPS_HOST:?Falta VPS_HOST. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
PORT="${VPS_PORT:?Falta VPS_PORT. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
REMOTE="/var/www/haiku-api"
SSH="ssh -p $PORT $USER@$HOST"
SCP="scp -P $PORT"

echo "==> Copiando archivos al VPS..."
$SCP server/routes/analytics.js $USER@$HOST:$REMOTE/routes/analytics.js
$SCP server/routes/admin.js      $USER@$HOST:$REMOTE/routes/admin.js
$SCP server/index.js             $USER@$HOST:$REMOTE/index.js

echo "==> Ejecutando migración SQL..."
$SSH "psql \$DATABASE_URL -f $REMOTE/schema_analytics.sql 2>/dev/null || \
  psql \$(cat $REMOTE/.env | grep DATABASE_URL | cut -d= -f2-) -c \"
    CREATE TABLE IF NOT EXISTS page_views (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id  TEXT        NOT NULL,
      user_email  TEXT,
      path        TEXT        NOT NULL,
      referrer    TEXT,
      device_type TEXT,
      browser     TEXT,
      os          TEXT,
      ip_address  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views(session_id);
  \""

echo "==> Copiando schema SQL..."
$SCP server/schema_analytics.sql $USER@$HOST:$REMOTE/schema_analytics.sql

echo "==> Reiniciando servicio..."
$SSH "sudo systemctl restart haiku-api && sleep 1 && sudo systemctl status haiku-api --no-pager | head -8"

echo ""
echo "✓ Deploy completado. Probá el panel admin."
