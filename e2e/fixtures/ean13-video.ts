import fs from 'node:fs'

// Genera un video Y4M (lo que Chromium acepta como cámara falsa) que muestra el código de
// barras EAN-13 de un ISBN, dibujado módulo por módulo según la especificación EAN-13.

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const G = R.map(code => code.split('').reverse().join(''))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export function ean13Modules(code: string): string {
  if (!/^\d{13}$/.test(code)) throw new Error('EAN-13 inválido')
  const d = code.split('').map(Number)
  const parity = PARITY[d[0]]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  return bits + '101' // 95 módulos
}

export function writeEan13Y4m(file: string, code: string, { width = 640, height = 480, module = 4, frames = 10 } = {}) {
  const bits = ean13Modules(code)
  const barsWidth = bits.length * module
  const left = Math.floor((width - barsWidth) / 2)
  const top = Math.floor(height * 0.2)
  const bottom = Math.floor(height * 0.8)
  const y = Buffer.alloc(width * height, 235) // fondo blanco
  for (let row = top; row < bottom; row++) {
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') y.fill(16, row * width + left + i * module, row * width + left + (i + 1) * module)
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma, chroma])
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F15:1 Ip A1:1 C420jpeg\n`)
  fs.writeFileSync(file, Buffer.concat([header, ...Array(frames).fill(frame)]))
}
