/**
 * A redaction box, stored in *unscaled PDF units* — the coordinate space of
 * `page.getViewport({ scale: 1 })`, which already accounts for page rotation.
 *
 * Keeping boxes in this space (rather than in screen pixels) means zooming,
 * re-rendering and exporting at print density all reuse the same numbers:
 * multiply by the scale you happen to be drawing at and you are done.
 */
export interface RedactionBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  /**
   * Compliance stamp burned into this box, e.g. "FOIA EXEMPTION". Absent on an
   * unstamped box. Stored per box rather than per document, so changing the
   * selector later never rewrites redactions already placed.
   */
  label?: string
}

/** Boxes per 1-based page number. Pages with no redactions are simply absent. */
export type RedactionMap = Record<number, RedactionBox[]>

/** Anything smaller than this in PDF units is a stray click, not a box. */
export const MIN_BOX_SIZE = 3

export function normalizeBox(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function countBoxes(map: RedactionMap): number {
  return Object.values(map).reduce((total, boxes) => total + boxes.length, 0)
}

/**
 * Coerce anything to a safely iterable array.
 *
 * `for (const x of undefined)` fails by looking up `Symbol.iterator` on
 * undefined, which WebKit reports as "undefined is not a function" rather than
 * as a null dereference — an error that reads like a missing method and sends
 * you hunting in the wrong place. Every loop over data we did not construct
 * ourselves goes through here.
 */
export function asArray<T>(value: readonly T[] | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/**
 * Light grey rather than pure white: legible on black at any size without
 * haloing when the page is rasterised and re-compressed at export density.
 */
const LABEL_COLOR = '#e8edf5'

/** System families only — a web font would mean a network request. */
const LABEL_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Below this (in PDF points) a stamp is a smudge, so it is left off. */
const MIN_LABEL_SIZE = 3.5
/** Above this a stamp on a full-page box turns into a poster. */
const MAX_LABEL_SIZE = 13

/**
 * Draw a box's stamp, shrunk to fit inside it.
 *
 * The context is in unscaled PDF units, so the size chosen here is in points
 * and follows the page: the same call renders the on-screen preview at any zoom
 * and the flattened export at print density, which is what keeps the two from
 * ever disagreeing about where the text sits.
 */
function paintLabel(ctx: CanvasRenderingContext2D, box: RedactionBox) {
  const text = box.label?.trim()
  if (!text) return

  const padX = Math.min(3, box.width * 0.08)
  const padY = Math.min(2, box.height * 0.1)
  const availableWidth = box.width - padX * 2
  const availableHeight = box.height - padY * 2
  if (availableWidth <= 1 || availableHeight <= 1) return

  let size = Math.min(MAX_LABEL_SIZE, availableHeight * 0.78)
  ctx.font = `bold ${size}px ${LABEL_FONT}`
  const measured = ctx.measureText(text).width
  // Glyph widths scale linearly with font size, so one measurement is enough to
  // solve for the size that fits rather than stepping down in a loop.
  if (measured > availableWidth) size *= availableWidth / measured
  if (size < MIN_LABEL_SIZE) return

  ctx.font = `bold ${size}px ${LABEL_FONT}`
  ctx.fillStyle = LABEL_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, box.x + box.width / 2, box.y + box.height / 2, availableWidth)
}

/** Paint boxes onto a context already transformed into unscaled PDF units. */
export function paintBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: readonly RedactionBox[] | null | undefined,
  color = '#000000',
) {
  const list = asArray(boxes)

  ctx.fillStyle = color
  for (const box of list) {
    if (!box) continue
    ctx.fillRect(box.x, box.y, box.width, box.height)
  }

  // Stamps go on in a second pass, after every rectangle is down. Interleaved,
  // a later box overlapping an earlier one would bury its stamp under fresh
  // black — the redaction would still be sound, but the code would vanish.
  if (!list.some((box) => box?.label)) return
  ctx.save()
  for (const box of list) {
    if (box) paintLabel(ctx, box)
  }
  ctx.restore()
}
