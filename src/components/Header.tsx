import { WifiOff } from 'lucide-react'
import { BrandMark } from './BrandMark'

interface HeaderProps {
  onTestOffline: () => void
}

export function Header({ onTestOffline }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Points at the blog, by request, rather than at the site root.
            A plain anchor is required: /blog is a static file in public/, so
            the router has no route for it and would fall through to the
            catch-all and redirect straight back to "/".

            New tab, matching the Blog link in the nav below and for the same
            reason — this header sits above a workspace holding an unsaved
            document in memory, there is no beforeunload guard anywhere in the
            app, and a same-tab navigation would silently discard every
            redaction the user has made. The logo is the control people click
            most reflexively, which makes it the worst place to put that. */}
        <a href="/blog" target="_blank" rel="noopener" className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-auto shrink-0" />
          {/* Logo-only on phones. With a third nav link (Check) now on the row,
              the wordmark + three links + offline control no longer fit at
              375px; hiding the wordmark below sm frees ~110px and the mark alone
              still identifies the site. The wordmark returns from sm up. */}
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">
            Redact<span className="text-emerald-400">Local</span>
          </span>
        </a>

        {/* Deferred to lg: below it the row is tight with three nav links, so
            this reassurance badge waits until there is width to spare. */}
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 lg:inline-flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          100% Local (Zero Uploads)
        </span>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* The free Leak Checker. A plain anchor doing a full same-tab
              navigation: /check is now a standalone static page in public/
              (not an SPA route), so it loads its own HTML and can never be
              intercepted by a stale app bundle — which is what made it seem
              broken. Styled to match About/Blog. */}
          <a
            href="/check"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-9"
          >
            Check
          </a>

          {/* A plain anchor, not a router Link: the blog is a static file in
              public/, so the router has no route for it and would render the
              app shell instead of the hub.

              It opens in a new tab on purpose. This header sits above a
              workspace holding an unsaved document in memory — navigating away
              in the same tab silently discards every redaction the user has
              made, with nothing to recover it from. */}
          {/* Same new-tab rationale as the Blog link below: /about is a static
              file in public/ with no SPA route, and this header sits above a
              workspace holding an unsaved document. Styled identically to Blog. */}
          <a
            href="/about"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-9"
          >
            About
          </a>

          <a
            href="/blog"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-9"
          >
            Blog
          </a>

          {/* Icon-only below lg. With three nav links on the row there is no
              width for the label until large screens; the Privacy Proof banner
              directly below carries the same instruction in full on mobile. */}
          <button
            type="button"
            onClick={onTestOffline}
            title="Test Offline: Disconnect Wi-Fi"
            aria-label="Test Offline: Disconnect Wi-Fi"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 lg:min-h-9 lg:min-w-0 lg:px-3.5"
          >
            <WifiOff className="size-4 shrink-0" />
            <span className="hidden lg:inline">Test Offline: Disconnect Wi-Fi</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
