// Estado y persistencia del panel. Todo vive en localStorage del navegador (sin backend propio
// para este panel — es una herramienta local de Berenice, admin-local/ no se despliega al VPS).
//
// Esquema v1 (hasta hoy): tareas/fases/bitácora/decisiones/métricas/estética sueltas.
// Esquema v2 (este cambio): las 10 secciones del panel integral. migrateV1toV2() traslada todo
// lo que Berenice ya cargó (38 tareas reales, 8 entradas de bitácora, 6 decisiones, la paleta
// roja/negra/blanca) sin perder nada; las secciones nuevas que v1 no tenía arrancan con datos
// semilla basados en hechos reales del repo (ver cada *_SEED más abajo) — nunca inventados.
(function(){
  "use strict";
  var U = window.Haiku.utils;

  var STORAGE_KEY = "haiku_admin_panel_v2";
  var OLD_STORAGE_KEY = "haiku_admin_panel_v1";
  var BACKUP_KEY = "haiku_admin_panel_v2_backup";
  var THEME_KEY = "haiku_admin_panel_theme";

  var PHASES = [
    {id:"f1", name:"Fase 1 — Auditoría y preparación"},
    {id:"f2", name:"Fase 2 — Preparación del producto"},
    {id:"f3", name:"Fase 3 — Publicación técnica"},
    {id:"f4", name:"Fase 4 — Identidad y comunicación"},
    {id:"f5", name:"Fase 5 — Primeros lectores"},
    {id:"f6", name:"Fase 6 — Validación"},
    {id:"f7", name:"Fase 7 — Crecimiento"}
  ];

  var METRIC_LABELS = {
    invited:"Personas invitadas",
    registered:"Usuarios registrados",
    publishedBook:"Publicaron al menos un libro",
    usefulAction:"Realizaron una acción útil",
    contacts:"Contactos entre lectores",
    exchanges:"Intercambios concretados",
    returned:"Usuarios que regresaron"
  };

  // ---------- Semilla real (auditoría del 27/10/2026) — igual a la del panel v1 ----------
  function seedRoadmap(){
    return {
      project: {
        name: "Haiku",
        lastUpdated: "2026-10-27",
        nextAction: {
          text: "Decidir y configurar el almacenamiento de fotos del Mercado en el VPS (UPLOADS_DIR) — hoy bloquea probar venta/intercambio con fotos en producción.",
          taskId: "f2-3"
        }
      },
      tasks: [
        {id:"f1-1",phaseId:"f1",name:"Revisar el estado funcional de Haiku",priority:"alta",status:"completada",updatedAt:"2026-10-27",desc:"Confirmar que build, lint y las pruebas automatizadas pasan antes de dar nada por cerrado.",evidence:"Build OK, lint 0 errores (6 warnings preexistentes), 104/104 tests unitarios frontend, 154/155 backend (1 skip preexistente), 161/161 E2E — corridos el 27/10/2026.",notes:"",dependsOn:""},
        {id:"f1-2",phaseId:"f1",name:"Verificar que las funcionalidades principales existen de verdad",priority:"alta",status:"completada",updatedAt:"2026-10-27",desc:"Biblioteca, reconocimiento de libros, Comunidad, Catálogo público y Mercado.",evidence:"Código confirmado en src/ y server/routes/ para las 5 áreas; DOCUMENTACION.md las describe con el mismo detalle.",notes:"",dependsOn:""},
        {id:"f1-3",phaseId:"f1",name:"Comprobar pruebas y errores pendientes",priority:"media",status:"completada",updatedAt:"2026-10-27",desc:"",evidence:"Mismo run del 27/10. Backend tiene 1 test marcado skip desde antes — no investigado, bajo riesgo.",notes:"",dependsOn:""},
        {id:"f1-4",phaseId:"f1",name:"Revisar seguridad, privacidad y permisos",priority:"alta",status:"completada",updatedAt:"2026-10-27",desc:"Aislamiento entre usuarias, modo demo de solo lectura, sesión vencida/inválida.",evidence:"e2e/security-isolation.spec.ts, security-demo.spec.ts, security-admin.spec.ts, session-expired.spec.ts — todos pasan.",notes:"",dependsOn:""},
        {id:"f1-5",phaseId:"f1",name:"Confirmar qué falta realmente para una prueba con usuarios",priority:"alta",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"Quedan 4 huecos documentados en DOCUMENTACION.md (sección 8): catálogo público vacío en producción, fotos del Mercado no habilitadas en el servidor real, contacto opcional sin decidir, y escaneo/OCR nunca probado en un celular físico. Ver Fase 2.",dependsOn:""},

        {id:"f2-1",phaseId:"f2",name:"Revisar registro e inicio de sesión",priority:"alta",status:"completada",updatedAt:"2026-10-21",desc:"",evidence:"auth.spec.ts y session-expired.spec.ts pasan; rate limit de /auth/* confirmado en producción (429 pasados 20 intentos/15min).",notes:"",dependsOn:""},
        {id:"f2-2",phaseId:"f2",name:"Verificar catálogo, fichas y publicación de libros",priority:"alta",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:"catalog.spec.ts y work-page.spec.ts pasan.",notes:"El catálogo público está VACÍO en producción: el backfill que llena las fichas de obra a partir de los libros con ISBN nunca se corrió contra datos reales. Hoy toda búsqueda cae en Open Library.",dependsOn:"Decisión: cuándo correr el backfill contra producción"},
        {id:"f2-3",phaseId:"f2",name:"Comprobar venta, intercambio y contacto entre usuarios",priority:"alta",status:"bloqueada",updatedAt:"2026-10-27",desc:"",evidence:"marketplace-api.spec.ts y marketplace-ui.spec.ts pasan en local.",notes:"Bloqueo real: subir fotos al Mercado no funciona en producción — la carpeta UPLOADS_DIR no está configurada en el VPS (queda comentada/opcional en server/.env.example). Además, el dato de contacto sigue siendo opcional (ver Decisiones).",dependsOn:"f3-6 (almacenamiento de imágenes en el VPS)"},
        {id:"f2-4",phaseId:"f2",name:"Revisar experiencia móvil",priority:"media",status:"en-curso",updatedAt:"2026-10-22",desc:"",evidence:"mobile.spec.ts pasa; desbordes horizontales reales encontrados y corregidos en 8 viewports (320–1440px) en una sesión anterior.",notes:"El escaneo de ISBN y el OCR de tapa nunca se probaron en un celular físico — solo con cámara y fotos simuladas.",dependsOn:""},
        {id:"f2-5",phaseId:"f2",name:"Terminar o validar el tutorial de bienvenida",priority:"media",status:"completada",updatedAt:"2026-10-26",desc:"",evidence:"tour.spec.ts: 8 casos (roles, mobile, accesibilidad, reduced-motion) — todos pasan.",notes:"",dependsOn:""},
        {id:"f2-6",phaseId:"f2",name:"Identificar fricciones para una persona que usa la app por primera vez",priority:"alta",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"Todavía no hubo ninguna sesión de uso con una persona ajena al desarrollo — solo cuentas de prueba técnicas.",dependsOn:""},

        {id:"f3-1",phaseId:"f3",name:"Evaluar el alojamiento existente y las alternativas gratuitas",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"Ya hay un VPS propio funcionando (detrás de Cloudflare) y en uso — no se compararon alternativas gratuitas. Decisión pendiente: ¿conviene mantenerlo para el lanzamiento con lectores reales?",dependsOn:""},
        {id:"f3-2",phaseId:"f3",name:"Revisar compatibilidad con backend y PostgreSQL",priority:"baja",status:"completada",updatedAt:"2026-10-21",desc:"",evidence:"Postgres 14.24 en el VPS vs 17 en local — compatibles, confirmado con un dump/restore real.",notes:"",dependsOn:""},
        {id:"f3-3",phaseId:"f3",name:"Evaluar dominio gratuito, subdominio y eventual dominio propio",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"Hoy corre bajo ailonline.com.ar/haiku — un dominio que no es exclusivo del proyecto. Sin decisión tomada.",dependsOn:""},
        {id:"f3-4",phaseId:"f3",name:"Preparar configuración de producción sin exponer secretos",priority:"media",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:".env.example en ambas carpetas sin secretos reales.",notes:"deploy.sh pasa DATABASE_URL completo como argumento de psql en las migraciones inline — funciona, pero queda visible en ps aux del VPS (riesgo bajo: solo root tiene shell ahí). No es la práctica más prolija.",dependsOn:""},
        {id:"f3-5",phaseId:"f3",name:"Definir copias de seguridad y recuperación",priority:"alta",status:"completada",updatedAt:"2026-10-21",desc:"",evidence:"Backup real de producción hecho y restaurado en una base aislada para comparar conteos (2026-10-21); procedimiento con nombre de archivo exacto (sin glob) documentado.",notes:"",dependsOn:""},
        {id:"f3-6",phaseId:"f3",name:"Verificar HTTPS, autenticación, permisos y almacenamiento de imágenes",priority:"alta",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:"HTTPS (Cloudflare + nginx), autenticación y permisos por usuario ya verificados en producción real.",notes:"Falta: configurar el almacenamiento de imágenes del Mercado (UPLOADS_DIR) en el VPS — hoy no está habilitado ahí. Ver f2-3.",dependsOn:""},
        {id:"f3-7",phaseId:"f3",name:"Preparar un checklist de despliegue",priority:"media",status:"completada",updatedAt:"2026-10-21",desc:"",evidence:"deploy.sh con set -euo pipefail, backup automático antes de copiar archivos, doble health check (API + base) y rollback automático de código si falla — confirmado funcionando en despliegues reales.",notes:"",dependsOn:""},

        {id:"f4-1",phaseId:"f4",name:"Definir la propuesta de valor",priority:"alta",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:"Primer borrador en docs/identidad-lanzamiento.md (sección 1), a partir de DOCUMENTACION.md — nada inventado.",notes:"Falta que Berenice lo lea, recorte y confirme la versión final.",dependsOn:""},
        {id:"f4-2",phaseId:"f4",name:"Preparar un Instagram propio de Haiku",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},
        {id:"f4-3",phaseId:"f4",name:"Definir descripción, identidad visual y enlace",priority:"media",status:"en-curso",updatedAt:"2026-10-27",desc:"",evidence:"Bio corta para Instagram y tabla de tokens reales (color/tipografía) reutilizados del sistema visual 'Segunda edición' en docs/identidad-lanzamiento.md (secciones 2 y 3).",notes:"No existe todavía un logo/ícono dedicado para redes — la app usa un ícono genérico de libro en el manifest PWA. Nueva paleta elegida por Berenice: rojo, negro y blanco, con una línea abstracta (ver Identidad visual).",dependsOn:""},
        {id:"f4-4",phaseId:"f4",name:"Crear las primeras publicaciones",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},
        {id:"f4-5",phaseId:"f4",name:"Preparar una presentación sencilla del proyecto",priority:"baja",status:"completada",updatedAt:"2026-10-27",desc:"",evidence:"Presentación de una página en docs/identidad-lanzamiento.md (sección 4), basada en DOCUMENTACION.md.",notes:"",dependsOn:""},

        {id:"f5-1",phaseId:"f5",name:"Preparar una invitación para lectores de Rosario y alrededores",priority:"alta",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},
        {id:"f5-2",phaseId:"f5",name:"Conseguir los primeros usuarios de prueba",priority:"alta",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"Producción ya tiene usuarios registrados (5, según el backup del 21/10) — falta confirmar si son cuentas de prueba propias o lectores reales antes de contarlos como 'primeros lectores'. Ver Decisiones.",dependsOn:""},
        {id:"f5-3",phaseId:"f5",name:"Ayudarles a publicar libros y realizar acciones útiles",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},
        {id:"f5-4",phaseId:"f5",name:"Registrar sus dificultades y sugerencias",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},
        {id:"f5-5",phaseId:"f5",name:"Contactar bibliotecas, clubes de lectura y espacios culturales",priority:"baja",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:""},

        {id:"f6-1",phaseId:"f6",name:"Medir registros",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},
        {id:"f6-2",phaseId:"f6",name:"Medir publicaciones de libros",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},
        {id:"f6-3",phaseId:"f6",name:"Medir contactos e intercambios concretados",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},
        {id:"f6-4",phaseId:"f6",name:"Comprobar cuántos usuarios regresan",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},
        {id:"f6-5",phaseId:"f6",name:"Identificar los principales obstáculos",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},
        {id:"f6-6",phaseId:"f6",name:"Priorizar mejoras según evidencia real",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 5"},

        {id:"f7-1",phaseId:"f7",name:"Reforzar los canales que generan usuarios activos",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 6"},
        {id:"f7-2",phaseId:"f7",name:"Mejorar la experiencia a partir del feedback",priority:"media",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 6"},
        {id:"f7-3",phaseId:"f7",name:"Evaluar colaboraciones y actividades presenciales",priority:"baja",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 6"},
        {id:"f7-4",phaseId:"f7",name:"Considerar dominio propio o publicidad solo con una razón concreta",priority:"baja",status:"pendiente",updatedAt:"2026-10-27",desc:"",evidence:"",notes:"",dependsOn:"Fase 6"}
      ],
      log: [
        {id:"l1",date:"2026-08-04",text:"Se agrega la función Comunidad: reflexiones públicas por libro, con comentarios y 'me gusta'.",taskId:null},
        {id:"l2",date:"2026-08-13",text:"Se agrega el modo invitado 'Ver sin cuenta' (biblioteca de ejemplo).",taskId:null},
        {id:"l3",date:"2026-10-21",text:"Auditoría completa: el modo invitado pasa a solo lectura, rate limiting en /auth, diseño y primera implementación del catálogo público (obras/autores/ediciones), backup real de producción y deploy de la dirección visual 'Segunda edición' al catálogo.",taskId:null},
        {id:"l4",date:"2026-10-22",text:"Migración visual al resto de la app + auditoría integral: dependencias a 0 vulnerabilidades, focus-trap en los modales, tablas accesibles para los gráficos del panel de usuarias, revisión con axe-core, Lighthouse de 82 a 97, e inicio de la suite E2E con Playwright.",taskId:null},
        {id:"l5",date:"2026-10-26",text:"Auditoría autónoma: se corrige un bug real (la biblioteca se rompía con un libro sin autor), la suite E2E pasa de 33/161 a 161/161, y se suman el Mercado de libros, el reconocimiento de tapas por OCR, ZXing como respaldo de escaneo, el tutorial guiado y la documentación de producto.",taskId:null},
        {id:"l6",date:"2026-10-27",text:"Se cierra con un PR la sección 'Descubrir' (161/161 E2E, 104/104 unitarios frontend, 154/155 backend) y se mergea a main — deploy automático disparado.",taskId:null},
        {id:"l7",date:"2026-10-27",text:"Se audita el estado real del repo (sin inventar datos) y se crea este panel de administración local como centro de control del lanzamiento.",taskId:null},
        {id:"l8",date:"2026-10-27",text:"Fase 4 (identidad y comunicación): primer borrador de propuesta de valor, descripción/bio e identidad visual (reutilizando los tokens de 'Segunda edición') y una presentación de una página — todo en docs/identidad-lanzamiento.md.",taskId:"f4-1"},
        {id:"l9",date:U.todayISO(),text:"Se amplía el panel local a 10 secciones (Dashboard, Identidad visual, UX, UI, Funcionalidades, Estadísticas, Arquitectura, Testing, SEO, Roadmap) con datos semilla reales del repo. Paleta elegida: rojo, negro y blanco, estilo abstracto.",taskId:null}
      ],
      decisions: [
        {id:"d1",topic:"Vínculo entre ediciones y obras del catálogo",decision:"Vincular solo por identificador real (ISBN o clave de Open Library), nunca por similitud de texto.",reason:"Evitar que se fusionen obras distintas por error.",date:"2026-10-21",status:"confirmada",consequences:"El script de backfill nunca fusiona por texto; las tablas nuevas son aditivas y no tocan los libros existentes."},
        {id:"d2",topic:"Modo invitado ('Ver sin cuenta')",decision:"La cuenta demo compartida queda bloqueada para escritura (403) en el backend.",reason:"Evitar colisiones entre invitados simultáneos y que contaminen el feed de Comunidad.",date:"2026-10-21",status:"confirmada",consequences:"Middleware blockDemoWrites en books/community/settings; probado con 2 cuentas simultáneas."},
        {id:"d3",topic:"Almacenamiento de fotos del Mercado",decision:"Guardarlas en el VPS propio (no un servicio externo), con nombres aleatorios y validación real del archivo.",reason:"Evitar depender de un servicio de pago y mantener control sobre los datos de las usuarias.",date:"2026-10-22",status:"confirmada",consequences:"Falta configurar UPLOADS_DIR en el VPS de producción para que funcione ahí (ver tarea f2-3/f3-6)."},
        {id:"d4",topic:"Reconocimiento de tapas por foto",decision:"Tesseract.js corriendo en el navegador, sin mandar fotos a ningún servidor.",reason:"Gratis y no expone fotos de usuarias a terceros.",date:"2026-10-22",status:"confirmada",consequences:"Carga diferida (lazy-load) para no pesar el bundle inicial; precisión no probada en celulares físicos reales."},
        {id:"d5",topic:"¿El contacto debe ser obligatorio en una publicación del Mercado?",decision:"Sin decidir todavía — hoy es opcional.",reason:"Puede ser intencional (nadie está obligado a compartir un dato propio) o un descuido.",date:"2026-10-26",status:"propuesta",consequences:"Si se decide exigirlo, hay que actualizar MarketplaceModal.tsx, listingInput.js y los E2E que hoy publican sin contacto."},
        {id:"d6",topic:"Dominio y alojamiento para el lanzamiento público",decision:"Sin decidir todavía — hoy corre bajo ailonline.com.ar/haiku.",reason:"Ese dominio no es exclusivo del proyecto; falta confirmar si conviene para una difusión más amplia en Rosario y alrededores.",date:"2026-10-27",status:"propuesta",consequences:"CONTRADICCIÓN A REVISAR: la app ya está desplegada y, según el backup del 21/10, tiene 5 usuarios y 15 libros reales en producción — confirmar si son cuentas de prueba propias o ya hay lectores reales antes de tratar esto como un 'pre-lanzamiento' desde cero."},
        {id:"d7",topic:"Paleta de marca de Haiku",decision:"Fondo negro, rojo como color característico, dorado/amarillo como secundario, blanco reservado para resaltar — sin saturar la vista. Línea de ilustración abstracta (referencias en Identidad visual: estilo Dribbble 'Illustrations store concept', 'RED Book Reader Mobile App', e ícono con forma de 'H').",reason:"Elección directa de Berenice para la identidad visual del lanzamiento.",date:U.todayISO(),status:"propuesta",consequences:"Pendiente aplicar esta paleta al resto de la app (Identidad visual ya la usa como punto de partida: #b03a3a / #c9a227 / #121212); falta definir los tonos exactos y probar contraste en ambos modos."}
      ],
      metrics: {
        counters: {invited:null, registered:null, publishedBook:null, usefulAction:null, contacts:null, exchanges:null, returned:null},
        notes: []
      }
    };
  }

  // ---------- Identidad visual: paleta elegida por Berenice (rojo / negro / blanco, abstracto) ----------
  function seedIdentity(){
    return {
      tokens: {
        primary: "#b03a3a",
        secondary: "#c9a227",
        bg: "#121212",
        radius: 16,
        fontFamily: "sans",
        fontSizeBase: 16
      },
      typeScale: [
        {id:"ts1", name:"Título grande", size:28, weight:700, usage:"Encabezado principal del dashboard"},
        {id:"ts2", name:"Título de sección", size:19, weight:600, usage:"Encabezado de cada sección"},
        {id:"ts3", name:"Cuerpo", size:15, weight:400, usage:"Texto general"},
        {id:"ts4", name:"Auxiliar", size:12.5, weight:400, usage:"Metadatos, ayudas, notas"}
      ],
      spacingScale: [
        {id:"sp1", name:"xs", value:4},
        {id:"sp2", name:"sm", value:8},
        {id:"sp3", name:"md", value:14},
        {id:"sp4", name:"lg", value:20},
        {id:"sp5", name:"xl", value:32}
      ],
      shadowLevels: [
        {id:"sh1", name:"Sutil", value:"0 1px 2px rgba(0,0,0,.05), 0 1px 1px rgba(0,0,0,.03)"},
        {id:"sh2", name:"Elevada", value:"0 4px 14px rgba(0,0,0,.10)"}
      ],
      styleNotes: "Dirección pedida por Berenice: fondo negro, rojo como color característico, dorado/amarillo como secundario, blanco reservado para resaltar (texto/elementos activos) — sin saturar la vista. Estilo abstracto, un poco de dibujo animado.",
      references: [
        {id:"ref1", url:"https://dribbble.com/shots/7140043-Illustrations-store-concept", note:"Referencia de estilo — abstracto, un poco de dibujo animado."},
        {id:"ref2", url:"https://dribbble.com/shots/25472131-RED-Book-Reader-Mobile-App", note:"Le gusta mucho este estilo (app de lectura en rojo)."},
        {id:"ref3", url:"https://dribbble.com/shots/14428909-book", note:"Referencia de ícono — algo así, pero que forme más una 'H' (de Haiku)."}
      ]
    };
  }

  // ---------- Funcionalidades: las 6 áreas reales descritas en DOCUMENTACION.md ----------
  function seedFeatures(){
    return [
      {id:"ft1", name:"Biblioteca personal", objective:"Llevar la biblioteca propia: leídos, leyendo, pendientes y abandonados.", rules:"", dependencies:"", status:"completada", priority:"", testsRelated:"src/tests/importBooks.test.ts, src/tests/exportHtml.test.ts; e2e/library-flows.spec.ts, e2e/library-notes-privacy.spec.ts, e2e/import-export.spec.ts", notes:"Carga manual, por voz, ISBN o foto; progreso de página, puntaje, notas privadas, export/import JSON, estadísticas.", relatedRefs:[]},
      {id:"ft2", name:"Reconocimiento de libros", objective:"Agregar libros sin tipear: escaneo de ISBN y OCR de tapa, todo en el navegador.", rules:"", dependencies:"", status:"completada", priority:"", testsRelated:"src/tests/isbn.test.ts, src/tests/recognition.test.tsx; e2e/isbn-scanner.spec.ts, e2e/cover-ocr.spec.ts", notes:"BarcodeDetector API nativa + Tesseract.js (lazy-load) + ZXing como respaldo. Nunca probado en celular físico real.", relatedRefs:[]},
      {id:"ft3", name:"Comunidad", objective:"Compartir reflexiones sobre libros leídos, con comentarios y 'me gusta'.", rules:"", dependencies:"", status:"completada", priority:"", testsRelated:"server/tests/community.test.js; e2e/community.spec.ts", notes:"Alias público editable; modo invitado bloqueado para escritura (403).", relatedRefs:[]},
      {id:"ft4", name:"Catálogo público", objective:"Buscar y ver fichas de obra sin necesidad de cuenta.", rules:"", dependencies:"", status:"en-curso", priority:"", testsRelated:"server/tests/catalog.test.js; e2e/catalog.spec.ts", notes:"VACÍO en producción hoy — el backfill de obras/autores/ediciones nunca se corrió contra datos reales. Ver Roadmap f2-2.", relatedRefs:[]},
      {id:"ft5", name:"Mercado de libros", objective:"Venta e intercambio de libros entre usuarias, con fotos y contacto.", rules:"", dependencies:"", status:"bloqueada", priority:"", testsRelated:"server/tests/listingInput.test.js, server/tests/imageFile.test.js; e2e/marketplace-api.spec.ts, e2e/marketplace-ui.spec.ts", notes:"Fotos no funcionan en producción — UPLOADS_DIR sin configurar en el VPS. Ver Roadmap f2-3/f3-6.", relatedRefs:[]},
      {id:"ft6", name:"Cuenta, administración y acceso", objective:"Registro/login propios, recuperación de contraseña, tutorial guiado y panel de administración.", rules:"", dependencies:"", status:"completada", priority:"", testsRelated:"server/tests/auth.test.js, server/tests/admin.test.js, server/tests/sessionRevocation.test.js; e2e/auth.spec.ts, e2e/tour.spec.ts, e2e/session-expired.spec.ts, e2e/security-admin.spec.ts, e2e/security-demo.spec.ts, e2e/security-isolation.spec.ts", notes:"JWT propio + bcrypt; panel admin con pestañas Analíticas/Usuarios.", relatedRefs:[]}
    ];
  }

  // ---------- Arquitectura: inventario real de server/routes, hooks y servicios ----------
  function seedArchitecture(){
    return {
      stackNotes: "Frontend: Vite 8 + React 19 + TypeScript, vite-plugin-pwa, CSS Modules. Backend: Node + Express 4 (CommonJS) + PostgreSQL vía 'pg', JWT (jsonwebtoken) + bcrypt, Nodemailer, express-rate-limit. Despliegue propio al VPS vía deploy.sh (scp/ssh + systemctl).",
      routeFiles: [
        {id:"rf1", file:"server/routes/admin.js", notes:"Analíticas (GET /admin/analytics) y gestión de usuarios — protegido con auth + adminOnly."},
        {id:"rf2", file:"server/routes/analytics.js", notes:"POST /analytics/track — registro público de vistas, rate-limited."},
        {id:"rf3", file:"server/routes/auth.js", notes:"Registro, login, recuperación de contraseña."},
        {id:"rf4", file:"server/routes/books.js", notes:"CRUD de la biblioteca personal."},
        {id:"rf5", file:"server/routes/catalog.js", notes:"Catálogo público (obras/autores/ediciones)."},
        {id:"rf6", file:"server/routes/community.js", notes:"Reseñas, comentarios y likes."},
        {id:"rf7", file:"server/routes/marketplace.js", notes:"Publicaciones de venta/intercambio."},
        {id:"rf8", file:"server/routes/settings.js", notes:"Preferencias de usuario."},
        {id:"rf9", file:"server/routes/uploads.js", notes:"Subida de imágenes del Mercado."}
      ],
      dataEntities: "Ver server/schema.sql (tablas principales) y server/schema_analytics.sql (page_views) para el esquema completo — no duplicado acá para no desincronizarse del archivo real.",
      notes: ""
    };
  }

  // ---------- Testing: inventario real de archivos de prueba (sin inventar resultados) ----------
  function seedTesting(){
    var fe = ["AdminPage.test.tsx","api.test.ts","bookForm.test.ts","exportHtml.test.ts","importBooks.test.ts","isbn.test.ts","quickAdd.test.ts","recognition.test.tsx","tour.test.tsx","useAuth.test.ts","useCatalogSearch.test.ts","useDialogA11y.test.tsx","useVoiceEntry.test.ts","voiceBookParser.test.ts"];
    var be = ["admin","analytics","auth","bookInput","books","catalog","cleanup","community","demo","health","imageFile","listingInput","passwordReset","rateLimiter","sessionRevocation","settings","storageConfig","uploads"];
    var e2e = ["a11y-admin-tabs","a11y-axe","a11y-modals","auth","catalog","community","cover-ocr","import-export","isbn-scanner","library-flows","library-notes-privacy","marketplace-api","marketplace-ui","mobile","password-reset","search-quick-add","security-admin","security-demo","security-isolation","session-expired","theme","tour","work-page"];
    var suites = [];
    fe.forEach(function(f){ suites.push({id:U.uid("ts"), type:"unit-fe", name:f, file:"src/tests/"+f, status:"sin-verificar", lastChecked:"", notes:""}); });
    be.forEach(function(f){ suites.push({id:U.uid("ts"), type:"unit-be", name:f, file:"server/tests/"+f+".test.js", status:"sin-verificar", lastChecked:"", notes:""}); });
    e2e.forEach(function(f){ suites.push({id:U.uid("ts"), type:"e2e", name:f, file:"e2e/"+f+".spec.ts", status:"sin-verificar", lastChecked:"", notes:""}); });
    return {
      suites: suites,
      knownBugs: [
        {id:U.uid("bg"), title:"1 test backend marcado skip (preexistente, no investigado)", severity:"baja", status:"abierto", notes:"Detectado en la auditoría del 27/10/2026 — bajo riesgo, pendiente de revisar."}
      ]
    };
  }

  // ---------- SEO: checklist real (lo que hay y lo que falta en index.html) ----------
  function seedSeo(){
    return {
      checklist: [
        {id:U.uid("seo"), item:"Title y meta description", status:"hecho", notes:"index.html ya los tiene."},
        {id:U.uid("seo"), item:"Open Graph básico (og:title, og:description, og:type)", status:"hecho", notes:""},
        {id:U.uid("seo"), item:"Twitter Card básico (summary, title, description)", status:"hecho", notes:""},
        {id:U.uid("seo"), item:"og:image", status:"pendiente", notes:"No existe todavía una imagen de preview."},
        {id:U.uid("seo"), item:"Canonical URL", status:"pendiente", notes:""},
        {id:U.uid("seo"), item:"sitemap.xml", status:"pendiente", notes:"No existe en public/ ni en la raíz."},
        {id:U.uid("seo"), item:"robots.txt", status:"pendiente", notes:"No existe en public/ ni en la raíz."},
        {id:U.uid("seo"), item:"Datos estructurados (JSON-LD)", status:"pendiente", notes:""}
      ],
      keywords: []
    };
  }

  // ---------- Estadísticas: separación explícita entre lo instrumentado y lo manual ----------
  function seedStats(){
    return {
      instrumented: {
        description: "Hoy Haiku registra una vista por 'sección' (login / biblioteca / admin — no por ruta granular) en la tabla page_views (server/schema_analytics.sql), vía POST /analytics/track (público, sin auth, rate-limited), disparado desde src/App.tsx. La lectura real está en el panel de administración de la app (AdminPage.tsx → pestaña Analíticas, GET /admin/analytics, requiere login de admin): totales, por hora, por día, páginas, navegadores, dispositivos y actividad reciente. No existe tracking de duración de sesión, clics, eventos custom, ni geolocalización — solo IP cruda.",
        snapshots: []
      },
      manualMetrics: {
        counters: {invited:null, registered:null, publishedBook:null, usefulAction:null, contacts:null, exchanges:null, returned:null},
        notes: []
      }
    };
  }

  function seedUx(){ return {personas:[], journeys:[], frictions:[]}; }
  function seedUi(){ return {screens:[], components:[]}; }

  // ---------- Esquema v2 completo ----------
  function seedDataV2(){
    var rm = seedRoadmap();
    return {
      schemaVersion: 2,
      project: rm.project,
      identity: seedIdentity(),
      ux: seedUx(),
      ui: seedUi(),
      features: seedFeatures(),
      stats: seedStats(),
      architecture: seedArchitecture(),
      testing: seedTesting(),
      seo: seedSeo(),
      roadmap: {
        phases: PHASES,
        tasks: rm.tasks,
        log: rm.log,
        decisions: rm.decisions,
        metrics: rm.metrics
      }
    };
  }

  // Traslada el estado v1 (si existe en este navegador) a la forma v2, sin perder nada de lo
  // que Berenice ya cargó. Las secciones que v1 no tenía arrancan con la semilla real de arriba.
  function migrateV1toV2(v1){
    var fresh = seedDataV2();
    var identity = fresh.identity;
    if(v1.aesthetics){
      identity.tokens = {
        primary: v1.aesthetics.primary || identity.tokens.primary,
        secondary: v1.aesthetics.secondary || identity.tokens.secondary,
        bg: v1.aesthetics.bg || identity.tokens.bg,
        radius: (v1.aesthetics.radius!=null) ? v1.aesthetics.radius : identity.tokens.radius,
        fontFamily: v1.aesthetics.fontFamily || identity.tokens.fontFamily,
        fontSizeBase: v1.aesthetics.fontSizeBase || identity.tokens.fontSizeBase
      };
    }
    return {
      schemaVersion: 2,
      project: v1.project || fresh.project,
      identity: identity,
      ux: fresh.ux,
      ui: fresh.ui,
      features: fresh.features,
      stats: fresh.stats,
      architecture: fresh.architecture,
      testing: fresh.testing,
      seo: fresh.seo,
      roadmap: {
        phases: PHASES,
        tasks: Array.isArray(v1.tasks) ? v1.tasks : fresh.roadmap.tasks,
        log: Array.isArray(v1.log) ? v1.log : fresh.roadmap.log,
        decisions: Array.isArray(v1.decisions) ? v1.decisions : fresh.roadmap.decisions,
        metrics: v1.metrics || fresh.roadmap.metrics
      }
    };
  }

  // ---------- Carga / guardado ----------
  var state = null;
  var storageBroken = false;
  var saveTimer=null, lastSavedAt=null;
  var onSaveStateChange = null; // callback(kind) — lo setea router.js para actualizar el indicador

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && parsed.schemaVersion===2 && parsed.roadmap) return parsed;
      }
      var oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
      if(oldRaw){
        var oldParsed = JSON.parse(oldRaw);
        if(oldParsed && Array.isArray(oldParsed.tasks)) return migrateV1toV2(oldParsed);
      }
    }catch(e){ storageBroken = true; }
    return seedDataV2();
  }

  function persist(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      lastSavedAt = Date.now();
      storageBroken=false;
      if(onSaveStateChange) onSaveStateChange("saved");
      U.showToast("Guardado");
    }catch(e){
      storageBroken=true;
      if(onSaveStateChange) onSaveStateChange("error");
      U.showToast("No se pudo guardar — exportá un respaldo");
    }
  }
  function scheduleSave(){
    if(onSaveStateChange) onSaveStateChange("saving");
    clearTimeout(saveTimer);
    saveTimer=setTimeout(persist,350);
  }
  function snapshotBackup(){
    try{ localStorage.setItem(BACKUP_KEY, JSON.stringify({savedAt:new Date().toISOString(), data:state})); }catch(e){}
  }
  function getBackup(){
    try{ return JSON.parse(localStorage.getItem(BACKUP_KEY)); }catch(e){ return null; }
  }
  function restoreBackup(){
    var b = getBackup();
    if(!b) return false;
    state = b.data;
    persist();
    return true;
  }
  function resetToSeed(){
    snapshotBackup();
    state = seedDataV2();
    persist();
  }
  function importData(parsed){
    snapshotBackup();
    if(!parsed.identity) parsed.identity = seedIdentity();
    state = parsed;
    persist();
  }
  function lastSavedAgoText(){
    if(!lastSavedAt) return "Sin cambios todavía";
    var s=Math.round((Date.now()-lastSavedAt)/1000);
    return s<3 ? "Guardado ✓" : s<60 ? "Guardado hace "+s+"s" : "Guardado hace "+Math.round(s/60)+"min";
  }

  window.Haiku.store = {
    PHASES: PHASES,
    METRIC_LABELS: METRIC_LABELS,
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,
    init: function(){ state = loadState(); return state; },
    get state(){ return state; },
    isStorageBroken: function(){ return storageBroken; },
    scheduleSave: scheduleSave,
    persist: persist,
    snapshotBackup: snapshotBackup,
    getBackup: getBackup,
    restoreBackup: restoreBackup,
    resetToSeed: resetToSeed,
    importData: importData,
    lastSavedAgoText: lastSavedAgoText,
    setOnSaveStateChange: function(fn){ onSaveStateChange = fn; },
    seedDataV2: seedDataV2
  };
})();
