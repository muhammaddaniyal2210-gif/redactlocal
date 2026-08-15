import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Plus,
  ScanSearch,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react'
import { formatBytes } from '../lib/pdfjs'
import { countBoxes } from '../lib/redactions'
import type { QueueItem } from '../lib/batch'
import type { BulkExportMode, BulkExportProgress, BulkExportSummary } from '../hooks/useDocumentQueue'

interface DocumentQueuePanelProps {
  items: readonly QueueItem[]
  activeId: string | null
  onActivate: (id: string) => void
  onRemove: (id: string) => void
  onAddFiles: (files: File[]) => void
  onScanAll: () => void
  onExportAll: (mode: BulkExportMode) => void
  scanningAll: boolean
  bulkExport: BulkExportProgress | null
  bulkSummary: BulkExportSummary | null
  onDismissSummary: () => void
  disabled?: boolean
  /** Rendered inside the tabbed sidebar, which supplies the card and the title. */
  embedded?: boolean
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * The batch switcher.
 *
 * One row per document, with everything needed to decide where to go next:
 * how big it is, whether it has been scanned, and how much has already been
 * blacked out. Clicking a row swaps the canvas; the tools follow, because every
 * document carries its own boxes and its own findings.
 */
export function DocumentQueuePanel({
  items,
  activeId,
  onActivate,
  onRemove,
  onAddFiles,
  onScanAll,
  onExportAll,
  scanningAll,
  bulkExport,
  bulkSummary,
  onDismissSummary,
  disabled = false,
  embedded = false,
}: DocumentQueuePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<BulkExportMode>('zip')
  const busy = scanningAll || bulkExport !== null || disabled

  const scanned = items.filter((item) => item.scan !== null).length
  const totalMatches = items.reduce((n, item) => n + (item.scan?.matches.length ?? 0), 0)

  return (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 flex-col overflow-hidden'
          : 'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40'
      }
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-700/50 px-4 py-2.5">
        {!embedded && <Layers className="size-4 shrink-0 text-emerald-400/80" />}
        <div className="min-w-0 flex-1">
          {!embedded && (
            <h2 className="truncate text-sm font-semibold text-slate-100">Document Queue</h2>
          )}
          <p className="truncate text-[11px] tabular-nums text-slate-400">
            {scanned > 0
              ? `${scanned} of ${items.length} scanned · ${totalMatches} matches`
              : `${items.length} documents · not scanned yet`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="Add more PDFs"
          aria-label="Add more PDFs"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40 lg:size-8"
        >
          <Plus className="size-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []).filter(isPdf))
            e.target.value = ''
          }}
        />
      </div>

      {/* The list is the only thing here allowed to grow; the actions below stay
          pinned so "Export All" never scrolls out of reach on a long queue. */}
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            active={item.id === activeId}
            onActivate={() => onActivate(item.id)}
            onRemove={() => onRemove(item.id)}
            removable={items.length > 1 && !busy}
          />
        ))}
      </ul>

      {/* shrink-0: the queue shares a fixed-height column with Find & Redact,
          and a footer allowed to compress is one whose primary action gets
          clipped out of the panel when both are open. The list absorbs the
          pressure instead — it is the only part here that can scroll. */}
      <div className="shrink-0 space-y-2 border-t border-slate-700/50 bg-slate-950/30 p-3">
        {bulkExport ? (
          <BulkExportStatus progress={bulkExport} />
        ) : bulkSummary ? (
          <BulkSummary summary={bulkSummary} onDismiss={onDismissSummary} />
        ) : null}

        {/* Bundling is the default: browsers throttle a burst of downloads, and
            one archive is one save dialog instead of N. */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-950/60 p-1">
          {(
            [
              { id: 'zip', label: 'One .zip' },
              { id: 'separate', label: 'Separate files' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={mode === option.id}
              disabled={busy}
              className={`min-h-11 flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-8 ${
                mode === option.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onScanAll}
            disabled={busy}
            title="Scan every queued document"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2 py-2 text-xs font-medium text-emerald-200 transition-all duration-200 hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-10"
          >
            {scanningAll ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <ScanSearch className="size-3.5 shrink-0" />
            )}
            {scanningAll ? 'Scanning…' : 'Scan All'}
          </button>

          <button
            type="button"
            onClick={() => onExportAll(mode)}
            disabled={busy}
            title={`Flatten and download all ${items.length} documents`}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none lg:min-h-10"
          >
            {bulkExport ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
            {bulkExport ? 'Exporting…' : `Export All (${items.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

function QueueRow({
  item,
  active,
  onActivate,
  onRemove,
  removable,
}: {
  item: QueueItem
  active: boolean
  onActivate: () => void
  onRemove: () => void
  removable: boolean
}) {
  const boxes = countBoxes(item.boxes)
  const rowRef = useRef<HTMLLIElement>(null)

  // Sharing the sidebar with Find & Redact leaves the queue only a short
  // window, so the document you are actually looking at can easily sit outside
  // it — after a switch, or when a scan moves down a long batch. Keep it in
  // view. `nearest` scrolls the list alone and never the page.
  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <li ref={rowRef}>
      <div
        className={`group relative flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-all duration-200 ${
          active
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-transparent hover:border-slate-700 hover:bg-slate-800/50'
        }`}
      >
        {/* The row itself is the button, so the whole strip is a target rather
            than just the file name. */}
        <button
          type="button"
          onClick={onActivate}
          aria-current={active ? 'true' : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-0"
        >
          <FileText
            className={`mt-0.5 size-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500'}`}
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-xs font-medium ${
                active ? 'text-emerald-100' : 'text-slate-200'
              }`}
              title={item.name}
            >
              {item.name}
            </span>
            {/* Meta and status share one line. Three stacked lines made each
                row 73px tall against a 67px list window, so not one row could
                be shown in full while Find & Redact was also open. */}
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
              <span className="truncate tabular-nums text-slate-500">
                {formatBytes(item.size)}
                {item.pageCount !== null && ` · ${item.pageCount} pp`}
                {boxes > 0 && ` · ${boxes} redacted`}
              </span>
              <QueueRowStatus item={item} />
            </span>
          </span>
        </button>

        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name} from the queue`}
            title="Remove from queue"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 lg:size-7"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  )
}

/** One line per row saying where this document actually is. */
function QueueRowStatus({ item }: { item: QueueItem }) {
  if (item.load === 'error') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-red-300">
        <TriangleAlert className="size-3 shrink-0" />
        Could not open
      </span>
    )
  }

  if (item.exportState === 'failed') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-red-300">
        <ShieldAlert className="size-3 shrink-0" />
        Export failed
      </span>
    )
  }

  if (item.exportState === 'working') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-300">
        <Loader2 className="size-3 shrink-0 animate-spin" />
        Exporting…
      </span>
    )
  }

  if (item.exportState === 'done') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-300">
        <CheckCircle2 className="size-3 shrink-0" />
        Exported
      </span>
    )
  }

  if (item.scanProgress) {
    const { page, total } = item.scanProgress
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-emerald-300">
        <Loader2 className="size-3 shrink-0 animate-spin" />
        {total ? `Scanning ${page}/${total}` : 'Scanning…'}
      </span>
    )
  }

  if (item.scanError) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber-300">
        <TriangleAlert className="size-3 shrink-0" />
        Scan failed
      </span>
    )
  }

  if (item.scan) {
    const found = item.scan.matches.length
    return (
      <span
        className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${
          found > 0 ? 'text-amber-300' : 'text-slate-500'
        }`}
      >
        {found > 0 ? (
          <TriangleAlert className="size-3 shrink-0" />
        ) : (
          <CheckCircle2 className="size-3 shrink-0" />
        )}
        {found > 0 ? `${found} to review` : 'Nothing found'}
      </span>
    )
  }

  return <span className="shrink-0 text-[11px] text-slate-600">Not scanned</span>
}

function BulkExportStatus({ progress }: { progress: BulkExportProgress }) {
  const inner = progress.page
    ? progress.page.phase === 'verify'
      ? 1
      : (progress.page.page - 1) / Math.max(1, progress.page.total)
    : 0
  const percent = Math.min(100, Math.round(((progress.done + inner) / progress.total) * 100))

  return (
    <div role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="min-w-0 flex-1 truncate text-slate-300" title={progress.currentName}>
          {progress.currentName}
        </span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {progress.done + 1}/{progress.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function BulkSummary({
  summary,
  onDismiss,
}: {
  summary: BulkExportSummary
  onDismiss: () => void
}) {
  const failed = summary.failed > 0

  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${
        failed
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      }`}
    >
      <div className="flex items-start gap-1.5">
        {failed ? (
          <ShieldAlert className="mt-px size-3.5 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-px size-3.5 shrink-0" />
        )}
        <p className="min-w-0 flex-1">
          {summary.succeeded} {summary.succeeded === 1 ? 'file' : 'files'} exported
          {summary.fileName ? ` as ${summary.fileName}` : ''}
          {failed && ` · ${summary.failed} failed`}
          {summary.partiallyVerified > 0 &&
            ` · ${summary.partiallyVerified} only partly verified (the flattening still ran)`}
          .
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss export summary"
          className="-my-1 -mr-1 grid size-6 shrink-0 place-items-center rounded transition-colors hover:bg-white/10"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
