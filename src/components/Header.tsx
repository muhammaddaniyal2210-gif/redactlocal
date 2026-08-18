import { Link } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { BrandMark } from './BrandMark'

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
          <BrandMark className="h-7 w-auto shrink-0" />
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

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* A plain anchor, not a router Link: the blog is a static file in
              public/, so the router has no route for it and would render the
              app shell instead of the hub.

              It opens in a new tab on purpose. This header sits above a
              workspace holding an unsaved document in memory — navigating away
              in the same tab silently discards every redaction the user has
              made, with nothing to recover it from. */}
          <a
            href="/blog"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-9"
          >
            Blog
          </a>

          {/* Icon-only below sm. With the Blog link now sharing this row there
              is not enough width left for a label, and it was wrapping "Test
              Offline" onto two lines. The Privacy Proof banner directly below
              carries the same instruction in full on mobile. */}
          <button
            type="button"
            onClick={onTestOffline}
            title="Test Offline: Disconnect Wi-Fi"
            aria-label="Test Offline: Disconnect Wi-Fi"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:px-3.5 lg:min-h-9 lg:min-w-0"
          >
            <WifiOff className="size-4 shrink-0" />
            <span className="hidden sm:inline">Test Offline: Disconnect Wi-Fi</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
