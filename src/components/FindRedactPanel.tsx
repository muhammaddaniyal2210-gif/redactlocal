import { useMemo } from 'react'
import { Check, ChevronDown, Loader2, Search, TriangleAlert, X } from 'lucide-react'
import {
  SWEEP_CATEGORIES,
  SWEEP_GROUPS,
  type DocumentScan,
  type ScanMatch,
  type SweepCategoryId,
} from '../lib/detect'

interface FindRedactPanelProps {
  /** Which patterns to look for. Shared across the queue, so Scan All agrees. */
  enabled: ReadonlySet<SweepCategoryId>
  onToggleCategory: (id: SweepCategoryId) => void

  /** Findings for the *active* document. Null until it has been scanned. */
  scan: DocumentScan | null
  scanError: string | null
  /** Non-null while this document is being scanned. */
  scanProgress: { page: number; total: number } | null

  selected: ReadonlySet<string>
  redacted: ReadonlySet<string>
  onToggleMatch: (id: string) => void

  /** Scan the active document. */
  onScan: () => void
  /** Draw every ticked-but-not-yet-drawn match. */
  onRedact: () => void
  /** Jump the viewer to a match's page so the user can see it in place. */
  onReveal: (page: number) => void
  onClose: () => void
  disabled?: boolean
  /** Shown when a batch is open, so findings are never read against the wrong file. */
  documentName?: string
  /**
   * Rendered inside the tabbed sidebar, which already provides the card, the
   * title and the close control. Without this the panel would draw a second
   * border and a second header immediately below the tabs.
   */
  embedded?: boolean
}

const CATEGORY_LABEL = new Map(SWEEP_CATEGORIES.map((c) => [c.id, c.label]))

/** Stable identity so the memos below do not recompute on every render. */
const NO_MATCHES: ScanMatch[] = []

/**
 * Find & Redact: scan the document for confidential patterns, review every hit,
 * then black out the ones you confirm.
 *
 * The review step is the point. An automatic sweep either over-redacts a
 * document into uselessness or quietly misses something; showing each match
 * with its surrounding line lets the person who knows the document decide,
 * which is the only party who actually can.
 *
 * The panel holds no findings of its own. They belong to the document, so that
 * switching to another file in the queue and back brings the same review list
 * with the same ticks still on it.
 */
export function FindRedactPanel({
  enabled,
  onToggleCategory,
  scan,
  scanError,
  scanProgress,
  selected,
  redacted,
  onToggleMatch,
  onScan,
  onRedact,
  onReveal,
  onClose,
  disabled = false,
  documentName,
  embedded = false,
}: FindRedactPanelProps) {
  const scanning = scanProgress !== null
  const matches = scan?.matches ?? NO_MATCHES

  const pending = useMemo(
    () => matches.filter((m) => selected.has(m.id) && !redacted.has(m.id)),
    [matches, redacted, selected],
  )

  const grouped = useMemo(() => {
    return SWEEP_GROUPS.map((group) => ({
      group,
      items: matches.filter((m) => m.group === group.id),
    })).filter((g) => g.items.length > 0)
  }, [matches])

  return (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 flex-col overflow-hidden'
          : 'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40'
      }
    >
      {!embedded && (
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-700/50 px-4 py-3">
          <Search className="size-4 shrink-0 text-emerald-400/80" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-100">Auto-Detect</h2>
            {documentName && (
              <p className="truncate text-[11px] text-slate-500" title={documentName}>
                {documentName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Auto-Detect"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200 lg:size-8"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <details className="border-b border-slate-700/50" open={scan === null}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium tracking-wide text-slate-400 transition-colors hover:text-slate-200">
            <ChevronDown className="size-3.5 transition-transform duration-200" />
            What to look for
            <span className="ml-auto tabular-nums text-slate-500">
              {enabled.size}/{SWEEP_CATEGORIES.length}
            </span>
          </summary>

          <div className="max-h-60 space-y-3 overflow-y-auto px-4 pb-4">
            {SWEEP_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  {group.label}
                </p>
                {SWEEP_CATEGORIES.filter((c) => c.group === group.id).map((category) => {
                  const on = enabled.has(category.id)
                  return (
                    <label
                      key={category.id}
                      className="relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 transition-colors hover:bg-slate-800/60 lg:min-h-9"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggleCategory(category.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`grid size-4 shrink-0 place-items-center rounded border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/60 ${
                          on
                            ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-950/60'
                        }`}
                      >
                        {on && <Check className="size-2.5" strokeWidth={4} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {category.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            ))}
          </div>
        </details>

        {scan && (
          <MatchList
            grouped={grouped}
            selected={selected}
            redacted={redacted}
            onToggle={onToggleMatch}
            onReveal={onReveal}
            unreadablePages={scan.unreadablePages}
          />
        )}

        {scanError && (
          <p className="m-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            {scanError}
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-700/50 bg-slate-950/30 p-3">
        {scan && (
          <p className="text-center text-[11px] text-slate-400">
            {matches.length === 0
              ? 'No matches found in this document.'
              : `${pending.length} selected of ${matches.length} found`}
          </p>
        )}

        {scan && matches.length > 0 ? (
          <button
            type="button"
            onClick={onRedact}
            disabled={disabled || pending.length === 0}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            Redact Selected Matches
          </button>
        ) : (
          <button
            type="button"
            onClick={onScan}
            disabled={disabled || enabled.size === 0 || scanning}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {scanning && <Loader2 className="size-4 animate-spin" />}
            {scanning
              ? scanProgress.total
                ? `Scanning page ${scanProgress.page} of ${scanProgress.total}…`
                : 'Scanning…'
              : 'Scan document'}
          </button>
        )}

        {scan && matches.length > 0 && (
          <button
            type="button"
            onClick={onScan}
            disabled={disabled || scanning}
            className="min-h-11 w-full rounded-lg py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 disabled:opacity-50 lg:min-h-8"
          >
            Scan again
          </button>
        )}

        <p className="text-[11px] leading-relaxed text-slate-400">
          Matching runs on this device against the text already in memory. Patterns catch standard
          formats only — read the page before exporting.
        </p>
      </div>
    </div>
  )
}

function MatchList({
  grouped,
  selected,
  redacted,
  onToggle,
  onReveal,
  unreadablePages,
}: {
  grouped: { group: { id: string; label: string }; items: ScanMatch[] }[]
  selected: ReadonlySet<string>
  redacted: ReadonlySet<string>
  onToggle: (id: string) => void
  onReveal: (page: number) => void
  unreadablePages: number[]
}) {
  return (
    <div className="p-3">
      {unreadablePages.length > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          Text could not be read on {unreadablePages.length === 1 ? 'page' : 'pages'}{' '}
          {unreadablePages.join(', ')}. Check {unreadablePages.length === 1 ? 'it' : 'them'} by eye.
        </p>
      )}

      {grouped.map(({ group, items }) => (
        <section key={group.id} className="mb-4 last:mb-0">
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            {group.label}
            <span className="tabular-nums">({items.length})</span>
          </p>

          <ul className="space-y-1">
            {items.map((match) => {
              const done = redacted.has(match.id)
              const checked = selected.has(match.id)
              return (
                <li key={match.id}>
                  <div
                    className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-200 ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <label className="relative -my-2 -ml-1 flex min-h-11 min-w-11 cursor-pointer items-center justify-center lg:my-0 lg:ml-0 lg:min-h-0 lg:min-w-0 lg:items-start lg:justify-start lg:pt-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={done}
                        onChange={() => onToggle(match.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-label={`Select ${match.text}`}
                        className={`grid size-4 shrink-0 place-items-center rounded border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/60 ${
                          done
                            ? 'border-emerald-500/50 bg-emerald-500/40 text-slate-950'
                            : checked
                              ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                              : 'border-slate-600 bg-slate-950/60'
                        }`}
                      >
                        {(checked || done) && <Check className="size-2.5" strokeWidth={4} />}
                      </span>
                    </label>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-slate-100" title={match.text}>
                        {match.text}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500" title={match.snippet}>
                        {match.snippet}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{CATEGORY_LABEL.get(match.category) ?? match.category}</span>
                        <button
                          type="button"
                          onClick={() => onReveal(match.page)}
                          className="-my-3 inline-flex min-h-11 items-center justify-center rounded px-2.5 text-emerald-400/80 underline-offset-2 transition-colors hover:text-emerald-300 hover:underline lg:my-0 lg:min-h-0 lg:px-0.5"
                        >
                          page {match.page}
                        </button>
                        {done && <span className="text-emerald-400/80">redacted</span>}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export type { DocumentScan }
