import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server')

// Corre SQL contra la base LOCAL (la misma que usa la API, DATABASE_URL de server/.env)
// para preparar datos que no tienen endpoint propio (ej. el catálogo, de solo lectura).
// Un proceso `node` corto con el driver `pg` que ya trae el backend — sin depender de
// Docker ni de tener psql en el PATH (antes: `docker exec librook-pg psql ...`, que
// solo funcionaba si Postgres corría en un contenedor con ese nombre exacto).
// Nunca contra producción: usa el mismo DATABASE_URL que la API del stack E2E, que
// global-setup ya valida que sea local.
function run(sqlText: string): Record<string, string>[] {
  const script = `
    require('dotenv').config();
    const { Client } = require('pg');
    (async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const statements = ${JSON.stringify(sqlText)}.split(';').map(s => s.trim()).filter(Boolean);
        let result;
        for (const stmt of statements) result = await client.query(stmt);
        process.stdout.write(JSON.stringify(result && result.rows ? result.rows : []));
      } finally {
        await client.end();
      }
    })().catch(err => { console.error(err); process.exit(1) });
  `
  const out = execFileSync('node', ['-e', script], { cwd: SERVER_DIR })
  return JSON.parse(out.toString() || '[]')
}

// Para sentencias de las que no importa el resultado (UPDATE, INSERT sin RETURNING).
export function dbExec(sqlText: string): void {
  run(sqlText)
}

// Para `-tAc`: el valor de la primera columna de la primera fila (de la ÚLTIMA
// sentencia, si hay varias separadas por ';' — igual que psql con un script).
export function dbValue(sqlText: string): string {
  const rows = run(sqlText)
  const row = rows[0]
  if (!row) throw new Error(`dbValue: la consulta no devolvió filas: ${sqlText}`)
  return String(Object.values(row)[0])
}
