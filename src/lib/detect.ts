import { type PDFPageProxy } from 'pdfjs-dist'
import { readPageText } from './pdfjs'
import { asArray, type RedactionBox } from './redactions'

/**
 * Multiply two PDF transformation matrices.
 *
 * This is what `pdfjs.Util.transform` does. It is inlined because `Util` is a
 * utility class on the pdf.js entry point rather than part of the documented
 * page API: if a future build tree-shakes it, renames it, or drops it from the
 * export map, `Util.transform(...)` becomes "undefined is not a function" at
 * the exact moment a user runs a scan. Six multiply-adds are not worth that
 * coupling.
 */
function multiplyTransforms(m1: readonly number[], m2: readonly number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

export type SweepCategoryId = 'emails' | 'phones' | 'cards' | 'ssns'

export interface SweepCategory {
  id: SweepCategoryId
  label: string
  hint: string
  /**
   * A factory, not a shared instance: a `/g` regex carries `lastIndex`
   * between calls, so reusing one across text items silently skips matches.
   */
  pattern: () => RegExp
}

export const SWEEP_CATEGORIES: readonly SweepCategory[] = [
  {
    id: 'emails',
    label: 'Emails',
    hint: 'name@domain.com',
    pattern: () => /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
  {
    id: 'phones',
    label: 'Phone Numbers',
    hint: '+1 (555) 123-4567',
    pattern: () => /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    id: 'cards',
    label: 'Credit Cards',
    hint: '13–16 digit numbers',
    pattern: () => /\b(?:\d[ -]*?){13,16}\b/g,
  },
  {
    id: 'ssns',
    label: 'SSNs / ID Numbers',
    hint: '123-45-6789',
    pattern: () => /\b\d{3}-\d{2}-\d{4}\b/g,
  },
]

/**
 * Padding around a detected box, in PDF points.
 *
 * These are deliberately asymmetric with the risk: a box a little too large is
 * ugly, a box a little too small leaks the edge of a digit. Character-width
 * estimates for proportional fonts are approximate, so they get slack.
 */
const PAD_X = 1.5
const ASCENT_FACTOR = 1.0
const DESCENT_FACTOR = 0.3

/** Extra slack on each side of a sliced match, as a fraction of the font height. */
const SLICE_MARGIN = 0.35

/**
 * When a match covers this much of its text item, cover the whole item instead.
 * Slicing buys almost nothing at that point and every slice carries some risk
 * of being a hair too short.
 */
const WHOLE_ITEM_THRESHOLD = 0.6

/**
 * Shared canvas context used only to measure text.
 *
 * Character positions cannot come from dividing the item width by the character
 * count: in a proportional font "SSN: " is far wider than five average
 * characters, which walks the box off the match. Measuring the real prefix
 * width and then normalising so the measured total equals pdf.js's reported
 * advance width gives accurate offsets even though the browser is measuring a
 * substitute font rather than the one embedded in the PDF.
 */
let measuringContext: CanvasRenderingContext2D | null | undefined

function getMeasuringContext(): CanvasRenderingContext2D | null {
  if (measuringContext !== undefined) return measuringContext
  try {
    measuringContext = document.createElement('canvas').getContext('2d')
  } catch {
    measuringContext = null
  }
  return measuringContext
}

/** Anything longer than this is not a line of prose; skip it rather than risk a slow regex. */
const MAX_ITEM_LENGTH = 4000

type DetectedBox = Omit<RedactionBox, 'id'>

interface TextItemLike {
  str: string
  width: number
  height: number
  transform: number[]
  fontName?: string
}

function isTextItem(item: unknown): item is TextItemLike {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as TextItemLike).str === 'string' &&
    Array.isArray((item as TextItemLike).transform)
  )
}

/**
 * Bounding box for a substring of one pdf.js text item, in unscaled PDF units
 * (top-left origin) — the same space redaction boxes are stored in.
 *
 * `Util.transform(viewport.transform, item.transform)` yields
 * `[a, b, c, d, e, f]` where `e`/`f` are the *baseline* origin in viewport
 * coordinates and `hypot(c, d)` is the rendered font height. Verified against a
 * fixture: text drawn at 56.7pt from the left and 141.7pt from the top comes
 * back as e=56.69, f=141.73, height=12.
 */
function boxForMatch(
  item: TextItemLike,
  viewportTransform: number[],
  matchIndex: number,
  matchLength: number,
  fontFamily: string,
): DetectedBox | null {
  if (!Array.isArray(item.transform) || item.transform.length < 6) return null
  const tx = multiplyTransforms(viewportTransform, item.transform)
  const [a, b, c, d, e, f] = tx
  if (![a, b, c, d, e, f].every(Number.isFinite)) return null

  const fontHeight = Math.hypot(c, d) || item.height || 0
  if (fontHeight <= 0) return null

  // Full advance width of the item, in points. Fall back to a rough estimate
  // when pdf.js gives us nothing usable.
  const itemWidth =
    Number.isFinite(item.width) && item.width > 0
      ? item.width
      : item.str.length * fontHeight * 0.5

  const rotated = Math.abs(b) > 0.01 || Math.abs(c) > 0.01
  const top = f - fontHeight * ASCENT_FACTOR
  const height = fontHeight * (ASCENT_FACTOR + DESCENT_FACTOR)

  // Rotated or skewed text cannot be sliced along the x axis, so the whole
  // item gets covered — over-covering is the safe direction to fail in.
  if (rotated) {
    const corners = [
      [0, 0],
      [itemWidth, 0],
      [0, -fontHeight],
      [itemWidth, -fontHeight],
    ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f] as const)

    const xs = corners.map((p) => p[0])
    const ys = corners.map((p) => p[1])
    return {
      x: Math.min(...xs) - PAD_X,
      y: Math.min(...ys) - PAD_X,
      width: Math.max(...xs) - Math.min(...xs) + PAD_X * 2,
      height: Math.max(...ys) - Math.min(...ys) + PAD_X * 2,
    }
  }

  const wholeItem: DetectedBox = {
    x: e - PAD_X,
    y: top,
    width: itemWidth + PAD_X * 2,
    height,
  }

  // A match covering most of the item, or one we cannot measure accurately,
  // takes the whole item. Over-covering is the safe direction to fail in.
  const coversMost = matchLength / Math.max(item.str.length, 1) >= WHOLE_ITEM_THRESHOLD
  const ctx = getMeasuringContext()
  if (coversMost || !ctx) return wholeItem

  ctx.font = `${fontHeight}px ${fontFamily}`
  const measuredTotal = ctx.measureText(item.str).width
  if (!(measuredTotal > 0)) return wholeItem

  // Normalise browser metrics onto pdf.js's reported advance width.
  const normalise = itemWidth / measuredTotal
  const prefix = ctx.measureText(item.str.slice(0, matchIndex)).width * normalise
  const matchWidth =
    ctx.measureText(item.str.slice(matchIndex, matchIndex + matchLength)).width * normalise
  if (!Number.isFinite(prefix) || !Number.isFinite(matchWidth) || matchWidth <= 0) return wholeItem

  // Slack absorbs the residual difference between the substitute font and the
  // real one, so a match is never left with an uncovered character at an edge.
  const margin = fontHeight * SLICE_MARGIN
  const left = Math.max(e - PAD_X, e + prefix - margin)
  const right = Math.min(e + itemWidth + PAD_X, e + prefix + matchWidth + margin)

  return { x: left, y: top, width: Math.max(right - left, 0), height }
}

/** Drops boxes that are effectively the same rectangle (two patterns, one hit). */
function dedupe(boxes: DetectedBox[]): DetectedBox[] {
  const seen = new Set<string>()
  return boxes.filter((box) => {
    const key = [box.x, box.y, box.width, box.height].map((n) => n.toFixed(1)).join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface SweepResult {
  boxes: DetectedBox[]
  /** Matches per category, for feedback in the menu. */
  counts: Record<SweepCategoryId, number>
  /**
   * Set when the page's text could not be read at all, so the caller can say
   * "this browser could not read the text" instead of the indistinguishable
   * and far more dangerous "no matches found".
   */
  unavailableReason?: string
}

/**
 * Scan one page's text for the selected categories and return redaction boxes.
 *
 * Detection runs per text item. pdf.js splits a visual line into several items
 * whenever the font or positioning changes, so a value broken across items —
 * or across a line wrap — will not match. This assists the user; it does not
 * replace looking at the page.
 */
export async function sweepPage(
  page: PDFPageProxy,
  enabled: ReadonlySet<SweepCategoryId>,
): Promise<SweepResult> {
  const counts: Record<SweepCategoryId, number> = { emails: 0, phones: 0, cards: 0, ssns: 0 }
  const boxes: DetectedBox[] = []

  if (enabled.size === 0) return { boxes, counts }

  // Reading the page's text is the one step with no fallback. It is also the
  // step that has already failed once in WebKit, so it fails loudly and by
  // name rather than looking like a page with nothing on it.
  let viewportTransform: number[]
  let content: Awaited<ReturnType<typeof readPageText>> | null = null
  try {
    viewportTransform = page.getViewport({ scale: 1 }).transform
    // Not getTextContent(): that async-iterates a ReadableStream, which Safari
    // cannot do. See readPageText().
    content = await readPageText(page)
  } catch (err) {
    console.error('Smart Sweep could not read the page text:', err)
    return {
      boxes,
      counts,
      unavailableReason: err instanceof Error ? err.message : String(err),
    }
  }

  if (!Array.isArray(viewportTransform) || viewportTransform.length < 6) {
    return { boxes, counts, unavailableReason: 'This page has no usable coordinate system.' }
  }

  const styles = content?.styles ?? {}

  for (const rawItem of asArray(content?.items)) {
    if (!isTextItem(rawItem)) continue
    const { str } = rawItem
    // Explicit, even though isTextItem already narrowed it: this is the value
    // every regex below is about to be called on.
    if (typeof str !== 'string' || str.length === 0 || str.length > MAX_ITEM_LENGTH) continue

    // pdf.js reports the substitute family it would use for this font.
    const fontFamily = styles[rawItem.fontName ?? '']?.fontFamily || 'sans-serif'

    for (const category of SWEEP_CATEGORIES) {
      if (!enabled.has(category.id)) continue

      const regex = category.pattern()
      if (!(regex instanceof RegExp)) continue

      let match: RegExpExecArray | null
      while ((match = regex.exec(str)) !== null) {
        // A zero-length match would loop forever.
        if (match[0].length === 0) {
          regex.lastIndex += 1
          continue
        }

        // One malformed item must not abandon the rest of the page.
        let box: DetectedBox | null = null
        try {
          box = boxForMatch(rawItem, viewportTransform, match.index, match[0].length, fontFamily)
        } catch (err) {
          console.error('Smart Sweep skipped a text item:', err)
          continue
        }

        if (box && box.width > 0 && box.height > 0) {
          boxes.push(box)
          counts[category.id] += 1
        }
      }
    }
  }

  return { boxes: dedupe(boxes), counts }
}
