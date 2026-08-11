import { INSTALLED_POLYFILLS } from './polyfills'

export interface EnvironmentReport {
  userAgent: string
  /** APIs this engine was missing and we had to supply. */
  polyfilled: string[]
  /** Capabilities the export path depends on, as found at runtime. */
  features: Record<string, boolean>
  /** Largest canvas this engine actually backed, in megapixels. */
  maxCanvasMegapixels: number | null
}

function probeMaxCanvas(): number | null {
  // WebKit refuses oversized canvases silently, so ask it rather than assume.
  // Descending sizes; the first that reads back a live pixel is the real cap.
  const candidates = [64, 32, 16, 8, 4]
  for (const megapixels of candidates) {
    const side = Math.floor(Math.sqrt(megapixels * 1e6))
    try {
      const canvas = document.createElement('canvas')
      canvas.width = side
      canvas.height = side
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#fff'
      ctx.fillRect(side - 2, side - 2, 2, 2)
      const alive = ctx.getImageData(side - 1, side - 1, 1, 1).data[3] !== 0
      canvas.width = 0
      canvas.height = 0
      if (alive) return megapixels
    } catch {
      // getImageData can throw outright on some engines; treat as too big.
    }
  }
  return null
}

/**
 * A snapshot of what this browser can actually do. Shown on screen when an
 * export fails, because on a device you cannot attach a debugger to, "which
 * API was missing" beats a minified stack trace every time.
 */
export function collectEnvironmentReport(): EnvironmentReport {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  return {
    userAgent: navigator.userAgent,
    polyfilled: [...INSTALLED_POLYFILLS],
    features: {
      'Promise.withResolvers': typeof Promise.withResolvers === 'function',
      'Object.hasOwn': typeof Object.hasOwn === 'function',
      structuredClone: typeof globalThis.structuredClone === 'function',
      'Array.prototype.at': typeof Array.prototype.at === 'function',
      'Array.prototype.findLast': typeof Array.prototype.findLast === 'function',
      'String.prototype.replaceAll': typeof String.prototype.replaceAll === 'function',
      'canvas.getContext("2d")': !!ctx,
      'canvas.toDataURL': typeof canvas.toDataURL === 'function',
      'ctx.getImageData': typeof ctx?.getImageData === 'function',
      OffscreenCanvas: typeof globalThis.OffscreenCanvas === 'function',
      Worker: typeof Worker === 'function',
      WebAssembly: typeof WebAssembly === 'object',
      'Blob.arrayBuffer': typeof Blob.prototype.arrayBuffer === 'function',
      TextDecoder: typeof TextDecoder === 'function',
    },
    maxCanvasMegapixels: probeMaxCanvas(),
  }
}

/** One-line summary for the error banner. */
export function summariseEnvironment(report: EnvironmentReport): string {
  const missing = Object.entries(report.features)
    .filter(([, available]) => !available)
    .map(([name]) => name)

  const parts = [
    missing.length ? `missing: ${missing.join(', ')}` : 'no missing APIs detected',
    report.polyfilled.length ? `polyfilled: ${report.polyfilled.join(', ')}` : null,
    report.maxCanvasMegapixels ? `max canvas ≈ ${report.maxCanvasMegapixels} MP` : null,
  ].filter(Boolean)

  return parts.join(' · ')
}
