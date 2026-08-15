import { useEffect, useState } from 'react'
import { ChevronDown, Wifi, WifiOff } from 'lucide-react'

const REASONS = [
  {
    title: 'The file never moves.',
    body: 'A cloud PDF tool uploads your document to a server you cannot inspect, where it lands in temp storage, backups and request logs. Here it is parsed in the tab that opened it.',
  },
  {
    title: 'There is nothing to breach.',
    body: 'No account, no processing queue, no retention window. Close the tab and the document is gone from memory — there is no copy left for anyone to leak, subpoena or resell.',
  },
  {
    title: 'You can check the claim yourself.',
    body: 'The parser (JavaScript plus WebAssembly for scanned images) and the renderer are already on your device. Cut the network and every step still runs — a cloud tool cannot survive that test.',
  },
]

/**
 * The product's central claim, stated where it cannot be missed, with the
 * evidence one click away. Live connection state is shown because "it still
 * works offline" is much more persuasive when the page says you *are* offline.
 */
export function PrivacyProofBanner() {
  const [open, setOpen] = useState(false)
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

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5 lg:py-2.5">
        {/* Takes its own row until there is width to share, otherwise it gets
            crushed into a two-word column beside the badge and the button. */}
        <p className="w-full text-sm leading-relaxed text-emerald-100 sm:w-auto sm:min-w-70 sm:flex-1 sm:text-[0.95rem]">
          <span aria-hidden="true">🔒</span>{' '}
          <span className="font-semibold text-emerald-300">Privacy Proof:</span> Turn off your Wi-Fi
          or Internet connection right now. This tool will continue to work 100% locally.
        </p>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
            online
              ? 'bg-slate-950/50 text-slate-300 ring-slate-700'
              : 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/40'
          }`}
          title={online ? 'Your browser reports a network connection' : 'Your browser reports no network connection'}
        >
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {online ? 'Online — still nothing is sent' : 'Offline — still fully working'}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="privacy-proof-details"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-200 transition-all duration-200 hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 lg:min-h-9"
        >
          Why this is safer
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible: animated on a grid row so it works without a fixed height. */}
      <div
        id="privacy-proof-details"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-3 border-t border-emerald-500/20 px-4 py-4 sm:px-5">
            {REASONS.map(({ title, body }) => (
              <li key={title} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                <p className="text-slate-300">
                  <span className="font-medium text-emerald-200">{title}</span> {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
