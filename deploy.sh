#!/usr/bin/env bash
# deploy.sh — Despliega Librook en el VPS
# Uso: bash deploy.sh [usuario_ssh]
# Ejemplo: bash deploy.sh root
#
# Requiere un archivo .env.deploy.local (no versionado, ver .env.deploy.local.example)
# en la raíz del proyecto con VPS_HOST y VPS_PORT.

set -e
[ -f .env.deploy.local ] && source .env.deploy.local

USER=${1:-root}
HOST="${VPS_HOST:?Falta VPS_HOST. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
PORT="${VPS_PORT:?Falta VPS_PORT. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
API_DIR="/var/www/librook-api"
SSH="ssh -p $PORT $USER@$HOST"
SCP="scp -P $PORT"

echo "==> Copiando archivos del servidor al VPS..."
$SCP server/index.js          $USER@$HOST:$API_DIR/index.js
$SCP server/rateLimit.js      $USER@$HOST:$API_DIR/rateLimit.js
$SCP server/schema.sql        $USER@$HOST:$API_DIR/schema.sql
$SCP server/demoData.js       $USER@$HOST:$API_DIR/demoData.js
$SCP server/reset-demo.js     $USER@$HOST:$API_DIR/reset-demo.js
$SCP server/routes/auth.js    $USER@$HOST:$API_DIR/routes/auth.js
$SCP server/routes/books.js   $USER@$HOST:$API_DIR/routes/books.js
$SCP server/routes/admin.js   $USER@$HOST:$API_DIR/routes/admin.js
$SCP server/routes/analytics.js $USER@$HOST:$API_DIR/routes/analytics.js
$SCP server/routes/settings.js $USER@$HOST:$API_DIR/routes/settings.js
$SCP server/routes/community.js $USER@$HOST:$API_DIR/routes/community.js

echo "==> Aplicando migración SQL (tabla user_settings)..."
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal_count  INTEGER     DEFAULT 0,
    goal_year   INTEGER     DEFAULT EXTRACT(YEAR FROM NOW())::int,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );
\"" 2>/dev/null || echo "(La tabla puede que ya exista — OK)"

echo "==> Aplicando migración SQL (comunidad: alias + posts/comentarios/likes)..."
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

  CREATE TABLE IF NOT EXISTS community_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id     UUID REFERENCES books(id) ON DELETE SET NULL,
    book_title  TEXT NOT NULL,
    book_author TEXT,
    book_cover  TEXT,
    book_score  INTEGER,
    reflection  TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS community_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS community_likes (
    post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
  );
\"" 2>/dev/null || echo "(Las tablas pueden que ya existan — OK)"

echo "==> Reiniciando API..."
$SSH "sudo systemctl restart librook-api && sleep 1 && sudo systemctl status librook-api --no-pager | head -6"

echo "==> Copiando frontend al directorio web..."
# Confirmado con `nginx -T`: el bloque "location /librook/" usa alias hacia esta ruta.
# (La detección automática anterior buscaba "root" en la config, pero nginx usa "alias" acá,
# así que nunca lo encontraba y caía a un fallback que a veces elegía una carpeta vieja
# equivocada que nginx ni siquiera sirve.)
WEBROOT="/var/www/html/librook"
echo "==> Webroot: $WEBROOT"
$SCP -r dist/. $USER@$HOST:$WEBROOT/
echo "==> Frontend copiado correctamente."

echo ""
echo "Deploy completado. Verificá en https://ailonline.com.ar/librook/"
