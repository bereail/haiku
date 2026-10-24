import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminPage from '../pages/AdminPage'

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const MOCK_USERS = [
  { id: 'u1', email: 'alice@test.com', created_at: '2024-01-01T00:00:00Z', book_count: 5 },
  { id: 'u2', email: 'bob@test.com', created_at: '2024-02-01T00:00:00Z', book_count: 2 },
]

const MOCK_ANALYTICS = {
  overview: { total: 100, today: 10, week: 50, unique_sessions: 30, unique_today: 8 },
  hourly: [],
  daily: [],
  pages: [],
  browsers: [],
  devices: [],
  active: [],
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el panel admin con las pestañas', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })

    render(<AdminPage onBack={vi.fn()} />)

    expect(screen.getByText('Panel Admin')).toBeInTheDocument()
    expect(screen.getByText('Analíticas')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
  })

  it('muestra la lista de usuarios en la pestaña Usuarios', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })

    render(<AdminPage onBack={vi.fn()} />)

    fireEvent.click(screen.getByText('Usuarios'))

    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
      expect(screen.getByText('bob@test.com')).toBeInTheDocument()
    })
  })

  it('abre el modal de reset de contraseña al hacer click en Resetear contraseña', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })

    render(<AdminPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Usuarios'))

    await waitFor(() => screen.getByText('alice@test.com'))

    const resetBtns = screen.getAllByTitle('Resetear contraseña')
    fireEvent.click(resetBtns[0])

    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getAllByText('alice@test.com').length).toBeGreaterThanOrEqual(1)
  })

  it('deshabilita Guardar si la contraseña tiene menos de 6 caracteres', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })

    render(<AdminPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Usuarios'))

    await waitFor(() => screen.getByText('alice@test.com'))

    const resetBtns = screen.getAllByTitle('Resetear contraseña')
    fireEvent.click(resetBtns[0])

    const input = screen.getByLabelText('Nueva contraseña')
    fireEvent.change(input, { target: { value: '123' } })

    const saveBtn = screen.getByText('Guardar')
    expect(saveBtn).toBeDisabled()
  })

  it('llama a la API y muestra éxito al resetear la contraseña', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })
    vi.mocked(api.put).mockResolvedValueOnce({ ok: true })

    render(<AdminPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Usuarios'))

    await waitFor(() => screen.getByText('alice@test.com'))

    const resetBtns = screen.getAllByTitle('Resetear contraseña')
    fireEvent.click(resetBtns[0])

    const input = screen.getByLabelText('Nueva contraseña')
    fireEvent.change(input, { target: { value: 'nuevapass123' } })
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() => {
      expect(screen.getByText(/Contraseña actualizada/i)).toBeInTheDocument()
    })

    expect(api.put).toHaveBeenCalledWith('/admin/users/u1/password', { password: 'nuevapass123' })
  })

  it('el botón Volver llama a onBack', async () => {
    const { api } = await import('../api')
    vi.mocked(api.get).mockImplementation((path) => {
      if (/^\/admin\/analytics\?tz=[^&]+&offset=-?\d+$/.test(path)) return Promise.resolve(MOCK_ANALYTICS)
      if (path === '/admin/users') return Promise.resolve(MOCK_USERS)
      return Promise.resolve([])
    })

    const onBack = vi.fn()
    render(<AdminPage onBack={onBack} />)

    fireEvent.click(screen.getByText('Volver'))
    expect(onBack).toHaveBeenCalled()
  })
})
