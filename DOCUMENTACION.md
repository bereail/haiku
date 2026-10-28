# Documentación de Haiku

> Qué hace la app hoy, qué le falta de verdad, y las apps más parecidas que existen.
> Generado a partir del estado real del código (octubre 2026) — no es un folleto de marketing.

Haiku es tu biblioteca personal, en texto propio. Registrás lo que leíste, lo que estás
leyendo y lo que querés leer — a mano, por voz, escaneando el código de barras o con una foto
de la tapa. A partir de ahí, lo que quieras compartir pasa a una comunidad de lectoras, a un
catálogo público, o a un mercado para vender e intercambiar libros usados.

## Índice

1. [Biblioteca personal](#1-biblioteca-personal)
2. [Reconocimiento de libros](#2-reconocimiento-de-libros)
3. [Comunidad](#3-comunidad)
4. [Catálogo público](#4-catálogo-público)
5. [Mercado de libros](#5-mercado-de-libros)
6. [Cuenta, admin y acceso](#6-cuenta-admin-y-acceso)
7. [Cómo está hecho](#7-cómo-está-hecho)
8. [Lo que falta](#8-lo-que-falta)
9. [Las 3 apps más parecidas](#9-las-3-apps-más-parecidas)

---

## 1. Biblioteca personal

El núcleo de la app: cada libro es una ficha editable con estado de lectura, puntaje y una
anotación privada.

- **Cuatro formas de cargar un libro**: a mano con un formulario completo, buscando por
  título/autor en Open Library con guardado de un toque ("Leído" / "Pendiente"), diciéndolo en
  voz alta ("Terminé Rayuela de Cortázar"), o escaneando el ISBN con la cámara. La carga por voz
  entiende estado, puntaje y una reseña corta en la misma frase, y evita duplicar un libro que
  ya tenías.
- **Estados y organización**: Pendiente, Leyendo, Leído o Abandonado, con fechas de inicio/fin,
  puntaje de 1 a 5, "lo volvería a leer" y una meta anual de libros leídos. Filtros por estado,
  editorial, autor, género y favoritos, búsqueda por título/autor, y orden por fecha o puntaje.
- **Notas privadas**: cada libro tiene una anotación que solo ves vos — nunca sale de tu cuenta
  salvo que decidas compartirla puntualmente en la Comunidad.
- **Exportar e importar**: un backup en JSON (para volver a importarlo, sin duplicar lo que ya
  tenías) y una versión en HTML para leer o archivar fuera de la app.
- **Estadísticas**: libros leídos por año, autores y géneros más frecuentes, promedio de
  puntaje.

## 2. Reconocimiento de libros

Todo corre en el navegador: ni el video de la cámara ni la foto de la tapa salen de tu
dispositivo.

- **Escaneo de ISBN**: lector nativo del navegador donde está disponible, con un lector por
  software (ZXing) como respaldo en los navegadores que no lo traen — funciona en Chrome,
  Firefox y Safari por igual. Valida que el código sea un ISBN de libro de verdad antes de
  buscarlo, y apaga la cámara apenas termina o si cerrás el escáner.
- **Identificar por la foto de la tapa**: reconocimiento de texto local (Tesseract.js, sin
  mandar la foto a ningún servidor) sobre la tapa, que después se busca en Open Library. El
  texto reconocido siempre es editable y hay que confirmar el candidato — nunca completa el
  libro solo. No es infalible con tapas reales (reflejos, tipografías decorativas): siempre se
  puede "volver a fotografiar" o buscar a mano.

## 3. Comunidad

Una reseña pública por libro, completamente separada de tu biblioteca y de tus notas privadas.

- **Compartir una reflexión**: tu anotación de un libro se puede publicar como reflexión
  pública, con tu puntaje y la tapa — con un alias, nunca tu email. Se puede dejar de compartir
  en cualquier momento.
- **Me gusta y comentarios**: cualquier persona con cuenta puede reaccionar y comentar en
  reflexiones ajenas. Cada una borra sólo lo propio; la administradora puede moderar contenido
  de cualquiera.

## 4. Catálogo público

La única parte de Haiku visible sin crear cuenta. Búsqueda pública de libros (con las fichas
propias primero, Open Library como respaldo) y una página por obra que muestra cuántas
lectoras la tienen y las reflexiones que se compartieron sobre ella — nunca biblioteca
privada, fechas ni notas de nadie.

## 5. Mercado de libros

Venta e intercambio entre lectoras, completamente aparte de las reseñas de Comunidad.

- **Publicar, editar, pausar**: venta (con precio) o intercambio, estado del ejemplar, hasta 4
  fotos, ciudad/barrio y un dato de contacto a elección — buscable por título o autor,
  filtrable por tipo.
- **Fotos cuidadas**: se valida que el archivo sea realmente una imagen (no solo por su
  nombre), se le borra la ubicación GPS y otros metadatos, y se guarda con un nombre al azar —
  nunca el nombre original del archivo.

## 6. Cuenta, admin y acceso

- **Tutorial guiado**: un recorrido sobre la interfaz real (no capturas) la primera vez que
  entrás, con pasos de práctica sobre los botones de verdad. Se puede repetir cuando quieras.
- **Biblioteca de ejemplo**: "Ver sin cuenta" muestra una biblioteca ya cargada en modo solo
  lectura — se puede mirar todo, pero ningún cambio se guarda.
- **Panel de administración**: visitas totales, de hoy y de la semana, picos por hora y por
  día, navegadores y dispositivos, y la lista de usuarias con sus libros — visible solo para
  la cuenta administradora.
- **Seguridad de la cuenta**: recuperación de contraseña por mail con enlaces de un solo uso,
  cambiar la contraseña cierra cualquier otra sesión abierta, y un límite de intentos en login
  y registro.

## 7. Cómo está hecho

Para quien quiera el detalle: nada de esto hace falta para usar Haiku.

| | |
|---|---|
| Pruebas end-to-end | 161 |
| Pruebas unitarias | 256 |
| Vulnerabilidades conocidas | 0 |
| Temas | claro / oscuro |

- **Frontend**: React + TypeScript, sin backend-as-a-service: el enrutado, el estado y el tema
  son propios. Funciona como PWA (se puede instalar) y es responsive de punta a punta.
- **Backend**: API propia en Node/Express sobre PostgreSQL, con un servicio systemd en un VPS.
  Cada ruta valida el usuario a nivel de base de datos, no solo en la pantalla.
- **Calidad**: accesibilidad verificada con axe-core (contraste, foco, nombres accesibles)
  sobre las pantallas y los modales reales, y responsive probado en viewports de celular. Cada
  cambio importante se verifica con la suite completa antes de desplegarse.

## 8. Lo que falta

Ni promesas vacías ni una lista para asustar — esto es lo que hoy está incompleto de verdad,
con la razón exacta.

- **El catálogo público está vacío en producción.** Existe y funciona, pero el proceso que
  llena las fichas de obras a partir de los libros con ISBN cargado nunca se corrió contra los
  datos reales — así que hoy toda búsqueda ahí cae en Open Library, no en fichas propias.
- **Subir fotos al Mercado no está habilitado en el servidor real.** El código está listo y
  probado, pero la carpeta de almacenamiento todavía no se configuró en el VPS de producción —
  por ahora, publicar con fotos ahí no funciona (sí en el entorno local).
- **El contacto en una publicación del Mercado es opcional.** Se puede publicar un libro en
  venta o intercambio sin dejar ninguna forma de que te contacten. Puede ser intencional
  (nadie está obligado a compartir un dato propio) — falta decidir si conviene exigirlo.
- **El escaneo de ISBN y el OCR de tapas nunca se probaron en un celular físico.** Sí se
  probaron a fondo con cámara y fotos simuladas. Falta la prueba real: luz de ambiente,
  reflejos en la tapa, cámaras de gama media/baja.

## 9. Las 3 apps más parecidas

No por tamaño, sino por hacer una combinación de cosas más cercana a la de Haiku —
biblioteca propia, reseñas entre lectoras y (en un caso) intercambio de libros físicos.

### ① The StoryGraph — la más parecida en el día a día

Seguimiento personal + estadísticas de lectura. Es la alternativa independiente a Goodreads
que más se usa hoy: registrás lo que leíste, metas anuales, estados de lectura y estadísticas
detalladas de tu año lector — el mismo corazón que tiene la Biblioteca de Haiku. Lo que no
tiene: catálogo navegable sin cuenta, ni nada parecido a un mercado de libros usados.

### ② Bookwyrm — la más parecida en filosofía

Comunidad de reseñas, sin publicidad ni venta de datos. Proyecto chico y de código abierto,
pensado como una red social de lectoras sin fines de lucro — reseñas, estanterías propias y
comentarios entre usuarias, igual que la Comunidad de Haiku. Lo que no tiene: reconocimiento
de libros por cámara/foto ni mercado de compraventa.

### ③ LibraryThing — la más parecida en el Mercado

Catalogación personal + intercambio entre miembros. Cataloga tu biblioteca con el mismo
detalle (editorial, género, puntaje) y tiene una tradición larga de intercambiar libros entre
sus miembros — la pieza que en Haiku es el Mercado de venta e intercambio. Lo que no tiene:
carga por voz ni escaneo de ISBN con la cámara del celular.

| Función | Haiku | StoryGraph | Bookwyrm | LibraryThing |
|---|---|---|---|---|
| Biblioteca + estados de lectura | Sí | Sí | Sí | Sí |
| Reseñas/comunidad entre usuarias | Sí | Parcial | Sí | Parcial |
| Catálogo público sin cuenta | Sí | No | Parcial | No |
| Venta/intercambio de libros físicos | Sí | No | No | Sí |
| Alta por voz / cámara | Sí | No | No | No |
