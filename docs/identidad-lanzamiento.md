# Identidad y comunicación — Haiku

> Borrador de trabajo para la Fase 4 del lanzamiento (ver `admin-local/index.html`). Pensado
> para que Berenice lo edite y recorte — no es un texto final, es un punto de partida real,
> basado en lo que Haiku hace hoy (`DOCUMENTACION.md`), no en lo que podría hacer algún día.

## 1. Propuesta de valor

**Una línea:**
> Tu biblioteca, en texto propio — y una comunidad de lectoras cerca tuyo para compartir,
> descubrir y pasarse libros de mano en mano.

**Por qué importa (el problema real):**
Las listas de "libros para leer" sueltas en notas o apps genéricas se pierden fácil y no
registran nada del recorrido de lectura. Haiku junta en un solo lugar lo que ya hacían tres
apps separadas — llevar tu biblioteca, compartir reseñas con otras lectoras, y vender o
intercambiar libros usados — pensado desde el principio para que cargar un libro sea rápido: a
mano, por voz, escaneando el código de barras o con una foto de la tapa.

**Lo que lo distingue de las alternativas** (ver la comparación completa en
`DOCUMENTACION.md`, sección 9):
- Es la única de las apps parecidas que junta biblioteca personal + comunidad de reseñas +
  mercado de intercambio en un mismo lugar.
- Carga por voz y por cámara — ninguna de las tres apps más parecidas (StoryGraph, Bookwyrm,
  LibraryThing) lo tiene.
- Pensada para intercambio presencial real, no solo catalogación — con la mira puesta en
  Rosario y Granadero Baigorria para arrancar.

## 2. Descripción corta (para bio / enlaces)

**Para Instagram (150 caracteres aprox.):**
> 📚 Tu biblioteca personal + una comunidad de lectoras. Compartí reseñas, descubrí libros y
> vendé o intercambiá los tuyos. Arrancando en Rosario y alrededores.

**Versión sin emoji, para un enlace o firma:**
> Haiku: biblioteca personal, comunidad de lectoras y mercado de intercambio de libros
> usados, todo en un mismo lugar.

**Una frase más larga, para una publicación de presentación:**
> Haiku es donde registro lo que leo, descubro lo que leen otras, y encuentro (o le doy una
> segunda vida a) libros usados — hecho pensando en lectoras de Rosario y alrededores.

## 3. Identidad visual (reutilizar lo que ya existe, no crear de cero)

La app ya tiene una dirección visual propia, "Segunda edición" (desplegada en producción desde
el 21-22/10/2026). Para redes, usar los mismos tokens — no inventar una paleta nueva:

| Uso | Token | Valor |
|---|---|---|
| Color principal | `--color-accent` | `#2d4a3e` (verde oscuro) |
| Color principal, modo oscuro | `--color-accent` (dark) | `#457a63` |
| Fondo | `--color-bg` | `#faf9f7` (crema) |
| Contenido externo / Open Library | `--color-slate` | `#52677a` |
| Títulos | `--font-serif` | Playfair Display |
| Texto de lectura (reseñas, citas) | `--font-read` | Source Serif 4 |
| Interfaz / UI | `--font-sans` | Inter |

**Para publicaciones y stories:** título en Playfair Display, texto de acompañamiento en
Source Serif 4 (si es una cita o reseña) o Inter (si es informativo/UI). Fondo crema o verde
oscuro — nunca un tercer color de fondo nuevo. Evitar gradientes (no es parte del sistema
visual de la app).

**Logo/ícono:** no existe uno dedicado para redes todavía — hoy la app usa un ícono genérico de
libro para el manifest PWA (`public/`). Si se quiere algo más distintivo para Instagram, es una
tarea aparte, chica, que no estaba en el alcance de esta sesión.

## 4. Presentación sencilla del proyecto (para compartir con alguien nuevo)

> **Haiku — tu biblioteca, en texto propio**
>
> Registrás lo que leíste, lo que estás leyendo y lo que querés leer — a mano, por voz,
> escaneando el código de barras o con una foto de la tapa. A partir de ahí, lo que quieras
> compartir pasa a una comunidad de lectoras, a un catálogo público, o a un mercado para vender
> e intercambiar libros usados.
>
> **Qué podés hacer hoy:**
> - Llevar tu biblioteca con estados de lectura, puntaje, fechas y notas privadas.
> - Compartir una reflexión sobre un libro con otras lectoras — con alias, nunca tu email.
> - Buscar en un catálogo público, sin necesidad de cuenta.
> - Publicar un libro en venta o intercambio, con fotos, y coordinar el contacto a tu manera.
> - Instalarla en el celular como una app (PWA), con modo oscuro.
>
> **Dónde está hoy:** [ailonline.com.ar/haiku](https://ailonline.com.ar/haiku) — en uso,
> todavía puliendo detalles antes de una difusión más amplia.

(Fuente completa y detallada: `DOCUMENTACION.md` en la raíz del repo.)

## 5. Qué falta para que esto se use de verdad

No es parte de esta Fase 4, pero conecta directo: antes de invitar gente de Rosario a usarla
en serio, conviene resolver el bloqueo activo del Mercado (fotos no funcionan en producción
todavía — `UPLOADS_DIR` sin configurar en el VPS) y decidir si el dominio actual
(`ailonline.com.ar/haiku`) es el que se quiere usar para la difusión, o si conviene uno
propio. Ver `admin-local/index.html` → Hoja de ruta → Fase 3.

---
*Borrador generado el 2026-10-27 a partir de `DOCUMENTACION.md` y los tokens reales de
`src/styles/global.css` — no se inventó ningún dato sobre lo que la app hace o no hace.*
