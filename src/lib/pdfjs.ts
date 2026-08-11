import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// The worker, the font data and the CMaps are all served from our own origin.
// A CDN would work in development but would break the core promise of this app:
// with Wi-Fi off, a CDN-hosted worker never loads and nothing renders at all.
// `?url` makes Vite emit the worker as a hashed asset next to the bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Copied from node_modules/pdfjs-dist at setup time — see `npm run sync:pdfjs`. */
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`

export type { PDFDocumentProxy }

/**
 * Parse PDF bytes entirely in browser memory.
 *
 * `getDocument` takes ownership of (and detaches) the buffer it is handed, so we
 * always pass a copy and let the caller keep the pristine original for later
 * phases — re-rendering, and eventually burning redactions into an export.
 */
export function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: `${ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    // pdf.js decodes JBIG2 and JPEG 2000 images (the formats scanners produce)
    // and applies ICC colour profiles via WebAssembly. Left unset these resolve
    // against the page URL and quietly fail; scanned pages are exactly what
    // people bring to a redaction tool, so they are served locally too.
    wasmUrl: `${ASSET_BASE}wasm/`,
    iccUrl: `${ASSET_BASE}iccs/`,
    // Belt and braces: no fetching of the file itself, ever.
    disableAutoFetch: true,
    disableStream: true,
  })
  return task.promise
}

/** Tear a document down and free the worker resources it holds. */
export function destroyPdfDocument(pdf: PDFDocumentProxy | null | undefined): void {
  void pdf?.loadingTask.destroy().catch(() => {})
}

/** Read a File into memory with the FileReader API. No network, no disk round-trip. */
export function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsArrayBuffer(file)
  })
}

export function isRenderCancelled(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'RenderingCancelledException'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
