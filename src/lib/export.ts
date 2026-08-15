import { jsPDF } from 'jspdf'
import { OPS, type PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument, readPageText } from './pdfjs'
import { canvasPixelBudget, MAX_CANVAS_SIDE } from './canvasBudget'
import { asArray, paintBoxes, type RedactionMap } from './redactions'

/**
 * Raster density for the export, as a multiple of the PDF's own 72 dpi user
 * space. 2 → 144 dpi, which stays readable when printed without making a
 * 20-page document unmanageably large.
 */
export const EXPORT_SCALE = 2

/**
 * Largest scale at which this page still fits inside the canvas limits.
 *
 * An engine over its limit does not throw — it hands back a blank bitmap and
 * `toDataURL` returns the empty `"data:,"`. That would produce a silently blank
 * "redacted" page, the worst possible failure for this tool, so an oversized
 * page is rasterised at reduced density instead. A2 and smaller are unaffected
 * on a desktop; a phone's budget is much lower and bites sooner.
 */
function fitExportScale(baseWidth: number, baseHeight: number): number {
  if (!(baseWidth > 0) || !(baseHeight > 0)) return EXPORT_SCALE
  // Only one export canvas exists at a time, so it may use the whole budget —
  // which on a phone is far below the desktop ceiling.
  const budget = canvasPixelBudget()
  return Math.min(
    EXPORT_SCALE,
    MAX_CANVAS_SIDE / baseWidth,
    MAX_CANVAS_SIDE / baseHeight,
    Math.sqrt(budget / (baseWidth * baseHeight)),
  )
}

/** WebKit signals a canvas it could not back by returning `"data:,"`. */
function assertRasterised(dataUrl: string, pageNumber: number): string {
  if (!dataUrl.startsWith('data:image/png') || dataUrl.length < 128) {
    throw new Error(
      `Page ${pageNumber} could not be converted to an image — this browser refused a canvas that large. Try a smaller page size.`,
    )
  }
  return dataUrl
}

export interface ExportProgress {
  phase: 'render' | 'assemble' | 'verify'
  page: number
  total: number
}

export interface VerificationReport {
  pages: number
  /** Characters pdf.js can extract — what a copy-paste or `pdftotext` would get. */
  textCharacters: number
  /** Text-showing operators in the page content streams. */
  textOperators: number
  /** Font objects in the file. A raster-only PDF needs none. */
  fontObjects: number
  annotations: number
  /**
   * Probes that could not run on this browser.
   *
   * A check that throws is *not* a check that passed. Counting a failed probe
   * as zero would let the app report "0 selectable characters" about a file it
   * never managed to read — a false all-clear on the one claim this tool
   * exists to make.
   */
  skippedChecks: string[]
  /** Every probe ran and every probe came back zero. */
  clean: boolean
  /** Everything that did run came back zero, but some probes were skipped. */
  cleanAsFarAsChecked: boolean
}

export interface ExportResult {
  blob: Blob
  fileName: string
  verification: VerificationReport
}

/**
 * Flatten the document to images with the redactions burned into the pixels.
 *
 * Drawing a black rectangle *in* a PDF leaves the text sitting underneath it,
 * one copy-paste away from being recovered. So we never touch the original
 * file: each page is rasterised to a canvas, the boxes are filled onto those
 * pixels, and the canvas — not the page — becomes the exported PDF. The text
 * objects, fonts, vector paths and metadata of the source simply have no path
 * into the output.
 */
export interface ExportOptions {
  /** Name for the downloaded file. Batch exports pass one per source document. */
  fileName?: string
}

export async function exportRedactedPdf(
  pdf: PDFDocumentProxy,
  redactions: RedactionMap,
  onProgress?: (progress: ExportProgress) => void,
  options?: ExportOptions,
): Promise<ExportResult> {
  // Tracks where we were when something threw, so a failure can name the page
  // and phase even when the stack is minified beyond recognition.
  const context = { phase: 'render' as ExportProgress['phase'], page: 0, total: pdf.numPages }
  try {
    return await runExport(pdf, redactions, context, onProgress, options)
  } catch (err) {
    console.error('Export Stack:', err)
    throw new ExportFailure(err, context)
  }
}

/** Carries the original error's stack plus where in the export it happened. */
export class ExportFailure extends Error {
  readonly originalStack: string
  readonly context: { phase: string; page: number; total: number }

  constructor(cause: unknown, context: { phase: string; page: number; total: number }) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(message, { cause })
    this.name = 'ExportFailure'
    this.context = { ...context }
    this.originalStack =
      (cause instanceof Error && cause.stack) || this.stack || '(no stack available)'
  }

  /** Everything worth pasting into a bug report, as one block of text. */
  get details(): string {
    return [
      `${this.name}: ${this.message}`,
      `at phase "${this.context.phase}", page ${this.context.page} of ${this.context.total}`,
      '',
      this.originalStack,
    ].join('\n')
  }
}

async function runExport(
  pdf: PDFDocumentProxy,
  redactions: RedactionMap,
  context: { phase: ExportProgress['phase']; page: number; total: number },
  onProgress?: (progress: ExportProgress) => void,
  options?: ExportOptions,
): Promise<ExportResult> {
  const total = pdf.numPages
  let doc: jsPDF | null = null

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    context.phase = 'render'
    context.page = pageNumber
    onProgress?.({ phase: 'render', page: pageNumber, total })

    const page = await pdf.getPage(pageNumber)
    // Unscaled viewport = the page's true size in PDF points, rotation applied.
    const base = page.getViewport({ scale: 1 })
    // Density is decided per page: a page too large for this engine's canvas
    // gets less of it rather than a blank sheet.
    const pageScale = fitExportScale(base.width, base.height)
    const viewport = page.getViewport({ scale: pageScale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser would not give us a 2D canvas to flatten onto.')

    // Pages may be transparent; the raster needs an opaque white sheet under it.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvas, viewport }).promise

    // Burn the boxes in. The context is scaled into unscaled PDF units so the
    // stored coordinates apply unchanged at any export density — which is why
    // this must use the same scale the page was just rendered at.
    const boxes = asArray(redactions?.[pageNumber])
    if (boxes.length) {
      ctx.save()
      ctx.setTransform(pageScale, 0, 0, pageScale, 0, 0)
      paintBoxes(ctx, boxes)
      ctx.restore()
    }

    context.phase = 'assemble'
    onProgress?.({ phase: 'assemble', page: pageNumber, total })

    const png = assertRasterised(canvas.toDataURL('image/png', 1.0), pageNumber)
    const orientation = base.width > base.height ? 'landscape' : 'portrait'
    const format: [number, number] = [base.width, base.height]

    if (!doc)
      doc = new jsPDF({
        unit: 'pt',
        format,
        orientation,
        compress: true,
        // jsPDF registers the 14 standard fonts in every document by default.
        // We draw no text, so this leaves the output with no font objects at
        // all — nothing for a reader to reconstruct glyphs from.
        putOnlyUsedFonts: true,
      })
    else doc.addPage(format, orientation)

    doc.addImage(png, 'PNG', 0, 0, base.width, base.height, undefined, 'FAST')

    // Release the page-sized bitmap before rasterising the next one.
    canvas.width = 0
    canvas.height = 0
    page.cleanup()
  }

  if (!doc) throw new Error('This document has no pages to export.')

  // Nothing carried over from the source, and nothing about this machine either.
  doc.setProperties({ title: '', subject: '', author: '', keywords: '', creator: '' })
  // jsPDF always writes a CreationDate. Pass the literal PDF date string rather
  // than a Date: a Date is formatted in local time, which would stamp the
  // user's timezone offset onto every file they redact.
  doc.setCreationDate("D:20000101000000+00'00'")

  // jsPDF builds the Blob itself. If a engine ever hands back something else,
  // rebuild it from the raw bytes rather than passing a non-Blob down the chain
  // to `arrayBuffer()` and failing with an unrelated-looking error.
  const output: unknown = doc.output('blob')
  const blob =
    output instanceof Blob
      ? output
      : new Blob([doc.output('arraybuffer') as ArrayBuffer], { type: 'application/pdf' })

  context.phase = 'verify'
  context.page = total
  onProgress?.({ phase: 'verify', page: total, total })
  const verification = await verifyExport(blob)

  return { blob, fileName: options?.fileName ?? 'redacted_document.pdf', verification }
}

/**
 * Re-open the bytes we are about to hand the user and confirm the flattening
 * actually worked: no text to select, no fonts to reconstruct it from, no
 * annotations carrying leftovers.
 */
export async function verifyExport(blob: Blob): Promise<VerificationReport> {
  const skipped = new Set<string>()

  /**
   * Run one probe in isolation. A probe that throws is recorded by name and
   * contributes nothing — never a zero, which would read as "checked and
   * clean". WebKit throws here on exactly the pages we produce: flattened,
   * image-only, with no text streams to walk.
   */
  const probe = async <T>(label: string, run: () => Promise<T> | T): Promise<T | null> => {
    try {
      return await run()
    } catch (err) {
      console.error(`Verification probe "${label}" failed:`, err)
      skipped.add(label)
      return null
    }
  }

  const bytes = new Uint8Array(await blob.arrayBuffer())

  // Object dictionaries are written uncompressed, so font objects can be counted
  // straight off the bytes — a check that does not depend on pdf.js at all, and
  // therefore survives whatever pdf.js does on this engine.
  const fontObjects =
    (await probe(
      'font objects',
      () => asArray(new TextDecoder('latin1').decode(bytes).match(/\/Type\s*\/Font/g)).length,
    )) ?? 0

  const check = await probe('reopen document', () => loadPdfDocument(bytes))
  if (!check) {
    return {
      pages: 0,
      textCharacters: 0,
      textOperators: 0,
      fontObjects,
      annotations: 0,
      skippedChecks: [...skipped],
      clean: false,
      cleanAsFarAsChecked: fontObjects === 0,
    }
  }

  let textCharacters = 0
  let textOperators = 0
  let annotations = 0

  try {
    for (let pageNumber = 1; pageNumber <= check.numPages; pageNumber++) {
      const page = await probe(`page ${pageNumber}`, () => check.getPage(pageNumber))
      if (!page) continue

      // Text extraction. Routed through readPageText because pdf.js's
      // getTextContent async-iterates a ReadableStream, which Safari cannot do
      // — that is what made this probe fail there.
      const content = await probe('text extraction', () => readPageText(page))
      for (const item of asArray(content?.items)) {
        const str = (item as { str?: unknown } | null)?.str
        if (typeof str === 'string') textCharacters += str.trim().length
      }

      // Content stream operators. `fnArray` is array-like but not always a real
      // Array, so it is copied rather than assumed to carry Array.prototype.
      const operatorList = await probe('content stream operators', () => page.getOperatorList())
      for (const fn of Array.from(operatorList?.fnArray ?? [])) {
        if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.setFont) {
          textOperators += 1
        }
      }

      const pageAnnotations = await probe('annotations', () => page.getAnnotations())
      annotations += asArray(pageAnnotations).length

      // Not a probe: releasing page memory is housekeeping, and failing at it
      // says nothing about whether the file is clean.
      try {
        page.cleanup()
      } catch {
        // Ignored deliberately.
      }
    }

    const measuredAreClean =
      textCharacters === 0 && textOperators === 0 && fontObjects === 0 && annotations === 0

    return {
      pages: check.numPages,
      textCharacters,
      textOperators,
      fontObjects,
      annotations,
      skippedChecks: [...skipped],
      clean: measuredAreClean && skipped.size === 0,
      cleanAsFarAsChecked: measuredAreClean,
    }
  } finally {
    void check.loadingTask.destroy().catch(() => {})
  }
}

/** Hand the blob to the browser's downloader. No server, no object left behind. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the download a tick to start before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
