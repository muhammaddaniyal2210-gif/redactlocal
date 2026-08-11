import { useEffect, useState } from 'react'
import { Check, WifiOff, X } from 'lucide-react'

interface OfflineTestDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  'Turn off Wi-Fi (or switch on Airplane Mode).',
  'Leave this tab open — the whole app is already loaded.',
  'Drop a PDF in and page through it.',
  'Everything still renders, because nothing ever left this browser.',
]

/**
 * A browser tab cannot switch off the machine's Wi-Fi, so the button walks the
 * user through doing it themselves and reports the live connection state back.
 */
export function OfflineTestDialog({ open, onClose }: OfflineTestDialogProps) {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <WifiOff className="size-5 text-emerald-400" />
          </span>
          <div className="min-w-0">
            <h2 id="offline-title" className="text-lg font-semibold">
              Prove it for yourself
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              RedactLocal has no backend. Cut the network and it keeps working — that is the whole test.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="size-5" />
          </button>
        </div>

        <ol className="mt-5 space-y-2.5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-slate-300">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-400">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div
          className={`mt-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            online
              ? 'border-slate-700 bg-slate-950/60 text-slate-300'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {online ? (
            <>
              <span className="size-2 shrink-0 rounded-full bg-slate-500" />
              Browser reports: <span className="font-medium text-slate-100">online</span>. Turn Wi-Fi off and watch
              this line change — the app will not.
            </>
          ) : (
            <>
              <Check className="size-4 shrink-0" />
              Browser reports: <span className="font-medium">offline</span>. RedactLocal is still fully functional.
            </>
          )}
        </div>
      </div>
    </div>
  )
}
