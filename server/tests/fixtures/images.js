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

module.exports = { jpeg, png, webpVP8X, webpVP8, webpVP8L }
