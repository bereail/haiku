const fs = require('fs')
const os = require('os')
const path = require('path')

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'librook-cleanup-'))
process.env.UPLOADS_DIR = TMP
const { cleanupUploads } = require('../images/cleanup')

const NOW = Date.now()
const name = (c) => c.repeat(32) + '.jpg'
function file(n, ageMinutes) {
  const p = path.join(TMP, n)
  fs.writeFileSync(p, 'x')
  const t = new Date(NOW - ageMinutes * 60 * 1000)
  fs.utimesSync(p, t, t)
}
function fakePool({ orphans = [], known = [] }) {
  return { query: jest.fn(async (sql) => sql.includes('listing_id IS NULL') ? { rows: orphans.map(filename => ({ filename })) } : { rows: known.map(filename => ({ filename })) }) }
}

beforeEach(() => { for (const f of fs.readdirSync(TMP)) fs.unlinkSync(path.join(TMP, f)) })
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }))

describe('cleanupUploads', () => {
  it('borra huérfanas (registro + archivo) y archivos sueltos viejos; respeta los vigentes y los recientes', async () => {
    file(name('a'), 2000) // huérfana (la base la devuelve como tal)
    file(name('b'), 2000) // vigente (en una publicación)
    file(name('c'), 120)  // suelta vieja (no está en la base)
    file(name('d'), 5)    // suelta reciente: podría ser una subida en curso
    file('nota.txt', 5000) // no es nuestra: nunca se toca
    const pool = fakePool({ orphans: [name('a')], known: [name('b')] })

    const r = await cleanupUploads(pool, { now: NOW })
    expect(r.orphans).toEqual([name('a')])
    expect(r.strays).toEqual([name('c')])
    expect(fs.readdirSync(TMP).sort()).toEqual([name('b'), name('d'), 'nota.txt'].sort())
    expect(pool.query.mock.calls[0][0]).toMatch(/^DELETE FROM uploads WHERE listing_id IS NULL/)
  })

  it('--dry-run no borra nada (ni registros ni archivos)', async () => {
    file(name('a'), 2000)
    file(name('c'), 120)
    const pool = fakePool({ orphans: [name('a')], known: [] })
    const r = await cleanupUploads(pool, { dryRun: true, now: NOW })
    expect(r.orphans).toEqual([name('a')])
    expect(r.strays).toEqual([name('c')])
    expect(fs.readdirSync(TMP)).toHaveLength(2)
    expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT filename FROM uploads/)
  })
})
