import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  clamp,
  MIN_BOX_SIZE,
  normalizeBox,
  paintBoxes,
  type RedactionBox,
} from '../lib/redactions'

interface RedactionLayerProps {
  /** Page size in unscaled PDF units — the space boxes are stored in. */
  baseWidth: number
  baseHeight: number
  scale: number
  boxes: RedactionBox[]
  drawMode: boolean
  onAdd: (box: Omit<RedactionBox, 'id'>) => void
}

interface Draft {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * A transparent canvas sitting exactly on top of the rendered page. It owns
 * every redaction box: the page canvas underneath is never touched, so a
 * re-render at a new zoom level can't lose them.
 */
export function RedactionLayer({
  baseWidth,
  baseHeight,
  scale,
  boxes,
  drawMode,
  onAdd,
}: RedactionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  // The draft is mirrored in a ref so committing it never has to happen inside
  // a state updater — those must stay pure, and React runs them twice in
  // StrictMode, which would add every box twice.
  const draftRef = useRef<Draft | null>(null)
  const drawing = useRef(false)

  const setDraftBox = useCallback((next: Draft | null) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  /**
   * Viewport pixel → unscaled PDF unit, clamped to the page.
   *
   * The divisor comes from the element's measured width, not from the zoom
   * level: on a narrow screen CSS shrinks the page below its zoom size, and a
   * finger must still land where the user aimed.
   */
  const toPdfPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      const displayScale = rect.width / baseWidth || scale
      return {
        x: clamp((clientX - rect.left) / displayScale, 0, baseWidth),
        y: clamp((clientY - rect.top) / displayScale, 0, baseHeight),
      }
    },
    [baseHeight, baseWidth, scale],
  )

  const begin = useCallback(
    (clientX: number, clientY: number) => {
      if (!drawMode) return
      const { x, y } = toPdfPoint(clientX, clientY)
      drawing.current = true
      setDraftBox({ x1: x, y1: y, x2: x, y2: y })
    },
    [drawMode, setDraftBox, toPdfPoint],
  )

  const extend = useCallback(
    (clientX: number, clientY: number) => {
      const current = draftRef.current
      if (!drawing.current || !current) return
      const { x, y } = toPdfPoint(clientX, clientY)
      setDraftBox({ ...current, x2: x, y2: y })
    },
    [setDraftBox, toPdfPoint],
  )

  const finish = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    const current = draftRef.current
    setDraftBox(null)
    if (!current) return
    const box = normalizeBox(current.x1, current.y1, current.x2, current.y2)
    // A plain click (or a hairline drag) is not a redaction.
    if (box.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE) onAdd(box)
  }, [onAdd, setDraftBox])

  const cancel = useCallback(() => {
    drawing.current = false
    setDraftBox(null)
  }, [setDraftBox])

  // Mouse can leave the canvas (or the window) mid-drag, so the move/up half of
  // the gesture is tracked on the window rather than on the element.
  useEffect(() => {
    if (!drawMode) return
    const onMove = (e: MouseEvent) => extend(e.clientX, e.clientY)
    const onUp = () => finish()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drawMode, extend, finish])

  // Touch: the move listener must be non-passive so the page doesn't scroll
  // out from under the finger that is drawing.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !drawMode) return

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      e.preventDefault()
      begin(touch.clientX, touch.clientY)
    }
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch || !drawing.current) return
      e.preventDefault()
      extend(touch.clientX, touch.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!drawing.current) return
      e.preventDefault()
      finish()
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', cancel)
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', cancel)
    }
  }, [begin, cancel, drawMode, extend, finish])

  // Escape abandons the box currently being dragged.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // Repaint committed boxes plus the in-progress one.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(baseWidth * scale * dpr)
    canvas.height = Math.floor(baseHeight * scale * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Draw in unscaled PDF units. This maps them onto the backing store, which
    // is independent of how wide CSS ends up displaying the canvas.
    const toBackingStore = canvas.width / baseWidth
    ctx.setTransform(toBackingStore, 0, 0, toBackingStore, 0, 0)

    paintBoxes(ctx, boxes)

    if (draft) {
      const box = normalizeBox(draft.x1, draft.y1, draft.x2, draft.y2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.fillRect(box.x, box.y, box.width, box.height)
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 1 / toBackingStore
      ctx.strokeRect(box.x, box.y, box.width, box.height)
    }
  }, [baseHeight, baseWidth, boxes, draft, scale])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={(e) => {
        e.preventDefault()
        begin(e.clientX, e.clientY)
      }}
      aria-label={drawMode ? 'Redaction layer — drag to draw a black box' : 'Redaction layer'}
      // Width only: the height follows the canvas's own aspect ratio, which lets
      // `max-w-full h-auto` shrink it to fit a phone without distorting it.
      // `touch-action: none` keeps a drawing finger from scrolling the page.
      style={{ width: `${Math.floor(baseWidth * scale)}px`, touchAction: 'none' }}
      className={`absolute left-0 top-0 block h-auto max-w-full ${
        drawMode ? 'cursor-crosshair' : 'pointer-events-none'
      }`}
    />
  )
}
