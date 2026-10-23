const API_BASE = '/librook-api'

// Se dispara cuando la API rechaza el token guardado (vencido o inválido).
// useAuth lo escucha para volver al login en vez de dejar la app "logueada"
// con errores que ningún reintento puede resolver.
export const SESSION_EXPIRED_EVENT = 'librook:session-expired'

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem('librook_token')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (res.status === 401 && token) {
    localStorage.removeItem('librook_token')
    localStorage.removeItem('librook_auth')
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  if (!res.ok) {
    let message = 'Error en la solicitud'
    try {
      const data = await res.json()
      message = data.error || message
    } catch { /* body no es JSON válido */ }
    throw new Error(message)
  }
  return res.json()
}

// Subida de un archivo crudo (p. ej. una imagen): mismo manejo de sesión y errores que
// request(), pero con el Content-Type del archivo en vez de JSON.
async function upload(path: string, file: Blob) {
  const token = localStorage.getItem('librook_token')
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  })
  if (res.status === 401 && token) {
    localStorage.removeItem('librook_token')
    localStorage.removeItem('librook_auth')
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  if (!res.ok) {
    let message = res.status === 413 ? 'La imagen es demasiado pesada' : 'Error al subir la imagen'
    try {
      const data = await res.json()
      message = data.error || message
    } catch { /* body no es JSON válido */ }
    throw new Error(message)
  }
  return res.json()
}

export const api = {
  upload,
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}
