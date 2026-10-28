# Imágenes del marketplace: almacenamiento, seguridad y operación

Las fotos de las publicaciones se guardan en el disco del VPS existente (sin servicios
externos ni costos recurrentes).

## Cómo funciona

| Aspecto | Decisión |
|---|---|
| Dónde | `UPLOADS_DIR` (fuera del webroot). nginx **no** la sirve: las imágenes salen solo por la API (`GET /haiku-api/uploads/<nombre>`). |
| Subida | `POST /haiku-api/uploads` con la imagen cruda (sin multipart, sin dependencias). Requiere sesión; la cuenta demo no puede. |
| Validación | Tipo por firma binaria (JPEG/PNG/WebP; nunca por extensión ni por el Content-Type), dimensiones del encabezado, 50–6000 px por lado, 25 M píxeles, 5 MB. HTML, SVG, GIF, etc. se rechazan. |
| Privacidad | Se quitan EXIF (incluida la **ubicación GPS** de las fotos de celular), XMP, IPTC y comentarios. Además el navegador achica la foto (1600 px, JPEG) antes de subirla. |
| Nombres | 128 bits aleatorios (`<32 hex>.jpg|png|webp`). Se escriben con `wx` (nunca pisan otro archivo). Solo se sirve lo registrado en la base; cualquier otro nombre da 404 sin tocar el disco (sin path traversal). |
| Permisos | Carpeta `0700`, archivos `0600`, del usuario que corre la API. Al arrancar se verifica que se pueda escribir y se avisa si la carpeta tiene permisos más abiertos que `700`. |
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
   du -sh /var/www/haiku-api /var/www/html/haiku
   ```
2. **Crear la carpeta** fuera del webroot, del usuario del servicio `haiku-api`
   (ver `User=` en `systemctl cat haiku-api`):
   ```
   mkdir -p /var/lib/haiku/uploads
   chown <usuario-del-servicio>: /var/lib/haiku/uploads
   chmod 700 /var/lib/haiku/uploads
   ```
3. En `/var/www/haiku-api/.env`: `UPLOADS_DIR=/var/lib/haiku/uploads` y reiniciar
   `haiku-api`. **Es obligatoria**: tiene que ser una ruta absoluta, fuera de `/var/www`
   (lo sirve nginx) y fuera del código de la API (cada deploy lo reemplaza). Si falta o no
   cumple eso, la API arranca igual pero **deshabilita solo la subida de fotos** (responde
   503 "no está disponible por ahora"), lo dice en el log al arrancar
   (`journalctl -u haiku-api | grep uploads`) y `/health` devuelve `"uploads": false`;
   `deploy.sh` muestra un AVISO en ese caso. En una copia de desarrollo (con `.git`) el
   valor por defecto es `<repo>/.uploads`.
4. **nginx**: el límite por defecto de un pedido es 1 MB (`client_max_body_size`). El
   navegador apunta a fotos de menos de 900 KB, así que funciona sin cambios; si se quiere
   aceptar fotos más pesadas, subirlo solo para `/haiku-api/uploads` (máximo 6m).
5. **Cron** (diario):
   ```
   10 3 * * * cd /var/www/haiku-api && node scripts/cleanup-uploads.js
   15 3 * * * /var/www/haiku-api/scripts/backup-uploads.sh
   ```

## Backup y restauración

`scripts/backup-uploads.sh` respalda la misma carpeta que usa la API: toma `UPLOADS_DIR` del
entorno o, si no está, del `.env` de la API (no tiene un valor por defecto propio; si no la
encuentra o no es absoluta, sale con error). Genera `uploads_AAAAMMDD_HHMMSS.tar.gz` en `BACKUP_DIR`
(por defecto `/root/haiku-backups/uploads`, `0700`) y conserva 14 días. Las tablas
`uploads` y `marketplace_listings` van con el backup habitual de la base.

Restaurar: `tar xzf uploads_<fecha>.tar.gz -C /var/lib/haiku/uploads` (con la base del mismo
momento, para que los nombres coincidan). Las imágenes que queden sin registro las borra la
limpieza.

## Estimación de espacio

Con fotos reducidas a 1600 px en JPEG (~200–600 KB): 1000 publicaciones × 3 fotos ≈ 1–2 GB.
El cupo por usuaria (60 MB) acota el peor caso por cuenta.
