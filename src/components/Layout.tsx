import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { OfflineTestDialog } from './OfflineTestDialog'

/**
 * Chrome shared by every route. The page itself owns the scrolling: the shell is
 * at least viewport-tall and grows with its content, so the editor scrolls
 * internally on the home route while a landing route simply extends the page.
 */
export function Layout() {
  const [offlineDialog, setOfflineDialog] = useState(false)

  return (
    // min-h-screen, not h-full: the shell is at least the viewport tall and
    // grows with its content, so nothing is stranded in a fixed-height box and
    // the footer has something real to sit against.
    <div className="flex min-h-screen flex-col">
      <Header onTestOffline={() => setOfflineDialog(true)} />

      <main className="flex min-h-0 flex-1 flex-col">
        {/* flex-1, not min-h-full: it takes the space the shell has left over
            rather than asserting a full viewport of its own, which is what left
            a block of empty space under the editor. */}
        {/* max-w-6xl, not 7xl. At 1280 the editor stretched far wider than the
            calm centred column the drop zone establishes before upload, so the
            page changed shape the moment a file was opened. One container width
            for both states keeps the margins consistent. */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:py-4">
          <Outlet />
        </div>
      </main>

      {/* The footer is the only place present in every app state and on every
          route. A disclosure that disappears the moment someone opens a file
          is not a disclosure. */}
      <footer className="mt-auto border-t border-slate-800/80 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        {/* A plain anchor, not a router Link, and a new tab — for the same two
            reasons the header's Blog link is: /about is a static file in
            public/ with no route in the SPA (a Link would hit the catch-all and
            bounce to "/"), and this footer sits under a workspace holding an
            unsaved document, so a same-tab navigation would discard it. */}
        <nav aria-label="Footer" className="mb-3 flex flex-wrap items-center justify-center gap-x-6">
          <a
            href="/about"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-9 items-center rounded px-1 font-medium text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            About &amp; Contact
          </a>
        </nav>

        <p>Files are held in memory and discarded when you close the tab.</p>
        <p className="mt-1.5 text-slate-600">
          Note: Vercel Analytics logs page visits only. Your files remain 100% local and
          off-network.
        </p>
      </footer>

      <OfflineTestDialog open={offlineDialog} onClose={() => setOfflineDialog(false)} />
    </div>
  )
}
