const { processImage, detectType, LIMITS } = require('../images/imageFile')

const { jpeg, png, webpVP8X, webpVP8, webpVP8L } = require('./fixtures/images')

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
