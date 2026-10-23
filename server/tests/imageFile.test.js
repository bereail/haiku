const { processImage, detectType, LIMITS } = require('../images/imageFile')

// ── Fixtures armadas byte a byte (estructura válida de cada formato) ──────────
const seg = (marker, payload) => {
  const b = Buffer.alloc(4 + payload.length)
  b[0] = 0xff; b[1] = marker; b.writeUInt16BE(payload.length + 2, 2); payload.copy(b, 4)
  return b
}
function jpeg({ width = 800, height = 600, exif = true } = {}) {
  const sof = Buffer.alloc(15)
  sof[0] = 8; sof.writeUInt16BE(height, 1); sof.writeUInt16BE(width, 3); sof[5] = 3
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')),
    exif ? seg(0xe1, Buffer.from('Exif\0\0GPSLatitude -34.6037 GPSLongitude -58.3816', 'binary')) : Buffer.alloc(0),
    exif ? seg(0xfe, Buffer.from('comentario privado')) : Buffer.alloc(0),
    seg(0xe2, Buffer.from('ICC_PROFILE\0perfil')),
    seg(0xc0, sof),
    seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0x56, 0x78]),
    Buffer.from([0xff, 0xd9]),
  ])
}
const chunk = (type, data) => {
  const b = Buffer.alloc(12 + data.length)
  b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(0, 8 + data.length)
  return b
}
function png({ width = 640, height = 480 } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from('Author\0Nombre Apellido')),
    chunk('eXIf', Buffer.from('GPS -34.6 -58.3')),
    chunk('IDAT', Buffer.from([1, 2, 3, 4])),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const riffChunk = (type, data) => {
  const pad = data.length % 2
  const b = Buffer.alloc(8 + data.length + pad)
  b.write(type, 0, 'ascii'); b.writeUInt32LE(data.length, 4); data.copy(b, 8)
  return b
}
const riff = (body) => {
  const h = Buffer.alloc(12); h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(body.length + 4, 4); h.write('WEBP', 8, 'ascii')
  return Buffer.concat([h, body])
}
function webpVP8X({ width = 1024, height = 768 } = {}) {
  const x = Buffer.alloc(10); x[0] = 0x08 | 0x04; x.writeUIntLE(width - 1, 4, 3); x.writeUIntLE(height - 1, 7, 3)
  return riff(Buffer.concat([
    riffChunk('VP8X', x),
    riffChunk('VP8 ', Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a, 0, 0, 0, 0])),
    riffChunk('EXIF', Buffer.from('GPS -34.6 -58.3')),
    riffChunk('XMP ', Buffer.from('<x:xmpmeta>autor</x:xmpmeta>')),
  ]))
}
function webpVP8({ width = 300, height = 200 } = {}) {
  const d = Buffer.alloc(10); d[3] = 0x9d; d[4] = 0x01; d[5] = 0x2a; d.writeUInt16LE(width, 6); d.writeUInt16LE(height, 8)
  return riff(riffChunk('VP8 ', d))
}
function webpVP8L({ width = 120, height = 90 } = {}) {
  const d = Buffer.alloc(5); d[0] = 0x2f; d.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1)
  return riff(riffChunk('VP8L', d))
}
const err = (buf) => { try { processImage(buf); return null } catch (e) { return e } }

describe('detección del tipo por firma binaria', () => {
  it('reconoce JPEG, PNG y WebP; rechaza lo demás aunque diga ser imagen', () => {
    expect(detectType(jpeg())).toBe('jpeg')
    expect(detectType(png())).toBe('png')
    expect(detectType(webpVP8())).toBe('webp')
    expect(err(Buffer.from('<html><script>alert(1)</script></html>')).message).toMatch(/JPEG, PNG o WebP/)
    expect(err(Buffer.from('GIF89a......')).status).toBe(400)
    expect(err(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).status).toBe(400)
  })
})

describe('JPEG', () => {
  it('lee las dimensiones y quita EXIF/GPS y comentarios, conservando el perfil de color', () => {
    const r = processImage(jpeg({ width: 800, height: 600 }))
    expect(r).toMatchObject({ type: 'jpeg', mime: 'image/jpeg', ext: 'jpg', width: 800, height: 600 })
    const out = r.buffer.toString('binary')
    expect(out).not.toMatch(/GPSLatitude|Exif|comentario privado/)
    expect(out).toContain('ICC_PROFILE')
    expect(out).toContain('JFIF')
    expect(r.buffer.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]))
    expect(r.bytes).toBe(r.buffer.length)
    // Lo procesado vuelve a ser válido (idempotente)
    expect(processImage(r.buffer).buffer.equals(r.buffer)).toBe(true)
  })

  it('rechaza un JPEG truncado o corrupto', () => {
    const full = jpeg()
    expect(err(full.subarray(0, 30)).status).toBe(400)
    const broken = Buffer.from(full); broken[2] = 0x00
    expect(err(broken).status).toBe(400)
  })
})

describe('PNG', () => {
  it('lee las dimensiones y quita chunks de texto y eXIf', () => {
    const r = processImage(png({ width: 640, height: 480 }))
    expect(r).toMatchObject({ type: 'png', width: 640, height: 480 })
    const out = r.buffer.toString('binary')
    expect(out).not.toMatch(/tEXt|eXIf|Nombre Apellido|GPS/)
    expect(out).toContain('IDAT')
    expect(out).toContain('IEND')
  })

  it('rechaza un PNG sin IEND', () => {
    const p = png()
    expect(err(p.subarray(0, p.length - 12)).message).toMatch(/truncada/)
  })
})

describe('WebP', () => {
  it('VP8X: dimensiones, quita EXIF/XMP, apaga sus flags y corrige el tamaño RIFF', () => {
    const r = processImage(webpVP8X({ width: 1024, height: 768 }))
    expect(r).toMatchObject({ type: 'webp', width: 1024, height: 768 })
    const out = r.buffer.toString('binary')
    expect(out).not.toMatch(/EXIF|XMP |GPS|autor/)
    expect(r.buffer[20] & 0x0c).toBe(0) // flags EXIF/XMP del VP8X
    expect(r.buffer.readUInt32LE(4)).toBe(r.buffer.length - 8)
  })

  it('VP8 y VP8L: dimensiones', () => {
    expect(processImage(webpVP8({ width: 300, height: 200 }))).toMatchObject({ width: 300, height: 200 })
    expect(processImage(webpVP8L({ width: 120, height: 90 }))).toMatchObject({ width: 120, height: 90 })
  })
})

describe('límites', () => {
  it('rechaza imágenes demasiado chicas, gigantes en píxeles o de más de 5 MB', () => {
    expect(err(jpeg({ width: 10, height: 10 })).message).toMatch(/demasiado chica/)
    expect(err(jpeg({ width: 7000, height: 100 })).message).toMatch(/demasiado grande/)
    expect(err(png({ width: 6000, height: 5000 })).message).toMatch(/demasiado grande/) // 30M píxeles > 25M
    expect(processImage(jpeg({ width: 4032, height: 3024 })).width).toBe(4032) // foto de celular de 12 MP
    expect(err(Buffer.concat([jpeg(), Buffer.alloc(LIMITS.maxBytes)])).message).toMatch(/5 MB/)
    expect(err(Buffer.alloc(0)).message).toMatch(/ninguna imagen/)
  })
})
