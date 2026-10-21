/// <reference types="vite/client" />

// BarcodeDetector Web API (not yet in standard TypeScript lib)
interface BarcodeDetectorResult {
  rawValue: string
  format: string
}

interface BarcodeDetector {
  detect(
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData
  ): Promise<BarcodeDetectorResult[]>
}

declare const BarcodeDetector: {
  prototype: BarcodeDetector
  new (options?: { formats: string[] }): BarcodeDetector
  getSupportedFormats(): Promise<string[]>
}
