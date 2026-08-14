/**
 * How many canvas pixels this device can be trusted with.
 *
 * A phone does not report "you are out of canvas memory" — it discards the
 * bitmap (leaving a blank page) or kills the tab. The viewer holds two live
 * canvases at once, the page and the redaction overlay, so the budget is
 * shared between them rather than applied twice.
 */

/** Neither axis may exceed this on any engine; WebKit refuses well before it. */
export const MAX_CANVAS_SIDE = 8192

/** Desktop ceiling — WebKit's documented ~16.7M pixel canvas limit. */
const DESKTOP_BUDGET = 16_777_216

interface DeviceHints {
  deviceMemory?: number
  hardwareConcurrency?: number
}

let cachedBudget: number | null = null

/**
 * Total canvas pixels available to the viewer, chosen from what the device is
 * willing to tell us. `navigator.deviceMemory` is Chromium-only, so screen size
 * carries the decision everywhere else.
 */
export function canvasPixelBudget(): number {
  if (cachedBudget !== null) return cachedBudget

  const nav = navigator as Navigator & DeviceHints
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const shortestEdge = Math.min(screen.width || 0, screen.height || 0)
  const phoneSized = shortestEdge > 0 && shortestEdge < 500

  let budget = DESKTOP_BUDGET
  if (memory !== null && memory <= 2) budget = 3_000_000
  else if (phoneSized) budget = 6_000_000
  else if (memory !== null && memory <= 4) budget = 8_000_000
  else if (shortestEdge > 0 && shortestEdge < 820) budget = 10_000_000

  cachedBudget = budget
  return budget
}

/**
 * Backing-store scale for a canvas displayed at `cssWidth` × `cssHeight`.
 *
 * Returns the device pixel ratio to render at, reduced until the bitmap fits
 * both the pixel budget and the per-axis limit. The CSS size is never changed,
 * so layout and the overlay's alignment are unaffected — only sharpness gives
 * way, which is the right thing to trade for a tab that stays alive.
 */
export function backingStoreScale(
  cssWidth: number,
  cssHeight: number,
  options: { maxRatio?: number; budgetShare?: number } = {},
): number {
  const { maxRatio = 2, budgetShare = 1 } = options
  if (!(cssWidth > 0) || !(cssHeight > 0)) return 1

  let ratio = Math.min(window.devicePixelRatio || 1, maxRatio)

  const budget = canvasPixelBudget() * budgetShare
  const area = cssWidth * cssHeight
  if (area * ratio * ratio > budget) ratio = Math.sqrt(budget / area)

  // Per-axis ceiling, independent of total area.
  ratio = Math.min(ratio, MAX_CANVAS_SIDE / cssWidth, MAX_CANVAS_SIDE / cssHeight)

  // Below this the page stops being readable; a very large page at deep zoom
  // simply renders soft rather than not at all.
  return Math.max(ratio, 0.1)
}
