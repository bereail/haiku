import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Escáner de ISBN: cámara y lector simulados ────────────────────────────────

const detectorMock = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('../services/barcode', () => ({ createIsbnDetector: detectorMock.create }))

const tesseractMock = vi.hoisted(() => ({ createWorker: vi.fn() }))
vi.mock('tesseract.js', () => ({ createWorker: tesseractMock.createWorker }))

import ISBNScanner from '../components/ISBNScanner'
import { recognizeCover } from '../services/ocr'

function fakeStream() {
  const track = { stop: vi.fn() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

function domError(name: string) {
  return Object.assign(new Error(name), { name })
}

let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  getUserMedia = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  detectorMock.create.mockReset()
})
afterEach(() => vi.restoreAllMocks())

const renderScanner = (onScan = vi.fn(), onClose = vi.fn()) => {
  const r = render(<ISBNScanner onScan={onScan} onClose={onClose} />)
  return { ...r, onScan, onClose }
}

describe('<ISBNScanner>: la cámara nunca queda encendida', () => {
  it('si no carga el lector (p. ej. sin conexión), apaga la cámara y ofrece reintentar', async () => {
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    detectorMock.create.mockRejectedValueOnce(new Error('chunk no disponible'))
    renderScanner()

    expect(await screen.findByText('No se pudo cargar el lector de códigos.')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()

    // Reintentar vuelve a pedir la cámara y el lector
    const second = fakeStream()
    getUserMedia.mockResolvedValue(second.stream)
    detectorMock.create.mockResolvedValue({ engine: 'zxing', detect: vi.fn().mockResolvedValue([]) })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('si falla video.play(), apaga la cámara', async () => {
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect: vi.fn() })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('autoplay'))
    renderScanner()
    expect(await screen.findByText('No se pudo acceder a la cámara.')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
  })

  it('al cerrar el escáner apaga la cámara', async () => {
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect: vi.fn().mockResolvedValue([]) })
    const { onClose } = renderScanner()
    await waitFor(() => expect(screen.queryByText('Iniciando cámara y lector…')).toBeNull())
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(track.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('si se cierra antes de que el navegador entregue la cámara, la apaga apenas llega', async () => {
    const { track, stream } = fakeStream()
    let give!: (s: MediaStream) => void
    getUserMedia.mockReturnValue(new Promise(r => { give = r }))
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect: vi.fn() })
    const { unmount } = renderScanner()
    unmount()
    await act(async () => { give(stream) })
    expect(track.stop).toHaveBeenCalled()
  })
})

describe('<ISBNScanner>: mensajes según el problema', () => {
  it.each([
    ['NotAllowedError', 'No diste permiso para usar la cámara.', false],
    ['NotReadableError', 'La cámara está ocupada por otra aplicación.', true],
    ['TypeError', 'No se pudo acceder a la cámara.', true],
  ])('%s → "%s"', async (name, text, retry) => {
    getUserMedia.mockRejectedValue(domError(name))
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect: vi.fn() })
    renderScanner()
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(!!screen.queryByRole('button', { name: 'Reintentar' })).toBe(retry)
  })

  it('NotFoundError → no hay cámara: ofrece el ingreso manual', async () => {
    getUserMedia.mockRejectedValue(domError('NotFoundError'))
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect: vi.fn() })
    renderScanner()
    expect(await screen.findByText('Este dispositivo no tiene una cámara disponible para escanear.')).toBeInTheDocument()
  })

  it('sin getUserMedia (navegador viejo o http) lo explica sin pedir nada', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    renderScanner()
    expect(screen.getByText('Este dispositivo no tiene una cámara disponible para escanear.')).toBeInTheDocument()
    expect(detectorMock.create).not.toHaveBeenCalled()
  })
})

describe('<ISBNScanner>: lectura', () => {
  it('un código que no es de libro avisa; un ISBN válido se entrega y apaga la cámara', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4)
    const { track, stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const detect = vi.fn()
      .mockResolvedValueOnce([{ rawValue: '7791234567898' }]) // EAN de otro producto
      .mockResolvedValue([{ rawValue: '9788437604947' }])
    detectorMock.create.mockResolvedValue({ engine: 'nativo', detect })
    const { onScan } = renderScanner()

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('9788437604947'))
    expect(screen.getByText(/no es el ISBN de un libro/)).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
  })
})

// ── OCR: cancelación ──────────────────────────────────────────────────────────

describe('recognizeCover: cancelar libera el worker', () => {
  beforeEach(() => {
    tesseractMock.createWorker.mockReset()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 1200, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ filter: '', drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  })
  afterEach(() => vi.unstubAllGlobals())

  const image = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

  it('lectura normal: devuelve las líneas con letras y termina el worker', async () => {
    const worker = { recognize: vi.fn().mockResolvedValue({ data: { text: 'RAYUELA\n··\nJulio Cortázar\n', confidence: 91 } }), terminate: vi.fn().mockResolvedValue(undefined) }
    tesseractMock.createWorker.mockResolvedValue(worker)
    const r = await recognizeCover(image())
    expect(r.lines).toEqual(['RAYUELA', 'Julio Cortázar'])
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('cancelar mientras lee: rechaza con AbortError y termina el worker', async () => {
    const worker = { recognize: vi.fn(() => new Promise(() => {})), terminate: vi.fn().mockResolvedValue(undefined) }
    tesseractMock.createWorker.mockResolvedValue(worker)
    const ctrl = new AbortController()
    const p = recognizeCover(image(), undefined, ctrl.signal)
    await waitFor(() => expect(worker.recognize).toHaveBeenCalled())
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('cancelar mientras descarga el modelo: el worker se termina apenas termina de crearse', async () => {
    const worker = { recognize: vi.fn(), terminate: vi.fn().mockResolvedValue(undefined) }
    let created!: (w: typeof worker) => void
    tesseractMock.createWorker.mockReturnValue(new Promise(r => { created = r }))
    const ctrl = new AbortController()
    const p = recognizeCover(image(), undefined, ctrl.signal)
    await waitFor(() => expect(tesseractMock.createWorker).toHaveBeenCalled())
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    created(worker)
    await waitFor(() => expect(worker.terminate).toHaveBeenCalledTimes(1))
    expect(worker.recognize).not.toHaveBeenCalled()
  })

  it('ya cancelado antes de empezar: no carga nada', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(recognizeCover(image(), undefined, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(tesseractMock.createWorker).not.toHaveBeenCalled()
  })
})
