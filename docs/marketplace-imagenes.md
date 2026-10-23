# Imágenes del marketplace: almacenamiento, seguridad y operación

Las fotos de las publicaciones se guardan en el disco del VPS existente (sin servicios
externos ni costos recurrentes).

## Cómo funciona

| Aspecto | Decisión |
|---|---|
| Dónde | `UPLOADS_DIR` (fuera del webroot). nginx **no** la sirve: las imágenes salen solo por la API (`GET /librook-api/uploads/<nombre>`). |
| Subida | `POST /librook-api/uploads` con la imagen cruda (sin multipart, sin dependencias). Requiere sesión; la cuenta demo no puede. |
| Validación | Tipo por firma binaria (JPEG/PNG/WebP; nunca por extensión ni por el Content-Type), dimensiones del encabezado, 50–6000 px por lado, 25 M píxeles, 5 MB. HTML, SVG, GIF, etc. se rechazan. |
| Privacidad | Se quitan EXIF (incluida la **ubicación GPS** de las fotos de celular), XMP, IPTC y comentarios. Además el navegador achica la foto (1600 px, JPEG) antes de subirla. |
| Nombres | 128 bits aleatorios (`<32 hex>.jpg|png|webp`). Se escriben con `wx` (nunca pisan otro archivo). Solo se sirve lo registrado en la base; cualquier otro nombre da 404 sin tocar el disco (sin path traversal). |
| Permisos | Carpeta `0700`, archivos `0600`, del usuario que corre la API. |
| Cabeceras al servir | `Content-Type` del registro, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: … sandbox`, caché inmutable. |
| Cupos | 60 imágenes / 60 MB por usuaria; 40 subidas cada 10 min. |
| Limpieza | `scripts/cleanup-uploads.js`: borra huérfanas (sin publicación) de más de 24 h y archivos sueltos (no registrados) de más de 1 h. `--dry-run` para simular. |

Las imágenes **no** pueden exigir sesión (un `<img>` no manda el token): la protección es que
la URL es imposible de adivinar y solo existe si está en una publicación (o recién subida).

## Configuración en el VPS (una sola vez, a mano)

`deploy.sh` copia el código y crea las tablas, pero **no** crea carpetas ni toca nginx/cron.
Antes de habilitar el marketplace en producción:

1. **Medir el espacio disponible** y el uso actual:
   ```
   df -h / /var
   du -sh /var/www/librook-api /var/www/html/librook
   ```
2. **Crear la carpeta** fuera del webroot, del usuario del servicio `librook-api`
   (ver `User=` en `systemctl cat librook-api`):
   ```
   mkdir -p /var/lib/librook/uploads
   chown <usuario-del-servicio>: /var/lib/librook/uploads
   chmod 700 /var/lib/librook/uploads
   ```
3. En `/var/www/librook-api/.env`: `UPLOADS_DIR=/var/lib/librook/uploads` y reiniciar
   `librook-api`. (Sin la variable, la API usa `/var/www/.uploads`, que tampoco está en el
   webroot, pero conviene definirla explícita).
4. **nginx**: el límite por defecto de un pedido es 1 MB (`client_max_body_size`). El
   navegador apunta a fotos de menos de 900 KB, así que funciona sin cambios; si se quiere
   aceptar fotos más pesadas, subirlo solo para `/librook-api/uploads` (máximo 6m).
5. **Cron** (diario):
   ```
   10 3 * * * cd /var/www/librook-api && node scripts/cleanup-uploads.js
   15 3 * * * UPLOADS_DIR=/var/lib/librook/uploads /var/www/librook-api/scripts/backup-uploads.sh
   ```

## Backup y restauración

`scripts/backup-uploads.sh` genera `uploads_AAAAMMDD_HHMMSS.tar.gz` en `BACKUP_DIR`
(por defecto `/root/librook-backups/uploads`, `0700`) y conserva 14 días. Las tablas
`uploads` y `marketplace_listings` van con el backup habitual de la base.

Restaurar: `tar xzf uploads_<fecha>.tar.gz -C /var/lib/librook/uploads` (con la base del mismo
momento, para que los nombres coincidan). Las imágenes que queden sin registro las borra la
limpieza.

## Estimación de espacio

Con fotos reducidas a 1600 px en JPEG (~200–600 KB): 1000 publicaciones × 3 fotos ≈ 1–2 GB.
El cupo por usuaria (60 MB) acota el peor caso por cuenta.
