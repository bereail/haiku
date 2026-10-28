# Continuidad del proyecto — Haiku

> Este archivo existe para que cualquiera (vos, en una sesión nueva; o Claude, sin memoria de
> conversaciones anteriores) pueda retomar el lanzamiento de Haiku sin tener que releer todo
> el historial de chat. Se actualiza cuando cambia algo importante — no es una bitácora
> detallada (eso vive en el panel, ver abajo).

## El panel de administración local

`admin-local/index.html` es el centro de control del lanzamiento: hoja de ruta en 7 fases,
tareas con estado y evidencia, bitácora, decisiones y métricas de validación con lectores
reales. Está pensado para abrirse y entenderse en segundos, y para que lo uses vos sola sin
depender de Claude para cada actualización.

**Cómo abrirlo:** hacé doble clic en `admin-local/index.html` (o abrilo desde el navegador con
`Archivo > Abrir`). No necesita servidor, backend ni conexión — es HTML/CSS/JS plano, sin
dependencias externas.

**Dónde viven los datos:** en el `localStorage` del navegador que uses para abrirlo, scopeado a
ese archivo (`file://.../admin-local/index.html`). Eso significa:
- Si lo abrís siempre desde el mismo navegador en esta máquina, tus cambios persisten solos.
- Si cambiás de navegador o de computadora, **no se sincroniza solo** — hay que exportar un
  respaldo en JSON (botón en la pestaña Configuración) e importarlo en el otro lado.
- El panel guarda automáticamente una copia de respaldo antes de cada importación o reinicio,
  restaurable con un botón.
- No se guarda ninguna contraseña, token ni dato personal sensible ahí — no hace falta, y no
  está pensado para eso.

**Funcionalidades reales, probadas en esta sesión (27/10/2026):**
- Navegación entre las 7 secciones (Inicio, Hoja de ruta, Tareas, Bitácora, Decisiones,
  Métricas, Configuración).
- Cambiar el estado de una tarea (select), editar sus notas, filtrar/buscar en Tareas (bug real
  encontrado y corregido: el buscador perdía el foco en cada tecla porque el render completo
  reconstruía el input — ahora solo se actualiza la lista de resultados).
- Agregar/borrar entradas de Bitácora, agregar/borrar Decisiones, registrar una métrica.
- Exportar JSON (descarga real, validada abriendo el archivo), importar JSON con vista previa
  antes de confirmar, manejo de archivo inválido sin romper nada, respaldo automático antes de
  importar o reiniciar, y restauración de ese respaldo — los tres flujos probados de punta a
  punta.
- Tema claro/oscuro/automático, sin errores de consola en ninguna pantalla.
- Responsive: sin desbordamiento horizontal probado en 320/390/480/768/1024px (vía iframes —
  la herramienta de redimensionar ventana del navegador de este entorno no tiene efecto real,
  ya documentado en una sesión anterior del proyecto principal); el layout mobile (barra
  superior) se confirmó activo por debajo de 860px.

**No probado:** no hay forma de simular en este entorno que se quede sin espacio de
almacenamiento o que `localStorage` esté bloqueado (modo privado); el código tiene manejo de
ese caso (banner de aviso) pero no se pudo forzar el escenario para verlo en pantalla.

## Estado real de Haiku al 27/10/2026 (resumen — el detalle vive en el panel)

- **Hoja de ruta: 9 de 38 tareas completadas (24%)**, fase actual: Fase 1 (Auditoría y
  preparación) — casi cerrada, falta confirmar contra la Fase 2.
- **Bloqueo activo:** las fotos del Mercado de libros no funcionan en producción porque
  `UPLOADS_DIR` no está configurado en el VPS. Es la próxima acción recomendada en el panel.
- **Catálogo público:** existe y funciona, pero está vacío en producción — el backfill de
  ediciones nunca se corrió contra datos reales.
- **Decisión abierta y marcada como contradicción a revisar:** producción ya tiene usuarios
  reales según el último backup (5 usuarios, 15 libros, 21/10/2026) — hay que confirmar con
  Berenice si son cuentas de prueba propias o ya hay lectores de verdad, antes de tratar el
  "primer lanzamiento" como si todavía no hubiera nadie.
- Fases 4 a 7 (identidad/redes, primeros lectores, validación, crecimiento) están 100%
  pendientes — todavía no se hizo nada de difusión real.

## Riesgos y bloqueos conocidos

- `UPLOADS_DIR` sin configurar en el VPS (bloquea Mercado con fotos en producción).
- Dominio actual (`ailonline.com.ar/haiku`) no es exclusivo del proyecto — decisión de
  dominio/alojamiento para el lanzamiento público sigue abierta.
- Escaneo de ISBN y OCR de tapas nunca se probaron en un celular físico real.
- Contacto opcional en una publicación del Mercado — sin decidir si debería ser obligatorio.

## Próxima acción recomendada

Decidir y configurar el almacenamiento de fotos del Mercado en el VPS (`UPLOADS_DIR`) — hoy
es lo único que bloquea probar venta/intercambio con fotos en producción, y es un paso chico y
concreto antes de pasar a identidad/comunicación y primeros lectores.

## Archivos relevantes

- `admin-local/index.html` — el panel (este documento lo acompaña, no lo duplica).
- `DOCUMENTACION.md` — qué hace Haiku hoy y qué le falta (fuente de varios de los gaps del
  panel).
- `docs/arquitectura-catalogo-publico.md`, `docs/marketplace-imagenes.md`,
  `docs/reconocimiento-libros.md` — specs de diseño de esas features.
- `deploy.sh` — checklist de despliegue ya hecho código (no ejecutar sin autorización explícita).

## Qué se tocó en esta sesión

Se creó `admin-local/index.html` y este `CONTINUE.md`, commiteados y pusheados a `main`
(deploy automático confirmado exitoso). No se modificó ningún archivo de la aplicación
(`src/`, `server/`, etc.) ni se tocó el VPS — solo lectura para auditar el estado real antes
de construir el panel.

Después, se avanzó en la Fase 4 (identidad y comunicación) — la única fase pendiente que no
depende del VPS ni de producción, dentro de los límites de esta sesión. Se creó
`docs/identidad-lanzamiento.md` con un primer borrador de propuesta de valor, descripción/bio
para redes, identidad visual (reutilizando los tokens reales de la dirección "Segunda edición",
no colores inventados) y una presentación de una página del proyecto. Se actualizaron los
datos de partida de `admin-local/index.html` para reflejarlo (f4-1 y f4-3 en curso, f4-5
completada) — **importante:** esto solo afecta a quien abra el panel por primera vez o lo
reinicie; si ya lo abriste y tenés cambios guardados en tu navegador, esos 3 estados no se van
a actualizar solos ahí — marcalos vos a mano, o fijate en `docs/identidad-lanzamiento.md`
directamente.

**Próximo paso sugerido dentro de Fase 4:** que Berenice revise y recorte
`docs/identidad-lanzamiento.md`, y decida si quiere avanzar con f4-2 (crear el Instagram) —
eso sí implica una cuenta real en un servicio externo, fuera del alcance de lo que se puede
hacer de forma autónoma.
