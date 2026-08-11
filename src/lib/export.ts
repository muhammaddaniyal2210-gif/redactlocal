import { jsPDF } from 'jspdf'
import { OPS, type PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument } from './pdfjs'
import { asArray, paintBoxes, type RedactionMap } from './redactions'

/**
 * Raster density for the export, as a multiple of the PDF's own 72 dpi user
 * space. 2 → 144 dpi, which stays readable when printed without making a
 * 20-page document unmanageably large.
 */
export const EXPORT_SCALE = 2

/**
 * WebKit refuses to back a canvas larger than roughly 16.7 million pixels, and
 * caps each axis well below what other engines allow. Over the limit it does
 * not throw — it hands back a blank bitmap, and `toDataURL` returns the empty
 * `"data:,"`. That would produce a silently blank "redacted" page, which for
 * this tool is the worst possible failure, so oversized pages are rasterised at
 * a reduced density instead. A2 and smaller are unaffected at EXPORT_SCALE.
 */
const MAX_CANVAS_AREA = 16_777_216
const MAX_CANVAS_SIDE = 8_192

/** Largest scale at which this page still fits inside the canvas limits. */
function fitExportScale(baseWidth: number, baseHeight: number): number {
  if (!(baseWidth > 0) || !(baseHeight > 0)) return EXPORT_SCALE
  return Math.min(
    EXPORT_SCALE,
    MAX_CANVAS_SIDE / baseWidth,
    MAX_CANVAS_SIDE / baseHeight,
    Math.sqrt(MAX_CANVAS_AREA / (baseWidth * baseHeight)),
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
  /** True only when nothing above is recoverable. */
  clean: boolean
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
export async function exportRedactedPdf(
  pdf: PDFDocumentProxy,
  redactions: RedactionMap,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  const total = pdf.numPages
  let doc: jsPDF | null = null

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
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

  onProgress?.({ phase: 'verify', page: total, total })
  const verification = await verifyExport(blob)

  return { blob, fileName: 'redacted_document.pdf', verification }
}

/**
 * Re-open the bytes we are about to hand the user and confirm the flattening
 * actually worked: no text to select, no fonts to reconstruct it from, no
 * annotations carrying leftovers.
 */
export async function verifyExport(blob: Blob): Promise<VerificationReport> {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  // Object dictionaries are written uncompressed, so font objects can be counted
  // straight off the bytes — a check that does not depend on pdf.js at all.
  const fontObjects = asArray(
    new TextDecoder('latin1').decode(bytes).match(/\/Type\s*\/Font/g),
  ).length

  const check = await loadPdfDocument(bytes)

  let textCharacters = 0
  let textOperators = 0
  let annotations = 0

  try {
    for (let pageNumber = 1; pageNumber <= check.numPages; pageNumber++) {
      const page = await check.getPage(pageNumber)

      // Everything below comes out of pdf.js rather than out of our own code,
      // and a page with no text at all — which is exactly what we just built —
      // is the case most likely to hand back a missing collection instead of an
      // empty one. Iterating that directly is what throws in WebKit.
      const content = await page.getTextContent()
      for (const item of asArray(content?.items)) {
        if (item && 'str' in item && typeof item.str === 'string') {
          textCharacters += item.str.trim().length
        }
      }

      const operatorList = await page.getOperatorList()
      // `fnArray` is array-like but not always a real Array, so it is copied
      // rather than assumed to carry Array.prototype.filter.
      for (const fn of Array.from(operatorList?.fnArray ?? [])) {
        if (fn === OPS.showText || fn === OPS.showSpacedText || fn === OPS.setFont) {
          textOperators += 1
        }
      }

      annotations += asArray(await page.getAnnotations()).length
      page.cleanup()
    }

    return {
      pages: check.numPages,
      textCharacters,
      textOperators,
      fontObjects,
      annotations,
      clean:
        textCharacters === 0 && textOperators === 0 && fontObjects === 0 && annotations === 0,
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
