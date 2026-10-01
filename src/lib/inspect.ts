import { destroyPdfDocument, loadPdfDocument, readPageText } from './pdfjs'

/**
 * How much recoverable text to keep for display. Counting is exact across the
 * whole document; only the previewed sample is capped, so a 400-page file does
 * not try to render its entire text layer into the DOM.
 */
const SAMPLE_CAP = 24000

export interface InspectionResult {
  pageCount: number
  /** Pages that yielded any recoverable text. */
  pagesWithText: number
  /** Total non-whitespace characters extractable from the text layer. */
  characters: number
  words: number
  /** The recoverable text itself, capped at SAMPLE_CAP, so the user can see it. */
  sample: string
  sampleTruncated: boolean
  /** Pages whose text could not be read at all (so "clean" is never guessed). */
  unreadablePages: number[]
}

interface TextItemLike {
  str?: unknown
}

/**
 * Pull every bit of recoverable text out of a PDF, entirely in this tab.
 *
 * This is the diagnostic behind the Leak Checker: a PDF "redacted" by drawing
 * black boxes still carries its text in the content stream, and this reads it
 * back exactly the way an attacker's copy-paste or `pdftotext` would. A truly
 * flattened (rasterized) document has no text layer, so it returns zero.
 *
 * Nothing is uploaded — the bytes come from a local FileReader and pdf.js
 * parses them in a worker in this tab.
 */
export async function inspectPdf(
  bytes: Uint8Array,
  onProgress?: (page: number, total: number) => void,
): Promise<InspectionResult> {
  const pdf = await loadPdfDocument(bytes)
  const total = pdf.numPages
  let characters = 0
  let words = 0
  let pagesWithText = 0
  let sample = ''
  let sampleTruncated = false
  const unreadablePages: number[] = []

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      onProgress?.(pageNumber, total)
      let page: Awaited<ReturnType<typeof pdf.getPage>> | null = null
      try {
        page = await pdf.getPage(pageNumber)
        const { items } = await readPageText(page)

        let pageText = ''
        for (const raw of items) {
          const str = (raw as TextItemLike)?.str
          if (typeof str === 'string' && str.length > 0) pageText += str + ' '
        }

        // Normalise so layout whitespace is not counted as "recoverable data":
        // a run of positioning spaces is not text someone can read back.
        const visible = pageText.replace(/\s+/g, ' ').trim()
        if (visible.length > 0) {
          pagesWithText++
          characters += visible.length
          words += visible.split(' ').length

          if (sample.length < SAMPLE_CAP) {
            const room = SAMPLE_CAP - sample.length
            const addition = `${visible}\n\n`
            if (addition.length > room) {
              sample += addition.slice(0, room)
              sampleTruncated = true
            } else {
              sample += addition
            }
          } else {
            sampleTruncated = true
          }
        }
      } catch {
        // A page whose text cannot be read is reported, never silently treated
        // as clean — "no text found" and "could not look" are different answers.
        unreadablePages.push(pageNumber)
      } finally {
        try {
          page?.cleanup()
        } catch {
          // Housekeeping only.
        }
      }
    }
  } finally {
    destroyPdfDocument(pdf)
  }

  return {
    pageCount: total,
    pagesWithText,
    characters,
    words,
    sample: sample.trim(),
    sampleTruncated,
    unreadablePages,
  }
}
