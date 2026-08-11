import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RenderTask } from 'pdfjs-dist'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileText,
  Loader2,
  Maximize2,
  MousePointer2,
  ShieldCheck,
  ShieldAlert,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { formatBytes, isRenderCancelled } from '../lib/pdfjs'
import {
  downloadBlob,
  exportRedactedPdf,
  type ExportProgress,
  type VerificationReport,
} from '../lib/export'
import { AdSlot } from './AdSlot'
import { RedactionLayer } from './RedactionLayer'
import { useRedactions } from '../hooks/useRedactions'
import type { LoadedDoc } from '../hooks/usePdfDocument'

interface PdfViewerProps {
  doc: LoadedDoc
  onClose: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const ZOOM_STEP = 0.25
const STAGE_PADDING = 48

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

export function PdfViewer({ doc, onClose }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const renderTask = useRef<RenderTask | null>(null)

  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [rendering, setRendering] = useState(true)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState('1')

  const [drawMode, setDrawMode] = useState(true)
  const { boxes, addBox, undoLast, clearPage, clearAll, total } = useRedactions()
  const pageBoxes = boxes[pageNumber] ?? []

  const [exporting, setExporting] = useState<ExportProgress | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [report, setReport] = useState<VerificationReport | null>(null)

  // A new document starts clean: page 1, 100 %, no redactions carried over.
  useEffect(() => {
    setPageNumber(1)
    setPageInput('1')
    setScale(1)
    clearAll()
    setReport(null)
    setExportError(null)
  }, [doc, clearAll])

  useEffect(() => setPageInput(String(pageNumber)), [pageNumber])

  const goTo = useCallback(
    (next: number) => setPageNumber(Math.min(doc.pageCount, Math.max(1, next))),
    [doc.pageCount],
  )

  /** Scale that makes the current page exactly fill the stage width. */
  const fitToWidth = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    const page = await doc.pdf.getPage(pageNumber)
    const base = page.getViewport({ scale: 1 })
    setScale(clampScale((stage.clientWidth - STAGE_PADDING) / base.width))
  }, [doc.pdf, pageNumber])

  // Render the current page into the canvas. Re-runs on page or zoom change;
  // any in-flight render is cancelled first so pages can't land out of order.
  useLayoutEffect(() => {
    let cancelled = false

    async function render() {
      const canvas = canvasRef.current
      if (!canvas) return

      renderTask.current?.cancel()
      setRendering(true)
      setRenderError(null)

      try {
        const page = await doc.pdf.getPage(pageNumber)
        if (cancelled) return

        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale })
        setPageSize({ width: base.width, height: base.height })

        // Render at device resolution so text stays sharp on HiDPI screens,
        // then scale the canvas back down with CSS.
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        // Width only — `h-auto` then derives the height from the canvas's own
        // ratio, so `max-w-full` can shrink the page on a phone undistorted.
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.removeProperty('height')

        const task = page.render({
          canvas,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        })
        renderTask.current = task
        await task.promise
        if (cancelled) return
        setRendering(false)
      } catch (err) {
        if (cancelled || isRenderCancelled(err)) return
        setRenderError(err instanceof Error ? err.message : 'This page could not be rendered.')
        setRendering(false)
      }
    }

    void render()
    return () => {
      cancelled = true
      renderTask.current?.cancel()
      renderTask.current = null
    }
  }, [doc.pdf, pageNumber, scale])

  // Arrow keys page through the document when focus isn't in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea|select/i.test(target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(pageNumber + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(pageNumber - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, pageNumber])

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10)
    if (Number.isNaN(parsed)) setPageInput(String(pageNumber))
    else goTo(parsed)
  }

  const runExport = useCallback(async () => {
    setExportError(null)
    setReport(null)
    try {
      const result = await exportRedactedPdf(doc.pdf, boxes, setExporting)
      downloadBlob(result.blob, result.fileName)
      setReport(result.verification)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The export failed.')
    } finally {
      setExporting(null)
    }
  }, [boxes, doc.pdf])

  const busy = exporting !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-800 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <FileText className="size-4 shrink-0 text-emerald-400/80" />
          <span className="truncate font-medium text-slate-200" title={doc.name}>
            {doc.name}
          </span>
          <span className="shrink-0 text-xs text-slate-500">
            {formatBytes(doc.size)} · {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          <ToolbarButton label="Previous page" onClick={() => goTo(pageNumber - 1)} disabled={pageNumber <= 1}>
            <ChevronLeft className="size-4" />
          </ToolbarButton>
          <div className="flex items-center gap-1 px-1 text-sm tabular-nums text-slate-300">
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={commitPageInput}
              onKeyDown={(e) => e.key === 'Enter' && commitPageInput()}
              aria-label="Page number"
              className="w-9 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center text-sm focus:border-emerald-500/60 focus:outline-none"
            />
            <span className="text-slate-500">/ {doc.pageCount}</span>
          </div>
          <ToolbarButton
            label="Next page"
            onClick={() => goTo(pageNumber + 1)}
            disabled={pageNumber >= doc.pageCount}
          >
            <ChevronRight className="size-4" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
          <ToolbarButton
            label="Zoom out"
            onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="size-4" />
          </ToolbarButton>
          <button
            type="button"
            onClick={() => setScale(1)}
            title="Reset zoom to 100%"
            className="min-w-14 rounded px-1 py-0.5 text-sm tabular-nums text-slate-300 transition hover:bg-slate-800"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarButton
            label="Zoom in"
            onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="size-4" />
          </ToolbarButton>
          <ToolbarButton label="Fit to width" onClick={fitToWidth}>
            <Maximize2 className="size-4" />
          </ToolbarButton>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
        >
          <X className="size-4" />
          Close
        </button>
      </div>

      {/* Redaction toolbar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-800 bg-slate-950/40 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setDrawMode((on) => !on)}
          aria-pressed={drawMode}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
            drawMode
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          {drawMode ? (
            <SquareDashedMousePointer className="size-4" />
          ) : (
            <MousePointer2 className="size-4" />
          )}
          {drawMode ? 'Draw Mode: on' : 'Draw Mode: off'}
        </button>

        <ActionButton
          onClick={() => undoLast(pageNumber)}
          disabled={busy || pageBoxes.length === 0}
          icon={<Undo2 className="size-4" />}
          label="Undo Last Box"
        />
        <ActionButton
          onClick={() => clearPage(pageNumber)}
          disabled={busy || pageBoxes.length === 0}
          icon={<Eraser className="size-4" />}
          label="Clear Page"
        />
        <ActionButton
          onClick={clearAll}
          disabled={busy || total === 0}
          icon={<Trash2 className="size-4" />}
          label="Clear All Pages"
        />

        <span className="ml-1 text-xs text-slate-500">
          {pageBoxes.length} on this page · {total} in document
        </span>

        <button
          type="button"
          onClick={runExport}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {busy ? 'Exporting…' : 'Export Redacted PDF'}
        </button>
      </div>

      <div ref={stageRef} className="pdf-stage relative min-h-0 flex-1 overflow-auto p-3 sm:p-6">
        {rendering && (
          <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-slate-950/85 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-slate-800">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            Rendering page {pageNumber}
          </div>
        )}

        {renderError ? (
          <p className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {renderError}
          </p>
        ) : (
          <div className="mx-auto w-fit max-w-full">
            <div className="relative max-w-full">
              <canvas
                ref={canvasRef}
                className="block h-auto max-w-full rounded-sm bg-white shadow-2xl shadow-black/50 ring-1 ring-slate-700/50"
              />
              {pageSize.width > 0 && (
                <RedactionLayer
                  baseWidth={pageSize.width}
                  baseHeight={pageSize.height}
                  scale={scale}
                  boxes={pageBoxes}
                  drawMode={drawMode && !busy}
                  onAdd={(box) => addBox(pageNumber, box)}
                />
              )}
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              {drawMode
                ? 'Drag on the page to cover anything sensitive. Esc cancels the box you are drawing.'
                : 'Draw Mode is off — turn it on to add redaction boxes.'}
            </p>
          </div>
        )}
      </div>

      {/* Progress and the result sit *below* the stage. Anything inserted above
          it would push the page canvas down mid-gesture; from here the canvas
          keeps its position and only the scroll area gives up height. */}
      {busy && <ExportProgressBar progress={exporting} />}

      {(report || exportError) && !busy && (
        <div className="border-t border-slate-800 px-3 py-2.5">
          {exportError ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <ShieldAlert className="size-4 shrink-0" />
              {exportError}
            </p>
          ) : report?.clean ? (
            <>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Download complete — redacted_document.pdf
                </p>
                <p className="mt-1 pl-6 text-sm text-emerald-300/80">
                  Re-opened and checked: {report.pages} flattened{' '}
                  {report.pages === 1 ? 'page' : 'pages'}, 0 selectable characters, 0 text
                  operators, 0 font objects, 0 annotations.
                </p>
              </div>
              {/* Reserved below the success state, where it interrupts nothing. */}
              <AdSlot variant="post-download" className="mx-auto mt-3" />
            </>
          ) : (
            report && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                <ShieldAlert className="size-4 shrink-0" />
                <span className="font-medium">Downloaded, but the check found recoverable content:</span>
                <span>
                  {report.textCharacters} characters, {report.textOperators} text operators,{' '}
                  {report.fontObjects} font objects, {report.annotations} annotations. Do not share
                  this file.
                </span>
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Determinate progress for the export. Each page contributes an equal share and
 * the bar eases between steps, so a long document reads as steady movement
 * rather than a counter that jumps.
 */
function ExportProgressBar({ progress }: { progress: ExportProgress }) {
  const done = progress.phase === 'verify' ? progress.total : progress.page - 1
  const partial = progress.phase === 'assemble' ? 0.5 : 0
  const percent = Math.min(100, Math.round(((done + partial) / progress.total) * 100))

  return (
    <div className="border-t border-slate-800 px-3 py-2.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <Loader2 className="size-4 shrink-0 animate-spin text-emerald-400" />
          {progress.phase === 'verify'
            ? 'Verifying the exported file…'
            : `Processing Page ${progress.page} of ${progress.total}…`}
        </span>
        <span className="tabular-nums text-slate-500">{percent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void
  disabled?: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-800"
    >
      {icon}
      {/* On a phone the toolbar is icons only; the labels would wrap to four rows. */}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
