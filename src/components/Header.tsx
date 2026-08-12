import { Link } from 'react-router-dom'
import { ShieldCheck, WifiOff } from 'lucide-react'

interface HeaderProps {
  onTestOffline: () => void
}

export function Header({ onTestOffline }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Router link, not an anchor: a full reload here would throw away the
            document the user is in the middle of redacting. */}
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <ShieldCheck className="size-5 text-emerald-400" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Redact<span className="text-emerald-400">Local</span>
          </span>
        </Link>

        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 sm:inline-flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          100% Local (Zero Uploads)
        </span>

        <button
          type="button"
          onClick={onTestOffline}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:min-h-9"
        >
          <WifiOff className="size-4" />
          <span className="hidden sm:inline">Test Offline: Disconnect Wi-Fi</span>
          <span className="sm:hidden">Test Offline</span>
        </button>
      </div>
    </header>
  )
}
