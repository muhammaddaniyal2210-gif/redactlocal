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
  TriangleAlert,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { formatBytes, isRenderCancelled } from '../lib/pdfjs'
import { backingStoreScale } from '../lib/canvasBudget'
import {
  downloadBlob,
  exportRedactedPdf,
  ExportFailure,
  type ExportProgress,
  type VerificationReport,
} from '../lib/export'
import { collectEnvironmentReport, summariseEnvironment } from '../lib/environment'
import { sweepPage, type SweepCategoryId } from '../lib/detect'
import { AdSlot } from './AdSlot'
import { SmartSweep } from './SmartSweep'
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

interface ExportErrorState {
  message: string
  /** Stack, failure phase and engine capabilities, ready to paste into a report. */
  details: string
}

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
  const { boxes, addBox, addBoxes, undoLast, clearPage, clearAll, total } = useRedactions()
  const pageBoxes = boxes[pageNumber] ?? []

  const [sweepError, setSweepError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportProgress | null>(null)
  const [exportError, setExportError] = useState<ExportErrorState | null>(null)
  const [report, setReport] = useState<VerificationReport | null>(null)

  // A new document starts clean: page 1, 100 %, no redactions carried over.
  useEffect(() => {
    setPageNumber(1)
    setPageInput('1')
    setScale(1)
    clearAll()
    setReport(null)
    setExportError(null)
    setSweepError(null)
  }, [doc, clearAll])

  useEffect(() => {
    setPageInput(String(pageNumber))
    setSweepError(null)
  }, [pageNumber])

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
        // then scale the canvas back down with CSS. The ratio drops on a phone,
        // or at deep zoom, so the bitmap stays inside what the device can hold:
        // a 595x842pt page at 400% would otherwise be a 32 megapixel canvas.
        // The page takes the larger share; the overlay only draws rectangles.
        const dpr = backingStoreScale(viewport.width, viewport.height, { budgetShare: 0.7 })
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

  /**
   * Scan the page currently on screen and add a box over every match.
   *
   * Errors propagate to SmartSweep, which reports them and closes — a failed
   * scan must never cost the user the boxes they drew by hand.
   */
  const runSweep = useCallback(
    async (enabled: ReadonlySet<SweepCategoryId>) => {
      const page = await doc.pdf.getPage(pageNumber)
      const { boxes: found, unavailableReason } = await sweepPage(page, enabled)
      addBoxes(pageNumber, found)
      return { added: found.length, unavailableReason }
    },
    [addBoxes, doc.pdf, pageNumber],
  )

  const runExport = useCallback(async () => {
    setExportError(null)
    setReport(null)
    try {
      const result = await exportRedactedPdf(doc.pdf, boxes, setExporting)
      downloadBlob(result.blob, result.fileName)
      setReport(result.verification)
    } catch (err) {
      // The whole diagnostic goes on screen: message, stack, and what this
      // engine can do. On a phone there is no console to read.
      const environment = collectEnvironmentReport()
      const details =
        err instanceof ExportFailure
          ? err.details
          : `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}\n\n${
              (err instanceof Error && err.stack) || '(no stack available)'
            }`

      setExportError({
        message: err instanceof Error ? err.message : String(err),
        details: [
          details,
          '',
          `userAgent: ${environment.userAgent}`,
          summariseEnvironment(environment),
        ].join('\n'),
      })
    } finally {
      setExporting(null)
    }
  }, [boxes, doc.pdf])

  const busy = exporting !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-slate-700/50 px-4 py-3">
        {/* Its own full-width line on a phone: sharing a row with the page and
            zoom controls crushed the filename down to the file size alone. */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 text-sm">
          <FileText className="size-4 shrink-0 text-emerald-400/80" />
          <span className="min-w-0 truncate font-medium text-slate-200" title={doc.name}>
            {doc.name}
          </span>
          <span className="shrink-0 text-xs text-slate-400">
            {formatBytes(doc.size)} · {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <div className="order-3 flex shrink-0 items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-950/60 p-1 sm:order-2">
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
              className="min-h-11 w-11 rounded-lg border border-slate-700 bg-slate-900 px-1 py-1 text-center text-sm text-slate-100 transition-colors duration-150 focus:border-emerald-500/60 focus:outline-none sm:min-h-9 sm:w-10"
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

        <div className="order-4 flex shrink-0 items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-950/60 p-1 sm:order-3">
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
            className="min-h-11 min-w-14 rounded-lg px-1.5 py-1 text-sm tabular-nums text-slate-300 transition-colors duration-150 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 sm:min-h-9"
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
          {/* The page is already width-fitted by `max-w-full` on a phone. */}
          <ToolbarButton label="Fit to width" onClick={fitToWidth} className="hidden sm:grid">
            <Maximize2 className="size-4" />
          </ToolbarButton>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="order-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-sm text-slate-400 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 sm:order-4 sm:min-h-9"
        >
          <X className="size-4" />
          Close
        </button>
      </div>

      {/* Redaction toolbar: what you add, then what you take back. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 border-b border-slate-700/50 bg-slate-950/40 px-4 py-3">
        {/* Cluster 1 — creation */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawMode((on) => !on)}
            aria-pressed={drawMode}
            disabled={busy}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 sm:min-h-9 ${
              drawMode
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {drawMode ? (
              <SquareDashedMousePointer className="size-4" />
            ) : (
              <MousePointer2 className="size-4" />
            )}
            {drawMode ? 'Draw Mode: on' : 'Draw Mode: off'}
          </button>

          <SmartSweep
            onSweep={runSweep}
            onError={setSweepError}
            disabled={busy}
            pageNumber={pageNumber}
          />
        </div>

        {/* Hidden once the toolbar starts wrapping: a vertical rule between two
            stacked rows separates nothing. */}
        <div aria-hidden="true" className="mx-2 hidden h-6 w-px bg-slate-700 lg:block" />

        {/* Cluster 2 — correction. Ghost buttons: these undo work rather than
            create it, so they stay quiet until you look for them. */}
        <div className="flex shrink-0 items-center gap-1">
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
        </div>

        <span className="ml-0.5 text-xs tabular-nums text-slate-400">
          {pageBoxes.length} on this page · {total} in document
        </span>

        {/* The badge sits with the button as one unit, so the claim and the
            action it describes can never drift apart when the toolbar wraps. */}
        <div className="ml-auto flex flex-col items-stretch gap-2 sm:items-end">
          <span className="inline-flex items-center justify-center self-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-300 sm:self-end">
            Exports as a flattened image (no hidden text)
          </span>

          <button
            type="button"
            onClick={runExport}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:bg-emerald-400 hover:shadow-emerald-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {busy ? 'Exporting…' : 'Export Redacted PDF'}
          </button>
        </div>

        {/* Full width, so it takes its own line in the wrapping toolbar rather
            than being layered over the badge and the button. */}
        {sweepError && (
          <p
            role="status"
            className="flex w-full items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0 text-red-300" />
            <span className="min-w-0 flex-1">{sweepError}</span>
            <button
              type="button"
              onClick={() => setSweepError(null)}
              aria-label="Dismiss"
              className="grid size-11 shrink-0 place-items-center rounded-lg text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-200 sm:size-7"
            >
              <X className="size-3.5" />
            </button>
          </p>
        )}
      </div>

      {/* px-8 on a phone leaves ~32px of dead space either side of the page.
          The canvas swallows touches so it can be drawn on; without a gutter
          there is nowhere left to start a scroll. */}
      <div ref={stageRef} className="pdf-stage relative min-h-0 flex-1 overflow-auto px-8 py-4 sm:p-6">
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
        <div className="border-t border-slate-700/50 px-4 py-3">
          {exportError ? (
            <ExportErrorPanel error={exportError} />
          ) : report ? (
            <>
              <VerificationPanel report={report} />
              {/* Reserved below the success state, where it interrupts nothing. */}
              {report.cleanAsFarAsChecked && <AdSlot variant="post-download" className="mx-auto mt-3" />}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

/**
 * What the post-export check found.
 *
 * Three outcomes, not two. "Every probe ran and found nothing" and "some probes
 * could not run on this browser" are different claims, and collapsing them into
 * one green banner would tell the user a file was verified when it was not.
 */
function VerificationPanel({ report }: { report: VerificationReport }) {
  const pageWord = report.pages === 1 ? 'page' : 'pages'

  if (report.clean) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          Download complete — redacted_document.pdf
        </p>
        <p className="mt-1 pl-6 text-sm text-emerald-300/80">
          Re-opened and checked: {report.pages} flattened {pageWord}, 0 selectable characters, 0
          text operators, 0 font objects, 0 annotations.
        </p>
      </div>
    )
  }

  if (report.cleanAsFarAsChecked) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
          <ShieldAlert className="size-4 shrink-0" />
          Download complete — redacted_document.pdf, partly verified
        </p>
        <p className="mt-1 pl-6 text-sm text-amber-300/90">
          The redaction itself is done: every page was flattened to an image before the file was
          written, so there is no text layer to recover. What could not run on this browser is part
          of the double-check — {report.skippedChecks.join(', ')}. Everything that did run came
          back at zero.
        </p>
      </div>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      <ShieldAlert className="size-4 shrink-0" />
      <span className="font-medium">Downloaded, but the check found recoverable content:</span>
      <span>
        {report.textCharacters} characters, {report.textOperators} text operators,{' '}
        {report.fontObjects} font objects, {report.annotations} annotations. Do not share this file.
      </span>
      {report.skippedChecks.length > 0 && <span>Skipped: {report.skippedChecks.join(', ')}.</span>}
    </p>
  )
}

/**
 * Everything known about a failed export, on screen.
 *
 * A minified stack is close to unreadable, so the capability summary underneath
 * it usually carries more signal — "missing: Promise.withResolvers" names the
 * problem outright on a device you cannot attach a debugger to.
 */
function ExportErrorPanel({ error }: { error: ExportErrorState }) {
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // The panel sits below the page stage, which can put it off-screen on a
  // phone — a diagnostic nobody sees is not a diagnostic.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [error])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(error.details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the text is selectable either way.
    }
  }

  return (
    <div ref={panelRef} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
        <p className="min-w-0 flex-1 text-sm font-medium text-red-300">
          The export failed — {error.message}
        </p>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded border border-red-500/40 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/20"
        >
          {copied ? 'Copied' : 'Copy details'}
        </button>
      </div>
      <pre className="mt-2 max-h-56 overflow-auto rounded bg-slate-950/70 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words text-red-200/90 select-text">
        {error.details}
      </pre>
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
    <div className="border-t border-slate-700/50 px-4 py-3" role="status" aria-live="polite">
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
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400 sm:min-h-9 sm:min-w-0"
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
  className = '',
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid size-11 place-items-center rounded-lg text-slate-300 transition-all duration-150 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent sm:size-9 ${className}`}
    >
      {children}
    </button>
  )
}
