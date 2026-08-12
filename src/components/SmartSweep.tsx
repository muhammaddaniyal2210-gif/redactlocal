import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, Loader2, ScanSearch, TriangleAlert } from 'lucide-react'
import { SWEEP_CATEGORIES, type SweepCategoryId } from '../lib/detect'

export interface SweepOutcome {
  /** Boxes actually added to the page. */
  added: number
}

interface SmartSweepProps {
  /** Runs the scan. Resolves with what was found; rejects if pdf.js fails. */
  onSweep: (enabled: ReadonlySet<SweepCategoryId>) => Promise<SweepOutcome>
  disabled?: boolean
  pageNumber: number
}

type Status = { kind: 'idle' } | { kind: 'empty' } | { kind: 'error'; message: string }

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
export function SmartSweep({ onSweep, disabled = false, pageNumber }: SmartSweepProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [selected, setSelected] = useState<Set<SweepCategoryId>>(
    () => new Set(SWEEP_CATEGORIES.map((category) => category.id)),
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Reset transient feedback when the user moves to another page.
  useEffect(() => setStatus({ kind: 'idle' }), [pageNumber])

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
    setStatus({ kind: 'idle' })
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const run = useCallback(async () => {
    setBusy(true)
    setStatus({ kind: 'idle' })
    try {
      const { added } = await onSweep(selected)
      if (added > 0) setOpen(false)
      else setStatus({ kind: 'empty' })
    } catch (err) {
      // Never take the app down over a failed scan: the manual tools still work.
      console.error('Smart Sweep failed:', err)
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'The scan could not finish.',
      })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }, [onSweep, selected])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
          open
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-slate-100'
        }`}
      >
        <ScanSearch className="size-4" />
        Smart Sweep
      </button>

      {status.kind === 'error' && !open && (
        <p className="absolute right-0 top-full z-30 mt-1.5 flex w-max max-w-xs items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {status.message}
        </p>
      )}

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Smart Sweep options"
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-black/20"
        >
          <div className="border-b border-slate-800/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-100">Smart Sweep</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Find and cover matches on page {pageNumber}.
            </p>
          </div>

          <div className="p-1.5">
            {SWEEP_CATEGORIES.map((category) => {
              const checked = selected.has(category.id)
              return (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-slate-800/60"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(category.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-4 shrink-0 place-items-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/60 ${
                      checked
                        ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                        : 'border-slate-600 bg-slate-950/60'
                    }`}
                  >
                    {checked && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-200">{category.label}</span>
                    <span className="block text-[11px] text-slate-500">{category.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>

          <div className="space-y-2 border-t border-slate-800/80 p-3">
            {status.kind === 'empty' && (
              <p className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-400">
                No matches found on this page.
              </p>
            )}

            <button
              type="button"
              onClick={run}
              disabled={busy || selected.size === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Scanning…' : 'Redact Selected'}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Smart Sweep detects standard formats. For maximum security, always visually verify
              your document before exporting.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
