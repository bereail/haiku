#!/usr/bin/env bash
# deploy.sh — Despliega Librook en el VPS
# Uso: bash deploy.sh [usuario_ssh]
# Ejemplo: bash deploy.sh root
#
# Requiere un archivo .env.deploy.local (no versionado, ver .env.deploy.local.example)
# en la raíz del proyecto con VPS_HOST y VPS_PORT.

# Corta todo el script ante el primer comando que falle (scp, ssh, npm, psql, etc.) — antes no
# estaba y un fallo silencioso (ej. una copia que no llega, o una migración que falla de
# verdad) podía dejar el VPS con una mezcla de archivos viejos y nuevos y aun así llegar al
# restart final. Las migraciones de abajo usan CREATE/ALTER ... IF NOT EXISTS en todos lados,
# así que un re-run benigno YA termina con exit 0 por sí solo (verificado) — no hace falta
# (ni conviene) esconder errores reales detrás de un "|| echo ya existía, OK".
set -euo pipefail
[ -f .env.deploy.local ] && source .env.deploy.local

# Chequeo local antes de tocar el VPS: que todo .js del backend esté en la lista de copia de
# abajo (si falta uno, la API falla en producción con MODULE_NOT_FOUND).
node scripts/check-deploy-files.mjs

USER=${1:-root}
HOST="${VPS_HOST:?Falta VPS_HOST. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
PORT="${VPS_PORT:?Falta VPS_PORT. Copiá .env.deploy.local.example a .env.deploy.local y completalo.}"
API_DIR="/var/www/librook-api"
SSH="ssh -p $PORT $USER@$HOST"
SCP="scp -P $PORT"

echo "==> Backup rápido del estado actual en el VPS (para poder volver atrás)..."
# Nada de esto toca producción — es una copia de lo que YA está corriendo, antes de pisarlo.
BACKUP_TAG=$(date +%Y%m%d_%H%M%S)
$SSH "mkdir -p /root/librook-deploy-backups && \
  tar czf /root/librook-deploy-backups/api_$BACKUP_TAG.tar.gz -C /var/www librook-api && \
  tar czf /root/librook-deploy-backups/web_$BACKUP_TAG.tar.gz -C /var/www/html librook"
echo "==> Backup guardado en el VPS: /root/librook-deploy-backups/{api,web}_$BACKUP_TAG.tar.gz"

# Revierte el código (no la base) al estado de ANTES de este deploy y reinicia. Es seguro
# aunque la migración de base ya se haya aplicado: el código viejo nunca lee/escribe las
# tablas/columnas nuevas (son aditivas), así que conviven sin problema.
rollback_and_exit() {
  echo ""
  echo "==> Revirtiendo código al estado previo a este deploy (backup $BACKUP_TAG)..."
  $SSH "cd /var/www && tar xzf /root/librook-deploy-backups/api_$BACKUP_TAG.tar.gz && \
        cd /var/www/html && rm -rf librook && tar xzf /root/librook-deploy-backups/web_$BACKUP_TAG.tar.gz && \
        sudo systemctl restart librook-api" \
    && echo "==> Código revertido y servicio reiniciado." \
    || echo "¡ATENCIÓN! La reversión automática también falló — hace falta intervención manual. Backup intacto en /root/librook-deploy-backups/{api,web}_$BACKUP_TAG.tar.gz"
  echo "==> Deploy ABORTADO. El sitio debería estar de nuevo en la versión anterior."
  exit 1
}

echo "==> Copiando archivos del servidor al VPS..."
$SCP server/index.js          $USER@$HOST:$API_DIR/index.js
# db.js no se copiaba nunca (quedaba la versión de la instalación inicial): sin esto no llega
# el parser de columnas DATE (fechas como 'YYYY-MM-DD').
$SCP server/db.js             $USER@$HOST:$API_DIR/db.js
$SCP server/demoAccount.js    $USER@$HOST:$API_DIR/demoAccount.js
$SCP server/publicAlias.js    $USER@$HOST:$API_DIR/publicAlias.js
$SCP server/schema.sql        $USER@$HOST:$API_DIR/schema.sql
$SCP server/demoData.js       $USER@$HOST:$API_DIR/demoData.js
$SCP server/reset-demo.js     $USER@$HOST:$API_DIR/reset-demo.js
$SCP server/routes/auth.js    $USER@$HOST:$API_DIR/routes/auth.js
$SCP server/routes/books.js   $USER@$HOST:$API_DIR/routes/books.js
$SCP server/routes/admin.js   $USER@$HOST:$API_DIR/routes/admin.js
$SCP server/routes/analytics.js $USER@$HOST:$API_DIR/routes/analytics.js
$SCP server/routes/settings.js $USER@$HOST:$API_DIR/routes/settings.js
$SCP server/routes/community.js $USER@$HOST:$API_DIR/routes/community.js
$SCP server/routes/catalog.js $USER@$HOST:$API_DIR/routes/catalog.js
$SCP server/routes/uploads.js $USER@$HOST:$API_DIR/routes/uploads.js
# IMPORTANTE: antes de esta versión, deploy.sh nunca copiaba server/middleware/ — asumía
# que el VPS ya tenía authMiddleware.js de la instalación inicial (install_api.sh). Ahora que
# hay middlewares nuevos (blockDemoWrites.js, rateLimiter.js) que index.js ya requiere, hace
# falta copiar la carpeta completa o el deploy deja la API rota (módulo no encontrado).
$SSH "mkdir -p $API_DIR/middleware $API_DIR/scripts $API_DIR/validation $API_DIR/images"
$SCP server/middleware/authMiddleware.js  $USER@$HOST:$API_DIR/middleware/authMiddleware.js
$SCP server/middleware/blockDemoWrites.js $USER@$HOST:$API_DIR/middleware/blockDemoWrites.js
$SCP server/middleware/rateLimiter.js     $USER@$HOST:$API_DIR/middleware/rateLimiter.js
$SCP server/middleware/sessionRevocation.js $USER@$HOST:$API_DIR/middleware/sessionRevocation.js
$SCP server/validation/bookInput.js      $USER@$HOST:$API_DIR/validation/bookInput.js
$SCP server/images/imageFile.js          $USER@$HOST:$API_DIR/images/imageFile.js
$SCP server/images/storage.js            $USER@$HOST:$API_DIR/images/storage.js
$SCP server/images/cleanup.js            $USER@$HOST:$API_DIR/images/cleanup.js
$SCP server/scripts/cleanup-uploads.js   $USER@$HOST:$API_DIR/scripts/cleanup-uploads.js
$SCP server/scripts/backup-uploads.sh    $USER@$HOST:$API_DIR/scripts/backup-uploads.sh
$SCP server/scripts/backfill-editions.js  $USER@$HOST:$API_DIR/scripts/backfill-editions.js
# server/rateLimit.js (el rate limiter casero original) quedó reemplazado por
# server/middleware/rateLimiter.js (usa express-rate-limit) — limpiamos el archivo viejo
# del VPS para que no quede código muerto ahí.
$SSH "rm -f $API_DIR/rateLimit.js"

echo "==> Aplicando migración SQL (tabla user_settings)..."
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal_count  INTEGER     DEFAULT 0,
    goal_year   INTEGER     DEFAULT EXTRACT(YEAR FROM NOW())::int,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );
\""

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
\""

echo "==> Aplicando migración SQL (catálogo bibliográfico público: obras/autores/ediciones)..."
# 100% aditiva — no modifica ni elimina ninguna columna existente de books/community_posts.
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  CREATE TABLE IF NOT EXISTS obras (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_title    TEXT NOT NULL,
    subjects           TEXT[],
    first_publish_year INTEGER,
    ol_work_key        TEXT,
    source             TEXT NOT NULL DEFAULT 'manual',
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS obras_ol_work_key_uq ON obras (ol_work_key) WHERE ol_work_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS autores (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    ol_author_key TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS autores_ol_key_uq ON autores (ol_author_key) WHERE ol_author_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS obra_autores (
    obra_id  UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES autores(id) ON DELETE CASCADE,
    PRIMARY KEY (obra_id, autor_id)
  );
  CREATE INDEX IF NOT EXISTS obra_autores_autor_idx ON obra_autores (autor_id);

  CREATE TABLE IF NOT EXISTS ediciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id        UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    title          TEXT,
    isbn_13        TEXT,
    isbn_10        TEXT,
    publisher      TEXT,
    publish_year   INTEGER,
    language       TEXT,
    pages          INTEGER,
    cover_url      TEXT,
    ol_edition_key TEXT,
    source         TEXT NOT NULL DEFAULT 'manual',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ediciones_ol_key_uq ON ediciones (ol_edition_key) WHERE ol_edition_key IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS ediciones_isbn13_uq ON ediciones (isbn_13) WHERE isbn_13 IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS ediciones_isbn10_uq ON ediciones (isbn_10) WHERE isbn_10 IS NOT NULL;
  CREATE INDEX IF NOT EXISTS ediciones_obra_idx ON ediciones (obra_id);

  ALTER TABLE books ADD COLUMN IF NOT EXISTS edition_id UUID REFERENCES ediciones(id);
  CREATE INDEX IF NOT EXISTS books_edition_idx ON books (edition_id);

  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES obras(id);
  CREATE INDEX IF NOT EXISTS community_posts_obra_idx ON community_posts (obra_id);
\""

echo "==> Aplicando migración SQL (revocación de sesiones al cambiar la contraseña)..."
# Tiene que correr ANTES del restart: el authMiddleware nuevo consulta esta columna.
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
\""

echo "==> Aplicando migración SQL (marketplace: publicaciones e imágenes subidas)..."
# Aditiva (IF NOT EXISTS). La carpeta de imágenes (UPLOADS_DIR) se configura una sola vez a
# mano: ver docs/marketplace-imagenes.md.
$SSH "psql \$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c \"
  CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('venta', 'intercambio')),
    book_title TEXT NOT NULL,
    book_author TEXT,
    condition TEXT NOT NULL CHECK (condition IN ('nuevo', 'muy_bueno', 'bueno', 'aceptable')),
    price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'ARS',
    description TEXT,
    city TEXT,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'pausada', 'cerrada')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (kind <> 'venta' OR price_cents IS NOT NULL)
  );
  CREATE INDEX IF NOT EXISTS marketplace_listings_status_idx ON marketplace_listings (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS marketplace_listings_user_idx ON marketplace_listings (user_id);
  CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    listing_id UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
    position SMALLINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS uploads_user_idx ON uploads (user_id);
  CREATE INDEX IF NOT EXISTS uploads_listing_idx ON uploads (listing_id, position);
  CREATE INDEX IF NOT EXISTS uploads_orphan_idx ON uploads (created_at) WHERE listing_id IS NULL;
\""

echo "==> Instalando dependencias nuevas del backend (express-rate-limit)..."
# deploy.sh nunca corrió npm install en el VPS — hasta ahora nunca hizo falta porque no se
# agregaban dependencias nuevas. Esta versión agrega express-rate-limit, así que sin este paso
# el restart de abajo tira "Cannot find module 'express-rate-limit'" y la API queda caída.
$SCP server/package.json      $USER@$HOST:$API_DIR/package.json
$SCP server/package-lock.json $USER@$HOST:$API_DIR/package-lock.json
# npm ci (no npm install): borra node_modules y reinstala exactamente lo que dice el lockfile.
# Es más lento que un install incremental pero falla fuerte si package.json y el lockfile no
# coinciden, en vez de resolver "como pueda" — mejor para un deploy que para desarrollo local.
$SSH "cd $API_DIR && npm ci --omit=dev"

echo "==> Reiniciando API..."
$SSH "sudo systemctl restart librook-api"

echo "==> Verificando que la API responda (health check real, no solo el estado de systemd)..."
HEALTH_OK=false
for i in 1 2 3 4 5; do
  sleep 1
  if $SSH "curl -sf -o /dev/null http://127.0.0.1:3001/health"; then
    HEALTH_OK=true
    break
  fi
  echo "    (intento $i/5 sin respuesta todavía...)"
done

if [ "$HEALTH_OK" = false ]; then
  echo ""
  echo "¡ATENCIÓN! La API no respondió /health después de reiniciar."
  echo "Logs: ssh -p $PORT $USER@$HOST 'sudo journalctl -u librook-api -n 50 --no-pager'"
  rollback_and_exit
fi
echo "==> API respondiendo OK (/health, confirmado contra la base real)."

# /health ahora sí toca la base (SELECT 1), pero no garantiza que las tablas NUEVAS existan —
# solo que hay conexión. Este segundo chequeo pega contra /catalog/works, que necesita la
# tabla `obras` — si por lo que sea no está, esto lo detecta acá en vez de que lo descubra
# un visitante.
echo "==> Verificando que el catálogo responda (confirma que la migración de obras/ediciones se aplicó)..."
if $SSH "curl -sf -o /dev/null 'http://127.0.0.1:3001/catalog/works?limit=1'"; then
  echo "==> Catálogo respondiendo OK."
else
  echo ""
  echo "¡ATENCIÓN! /catalog/works no respondió — la tabla 'obras' puede no existir."
  echo "(Si llegamos hasta acá, la migración de arriba terminó con éxito según su propio"
  echo "exit code — esto apuntaría a otra causa, ej. permisos de la tabla. Revisar a mano:"
  echo "ssh -p $PORT $USER@$HOST \"psql \\\$(grep DATABASE_URL $API_DIR/.env | cut -d= -f2-) -c '\\dt obras'\")"
  rollback_and_exit
fi

$SSH "sudo systemctl status librook-api --no-pager | head -6"

echo "==> Copiando frontend al directorio web..."
# Confirmado con `nginx -T`: el bloque "location /librook/" usa alias hacia esta ruta.
# (La detección automática anterior buscaba "root" en la config, pero nginx usa "alias" acá,
# así que nunca lo encontraba y caía a un fallback que a veces elegía una carpeta vieja
# equivocada que nginx ni siquiera sirve.)
WEBROOT="/var/www/html/librook"
echo "==> Webroot: $WEBROOT"
# `scp -r dist/.` solo agrega/pisa archivos — nunca borra. Vite nombra cada bundle con un
# hash de contenido distinto en cada build, así que sin este paso los bundles de builds
# anteriores quedan acumulados para siempre en el servidor. Encontrado en esta misma sesión:
# un index-*.js de un build de agosto todavía vivo junto al de hoy — eso es exactamente lo que
# permite que un Service Worker viejo en el navegador de un visitante siga sirviendo contenido
# desactualizado sin que falle ningún fetch (el archivo viejo todavía existe y responde 200).
$SSH "rm -rf $WEBROOT/assets"
$SCP -r dist/. $USER@$HOST:$WEBROOT/
echo "==> Frontend copiado correctamente (assets viejos eliminados antes de copiar)."

echo ""
echo "Deploy completado. Verificá en https://ailonline.com.ar/librook/"
echo "(nginx ya tiene el fallback de SPA correcto para /librook/ — confirmado con nginx -T"
echo " el 2026-10-21, las rutas nuevas /catalog y /catalog/obra/:id deberían andar sin tocar nada ahí)"
echo ""
echo "RECORDATORIO: el sitio está detrás de Cloudflare (confirmado por los headers de respuesta,"
echo "no se sabía hasta esta sesión). sw.js se sirve con Cache-Control: max-age=14400 (4h) — un"
echo "visitante nuevo podría recibir un sw.js cacheado por Cloudflare hasta 4h después de este"
echo "deploy. No se purgó la caché de Cloudflare (no hay acceso/API configurado en esta sesión)."
