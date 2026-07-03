const API_BASE = '/librook-api'

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem('librook_token')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
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

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}
