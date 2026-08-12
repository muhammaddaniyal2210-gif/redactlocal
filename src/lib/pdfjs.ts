import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

// The worker, the font data and the CMaps are all served from our own origin.
// A CDN would work in development but would break the core promise of this app:
// with Wi-Fi off, a CDN-hosted worker never loads and nothing renders at all.
//
// This points at our wrapper rather than at pdf.js's worker directly, so the
// worker thread gets the polyfills too. `?worker&url` makes Vite bundle the
// wrapper as a worker entry and hand back its URL.
import workerUrl from './pdfWorker?worker&url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Copied from node_modules/pdfjs-dist at setup time — see `npm run sync:pdfjs`. */
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`

export type { PDFDocumentProxy, PDFPageProxy }

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

export interface PageTextContent {
  items: unknown[]
  styles: Record<string, { fontFamily?: string } | undefined>
}

/**
 * Read a page's text without pdf.js's `getTextContent()`.
 *
 * `getTextContent()` is implemented as `for await (const chunk of
 * this.streamTextContent(...))`. Async-iterating a `ReadableStream` requires
 * `ReadableStream.prototype[Symbol.asyncIterator]`, which Safari has never
 * shipped: there the symbol is `undefined`, the loop tries to call it, and
 * WebKit reports "undefined is not a function (near '...e of t...')" — the
 * `...of...` in the snippet being the loop itself.
 *
 * Rendering is unaffected because it goes through `getOperatorList`, which is
 * why a document displays perfectly on Safari and only text extraction dies.
 *
 * Pulling the same stream with an explicit reader gets identical data using
 * only `getReader()` and `read()`, both supported everywhere ReadableStream is.
 */
export async function readPageText(page: PDFPageProxy): Promise<PageTextContent> {
  const items: unknown[] = []
  const styles: PageTextContent['styles'] = Object.create(null)

  if (typeof page.streamTextContent === 'function') {
    const stream = page.streamTextContent({ disableNormalization: false })
    const reader = stream.getReader()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        // Appended one at a time: spreading a chunk of tens of thousands of
        // items into push() can blow the argument limit.
        for (const item of asChunkItems(value)) items.push(item)
        if (value && typeof value === 'object' && 'styles' in value) {
          Object.assign(styles, (value as { styles?: object }).styles ?? {})
        }
      }
    } finally {
      // Releasing is best-effort; a cancelled read must not mask a real error.
      try {
        reader.releaseLock()
      } catch {
        // Ignored deliberately.
      }
    }
    return { items, styles }
  }

  // Older builds without streamTextContent: fall back to the async-iterating
  // implementation, which is fine on engines that support it.
  const content = await page.getTextContent()
  return {
    items: Array.isArray(content?.items) ? content.items : [],
    styles: (content?.styles ?? Object.create(null)) as PageTextContent['styles'],
  }
}

function asChunkItems(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return []
  const items = (value as { items?: unknown }).items
  return Array.isArray(items) ? items : []
}

export function isRenderCancelled(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'RenderingCancelledException'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
