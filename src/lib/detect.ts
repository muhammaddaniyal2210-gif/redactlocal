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

export type SweepGroupId = 'communications' | 'identifiers' | 'financial'

export type SweepCategoryId =
  | 'emails'
  | 'phones'
  | 'ssns'
  | 'ein'
  | 'govIds'
  | 'aadhaar'
  | 'cards'
  | 'iban'
  | 'accounts'

export interface SweepGroup {
  id: SweepGroupId
  label: string
}

export const SWEEP_GROUPS: readonly SweepGroup[] = [
  { id: 'communications', label: 'Communications' },
  { id: 'identifiers', label: 'Official identifiers' },
  { id: 'financial', label: 'Financial data' },
]

export interface SweepCategory {
  id: SweepCategoryId
  group: SweepGroupId
  label: string
  hint: string
  /**
   * A factory, not a shared instance: a `/g` regex carries `lastIndex`
   * between calls, so reusing one across text items silently skips matches.
   */
  pattern: () => RegExp
  /**
   * When set, the box covers this capture group rather than the whole match,
   * so a context-anchored pattern blacks out the number and not the label
   * that found it.
   */
  capture?: number
  /**
   * Narrows the box to part of the matched value, for rules that require a
   * value to stay *partly* readable — UIDAI's "mask the first eight digits,
   * keep the last four" being the case this exists for.
   *
   * Receives the matched text (after `capture` has been applied) and returns
   * the character range to cover, or `null` when there is nothing to mask.
   * The finding still reports the whole value, so the reviewer sees what was
   * found rather than only the part being covered.
   */
  maskSpan?: (text: string) => { start: number; end: number } | null
}

/**
 * Cover every digit except the last `keep`, along with any separators in
 * between, and leave the tail readable.
 *
 * Written against digit positions rather than character count so it behaves
 * identically for `234567890123`, `2345 6789 0123` and `2345-6789-0123`: in
 * all three the same eight digits go under the box.
 */
export function maskAllButLastDigits(keep: number) {
  return (text: string): { start: number; end: number } | null => {
    const digits: number[] = []
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code >= 48 && code <= 57) digits.push(i)
    }
    // Nothing to mask: covering the whole thing here would be the opposite of
    // what a partial rule asks for, so this is not reported as a finding.
    if (digits.length <= keep) return null
    return { start: digits[0], end: digits[digits.length - keep - 1] + 1 }
  }
}

/**
 * Patterns are deliberately a little greedy. Every hit is reviewed by hand in
 * the panel before anything is drawn, so a false positive costs one click,
 * while a missed identifier costs a leak.
 */
export const SWEEP_CATEGORIES: readonly SweepCategory[] = [
  {
    id: 'emails',
    group: 'communications',
    label: 'Email addresses',
    hint: 'name@domain.com',
    pattern: () => /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
  {
    id: 'phones',
    group: 'communications',
    label: 'Phone numbers',
    hint: '+1 (555) 123-4567',
    pattern: () => /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    id: 'ssns',
    group: 'identifiers',
    label: 'Social security numbers',
    hint: '123-45-6789',
    pattern: () => /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    id: 'ein',
    group: 'identifiers',
    label: 'Tax IDs (EIN)',
    hint: '12-3456789',
    pattern: () => /\b\d{2}-\d{7}\b/g,
  },
  {
    id: 'govIds',
    group: 'identifiers',
    label: 'Passport & national IDs',
    hint: 'AB1234567, 35202-8847193-7',
    pattern: () => /\b(?:\d{5}-\d{7}-\d|[A-Z]{1,2}\d{6,8})\b/g,
  },
  {
    id: 'aadhaar',
    group: 'identifiers',
    label: 'Aadhaar numbers (mask first 8)',
    hint: '2345 6789 0123 — last 4 stay readable',
    // Twelve digits, optionally grouped in fours by a space or hyphen.
    //
    // The leading `[2-9]` is a real UIDAI rule, not a guess: an Aadhaar number
    // never begins with 0 or 1, which cheaply rejects a great many ordinary
    // twelve-digit numbers. The surrounding guards stop the pattern biting a
    // twelve-digit window out of the middle of a longer run of digits, which
    // is how a sixteen-digit card number would otherwise come back as an
    // Aadhaar. A capture group is used rather than a lookbehind because
    // lookbehind still throws at parse time in older WebKit.
    pattern: () => /(^|[^\d-])([2-9]\d{3}[ -]?\d{4}[ -]?\d{4})(?![\d-])/g,
    capture: 2,
    maskSpan: maskAllButLastDigits(4),
  },
  {
    id: 'cards',
    group: 'financial',
    label: 'Card numbers',
    hint: '13-16 digit numbers',
    pattern: () => /\b(?:\d[ -]*?){13,16}\b/g,
  },
  {
    id: 'iban',
    group: 'financial',
    label: 'IBAN / SWIFT',
    hint: 'GB29NWBK60161331926819',
    pattern: () => /\b[A-Z]{2}\d{2}[A-Z0-9]{10,28}\b/g,
  },
  {
    id: 'accounts',
    group: 'financial',
    label: 'Account & routing numbers',
    hint: 'labelled account digits',
    // Anchored on the label so ordinary long numbers are not swept up; the
    // capture group keeps the box on the digits.
    pattern: () => /(?:a\/c|acct\.?|account|routing|sort code|iban)\s*(?:no\.?|number|#)?\s*[:#-]?\s*(\d[\d -]{5,20}\d)/gi,
    capture: 1,
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
  /**
   * Set for a partial mask, where widening the box to the whole text item
   * would cover the very characters the rule requires to stay readable. It
   * suppresses the whole-item shortcut but cannot conjure measurements: when
   * the slice genuinely cannot be computed the result still falls back to the
   * whole item, and `sliced: false` tells the caller not to claim otherwise.
   */
  preferSlice = false,
): { box: DetectedBox; sliced: boolean } | null {
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
      box: {
        x: Math.min(...xs) - PAD_X,
        y: Math.min(...ys) - PAD_X,
        width: Math.max(...xs) - Math.min(...xs) + PAD_X * 2,
        height: Math.max(...ys) - Math.min(...ys) + PAD_X * 2,
      },
      sliced: false,
    }
  }

  const wholeItem: DetectedBox = {
    x: e - PAD_X,
    y: top,
    width: itemWidth + PAD_X * 2,
    height,
  }

  // A match covering most of the item, or one we cannot measure accurately,
  // takes the whole item. Over-covering is the safe direction to fail in —
  // except for a partial mask, where the whole item is exactly what must not
  // be covered, so the shortcut is skipped and the slice attempted properly.
  const coversMost = matchLength / Math.max(item.str.length, 1) >= WHOLE_ITEM_THRESHOLD
  const ctx = getMeasuringContext()
  if ((coversMost && !preferSlice) || !ctx) return { box: wholeItem, sliced: false }

  ctx.font = `${fontHeight}px ${fontFamily}`
  const measuredTotal = ctx.measureText(item.str).width
  if (!(measuredTotal > 0)) return { box: wholeItem, sliced: false }

  // Normalise browser metrics onto pdf.js's reported advance width.
  const normalise = itemWidth / measuredTotal
  const prefix = ctx.measureText(item.str.slice(0, matchIndex)).width * normalise
  const matchWidth =
    ctx.measureText(item.str.slice(matchIndex, matchIndex + matchLength)).width * normalise
  if (!Number.isFinite(prefix) || !Number.isFinite(matchWidth) || matchWidth <= 0) {
    return { box: wholeItem, sliced: false }
  }

  // Slack absorbs the residual difference between the substitute font and the
  // real one, so a match is never left with an uncovered character at an edge.
  const margin = fontHeight * SLICE_MARGIN
  // A partial mask spills into the characters it is required to leave
  // readable if it uses that same generous slack: at a 12pt font the margin
  // is 4.2pt against a digit roughly 6.7pt wide, which would put a black box
  // over most of the first digit the rule says to keep. Half a character of
  // the matched run is enough to absorb measurement error while still landing
  // inside the separator that precedes the retained group.
  const trailMargin = preferSlice
    ? Math.min(margin, matchWidth / Math.max(matchLength, 1) / 2)
    : margin
  const left = Math.max(e - PAD_X, e + prefix - margin)
  const right = Math.min(e + itemWidth + PAD_X, e + prefix + matchWidth + trailMargin)

  return { box: { x: left, y: top, width: Math.max(right - left, 0), height }, sliced: true }
}

export interface ScanMatch {
  id: string
  category: SweepCategoryId
  group: SweepGroupId
  /** 1-based page the match was found on. */
  page: number
  /** The matched text itself — the whole value, even when only part is covered. */
  text: string
  /** Surrounding line, for judging a false positive at a glance. */
  snippet: string
  box: DetectedBox
  /**
   * Set only when the box deliberately covers part of the value, so the panel
   * can show which characters survive. Absent whenever the whole match is
   * covered — including when a partial mask was wanted but the slice could
   * not be measured and the box fell back to covering everything.
   */
  partialMask?: { masked: string; kept: string }
}

export interface PageScan {
  matches: ScanMatch[]
  /**
   * Set when the page's text could not be read at all, so the caller can say
   * "this browser could not read the text" instead of the indistinguishable
   * and far more dangerous "no matches found".
   */
  unavailableReason?: string
}

/** Stop rather than lock the tab up on a pathological document. */
const MAX_MATCHES = 2000

const SNIPPET_PAD = 28

function buildSnippet(str: string, index: number, length: number): string {
  const from = Math.max(0, index - SNIPPET_PAD)
  const to = Math.min(str.length, index + length + SNIPPET_PAD)
  return `${from > 0 ? '…' : ''}${str.slice(from, to).trim()}${to < str.length ? '…' : ''}`
}

/**
 * Where inside the whole match the reported span sits.
 *
 * With a capture group the box should cover the group, not the label that
 * anchored the pattern. `d`-flag indices give that exactly; without them the
 * whole match is covered instead, which over-covers rather than under-covers.
 */
function spanFor(match: RegExpExecArray, capture: number | undefined) {
  if (!capture) return { index: match.index, length: match[0].length }

  const group = match[capture]
  if (typeof group !== 'string' || group.length === 0) {
    return { index: match.index, length: match[0].length }
  }

  const indices = (match as RegExpExecArray & { indices?: Array<[number, number] | undefined> })
    .indices
  const pair = indices?.[capture]
  if (pair) return { index: pair[0], length: pair[1] - pair[0] }

  const offset = match[0].indexOf(group)
  if (offset < 0) return { index: match.index, length: match[0].length }
  return { index: match.index + offset, length: group.length }
}

let matchSeq = 0

/**
 * Scan one page's text and return every match with its box and context.
 *
 * Detection runs per text item. pdf.js splits a visual line into several items
 * whenever the font or positioning changes, so a value broken across items —
 * or across a line wrap — will not match. This assists the user; it does not
 * replace looking at the page.
 */
export async function scanPage(
  page: PDFPageProxy,
  pageNumber: number,
  enabled: ReadonlySet<SweepCategoryId>,
): Promise<PageScan> {
  const matches: ScanMatch[] = []
  if (enabled.size === 0) return { matches }

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
    console.error('Find & Redact could not read the page text:', err)
    return { matches, unavailableReason: err instanceof Error ? err.message : String(err) }
  }

  if (!Array.isArray(viewportTransform) || viewportTransform.length < 6) {
    return { matches, unavailableReason: 'This page has no usable coordinate system.' }
  }

  const styles = content?.styles ?? {}
  const seen = new Set<string>()

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
        if (match[0].length === 0) {
          regex.lastIndex += 1
          continue
        }
        if (matches.length >= MAX_MATCHES) return { matches }

        const { index, length } = spanFor(match, category.capture)
        const value = str.slice(index, index + length)

        // A partial rule moves the box onto a sub-range of the value while the
        // finding keeps reporting the value in full.
        let boxIndex = index
        let boxLength = length
        let wanted: { start: number; end: number } | null = null
        if (category.maskSpan) {
          wanted = category.maskSpan(value)
          // Too few digits to mask anything while honouring the rule. Covering
          // it wholesale would contradict the rule, so it is not a finding.
          if (!wanted) continue
          boxIndex = index + wanted.start
          boxLength = wanted.end - wanted.start
        }

        let result: { box: DetectedBox; sliced: boolean } | null = null
        try {
          result = boxForMatch(
            rawItem,
            viewportTransform,
            boxIndex,
            boxLength,
            fontFamily,
            wanted !== null,
          )
        } catch (err) {
          console.error('Find & Redact skipped a text item:', err)
          continue
        }
        if (!result) continue
        const { box, sliced } = result
        if (box.width <= 0 || box.height <= 0) continue

        // Only claim a partial mask when the box really was sliced. If the
        // slice could not be measured the box covers the whole item, and
        // saying "last 4 kept" there would be a lie about what is on the page.
        const partialMask =
          wanted && sliced
            ? { masked: value.slice(wanted.start, wanted.end), kept: value.slice(wanted.end) }
            : undefined

        // Two patterns hitting the same characters is one finding, not two.
        const key = [box.x, box.y, box.width, box.height].map((n) => n.toFixed(1)).join(':')
        if (seen.has(key)) continue
        seen.add(key)

        matches.push({
          id: `match-${++matchSeq}`,
          category: category.id,
          group: category.group,
          page: pageNumber,
          text: value,
          snippet: buildSnippet(str, index, length),
          box,
          partialMask,
        })
      }
    }
  }

  return { matches: dropContained(matches) }
}

/**
 * Drop a finding whose box sits entirely inside another's.
 *
 * Patterns overlap by design — the phone matcher happily takes the first
 * thirteen characters of a national ID. The wider match already covers those
 * characters, so the narrower one is a duplicate row for the same ink, not a
 * second finding.
 */
function dropContained(matches: ScanMatch[]): ScanMatch[] {
  const T = 0.5
  return matches.filter((candidate) =>
    // A partial mask is always contained in a full cover of the same value —
    // that is what makes it partial — so the rule above would delete exactly
    // the finding the user turned the preset on for. It stays, and the
    // reviewer chooses between the two.
    candidate.partialMask !== undefined ||
    !matches.some((other) => {
      if (other === candidate || other.page !== candidate.page) return false
      const widerThan =
        other.box.width * other.box.height > candidate.box.width * candidate.box.height
      if (!widerThan) return false
      return (
        candidate.box.x >= other.box.x - T &&
        candidate.box.y >= other.box.y - T &&
        candidate.box.x + candidate.box.width <= other.box.x + other.box.width + T &&
        candidate.box.y + candidate.box.height <= other.box.y + other.box.height + T
      )
    }),
  )
}

export interface DocumentScan {
  matches: ScanMatch[]
  pagesScanned: number
  /** Pages whose text could not be read, by page number. */
  unreadablePages: number[]
}

/**
 * Scan every page. Pages are read one at a time and released immediately —
 * holding a whole document's text content at once is what makes a phone
 * discard the tab.
 */
export async function scanDocument(
  pdf: { numPages: number; getPage: (n: number) => Promise<PDFPageProxy> },
  enabled: ReadonlySet<SweepCategoryId>,
  onProgress?: (page: number, total: number) => void,
): Promise<DocumentScan> {
  const matches: ScanMatch[] = []
  const unreadablePages: number[] = []
  const total = pdf.numPages

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    onProgress?.(pageNumber, total)
    let page: PDFPageProxy | null = null
    try {
      page = await pdf.getPage(pageNumber)
      const scan = await scanPage(page, pageNumber, enabled)
      if (scan.unavailableReason) unreadablePages.push(pageNumber)
      for (const m of scan.matches) matches.push(m)
    } catch (err) {
      console.error(`Find & Redact could not scan page ${pageNumber}:`, err)
      unreadablePages.push(pageNumber)
    } finally {
      try {
        page?.cleanup()
      } catch {
        // Housekeeping only.
      }
    }
    if (matches.length >= MAX_MATCHES) break
  }

  return { matches, pagesScanned: total, unreadablePages }
}
