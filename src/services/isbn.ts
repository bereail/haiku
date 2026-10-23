// ISBN: normalización y dígito verificador. Evita buscar (o aceptar del escáner) códigos
// mal leídos: un solo dígito equivocado invalida el verificador.

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, '').toUpperCase()
}

function validIsbn13(d: string): boolean {
  if (!/^\d{13}$/.test(d)) return false
  const sum = d.split('').reduce((s, c, i) => s + Number(c) * (i % 2 === 0 ? 1 : 3), 0)
  return sum % 10 === 0
}

function validIsbn10(d: string): boolean {
  if (!/^\d{9}[\dX]$/.test(d)) return false
  const sum = d.split('').reduce((s, c, i) => s + (c === 'X' ? 10 : Number(c)) * (10 - i), 0)
  return sum % 11 === 0
}

// Los EAN-13 de libros empiezan con 978 o 979 ("Bookland"); otros códigos de barras
// (de un producto cualquiera) no son ISBN.
export function isBookEan(d: string): boolean {
  return /^97[89]/.test(d) && validIsbn13(d)
}

export function isValidIsbn(raw: string): boolean {
  const d = normalizeIsbn(raw)
  return d.length === 13 ? isBookEan(d) : validIsbn10(d)
}
