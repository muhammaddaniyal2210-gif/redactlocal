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

/** Paint boxes onto a context already transformed into unscaled PDF units. */
export function paintBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: readonly RedactionBox[] | null | undefined,
  color = '#000000',
) {
  ctx.fillStyle = color
  for (const box of asArray(boxes)) {
    if (!box) continue
    ctx.fillRect(box.x, box.y, box.width, box.height)
  }
}
