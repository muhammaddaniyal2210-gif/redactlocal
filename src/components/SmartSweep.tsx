import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, ScanSearch } from 'lucide-react'
import { SWEEP_CATEGORIES, type SweepCategoryId } from '../lib/detect'

export interface SweepOutcome {
  /** Boxes actually added to the page. */
  added: number
  /** Set when the page's text could not be read at all. */
  unavailableReason?: string
}

interface SmartSweepProps {
  /** Runs the scan. Resolves with what was found; rejects if pdf.js fails. */
  onSweep: (enabled: ReadonlySet<SweepCategoryId>) => Promise<SweepOutcome>
  /**
   * Reports failures upward. The message is rendered by the toolbar on its own
   * row — an absolutely positioned popover here would sit on top of the badge
   * and the export button.
   */
  onError: (message: string | null) => void
  disabled?: boolean
  pageNumber: number
}

/**
 * Auto-redaction menu: pick the categories, scan the visible page, drop black
 * boxes over what matched.
 *
 * Detection matches standard formats within a single pdf.js text item, so a
 * value split across items or wrapped across lines will not be found. The menu
 * therefore closes by asking the user to check the page: on a tool whose whole
 * promise is that nothing sensitive survives, a blindly trusted auto-scan
 * leaves someone worse off than no scan at all.
 */
export function SmartSweep({ onSweep, onError, disabled = false, pageNumber }: SmartSweepProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [selected, setSelected] = useState<Set<SweepCategoryId>>(
    () => new Set(SWEEP_CATEGORIES.map((category) => category.id)),
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Feedback is about the page that produced it.
  useEffect(() => setEmpty(false), [pageNumber])

  // Dismiss on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = useCallback((id: SweepCategoryId) => {
    setEmpty(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const run = useCallback(async () => {
    setBusy(true)
    setEmpty(false)
    onError(null)
    try {
      const { added, unavailableReason } = await onSweep(selected)
      if (unavailableReason) {
        onError(`This browser could not read the text on this page — ${unavailableReason}`)
        setOpen(false)
      } else if (added > 0) {
        setOpen(false)
      } else {
        setEmpty(true)
      }
    } catch (err) {
      // Never take the app down over a failed scan: the manual tools still work.
      console.error('Smart Sweep failed:', err)
      onError(err instanceof Error ? err.message : 'The scan could not finish.')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }, [onError, onSweep, selected])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // Emerald-tinted on a dark ground: reads as the intelligent action
        // without becoming a second filled button competing with Export.
        className={`group inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 ${
          open
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 shadow-lg shadow-emerald-500/10'
            : 'border-emerald-500/30 bg-slate-900/60 text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10'
        }`}
      >
        <ScanSearch
          className={`size-4 transition-colors duration-200 ${
            open ? 'text-emerald-300' : 'text-emerald-400 group-hover:text-emerald-300'
          }`}
        />
        Smart Sweep
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Smart Sweep options"
          // Bottom sheet on a phone, dropdown from `sm` up. `fixed` also escapes
          // the viewer card's `overflow-hidden`, which would otherwise clip the
          // menu on a short screen. The dropdown grows rightward from the
          // trigger's left edge: the trigger lives in the left-hand cluster, so
          // right-anchoring ran a 304px menu off the screen on a 768px iPad.
          className="fixed inset-x-4 bottom-4 z-40 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-black/20 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[19rem] sm:rounded-xl"
        >
          <div className="border-b border-slate-700/50 px-4 py-3.5">
            <p className="text-sm font-semibold tracking-tight text-slate-50">Smart Sweep</p>
            <p className="mt-1 text-xs text-slate-400">
              Find and cover matches on page {pageNumber}.
            </p>
          </div>

          <div className="space-y-0.5 p-2">
            {SWEEP_CATEGORIES.map((category) => {
              const checked = selected.has(category.id)
              return (
                <label
                  key={category.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors duration-150 hover:bg-slate-800/70 active:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(category.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 ${
                      checked
                        ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                        : 'border-slate-600 bg-slate-950/60'
                    }`}
                  >
                    {checked && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-100">
                      {category.label}
                    </span>
                    <span className="block text-xs text-slate-400">{category.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="space-y-2.5 border-t border-slate-700/50 bg-slate-950/30 p-3">
            {empty && (
              <p className="rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                No matches found on this page.
              </p>
            )}

            <button
              type="button"
              onClick={run}
              disabled={busy || selected.size === 0}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Scanning…' : 'Redact Selected'}
            </button>

            <p className="text-xs leading-relaxed text-slate-400">
              Smart Sweep detects standard formats. For maximum security, always visually verify
              your document before exporting.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
