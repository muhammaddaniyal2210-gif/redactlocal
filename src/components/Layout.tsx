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
      <footer className="mt-auto border-t border-slate-800/80 px-4 py-5 text-center text-xs text-slate-500 sm:px-6">
        {/* The free tools, cross-linked site-wide. Plain anchors and a full
            navigation: each is a standalone static page in public/, so a router
            Link would miss it, and a fresh load is exactly what we want. */}
        <nav aria-label="Free tools" className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-slate-400">
          <a href="/check" className="transition-colors hover:text-slate-200">Leak Checker</a>
          <a href="/remove-metadata" className="transition-colors hover:text-slate-200">Metadata Remover</a>
          <a href="/redact-image" className="transition-colors hover:text-slate-200">Image Redactor</a>
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
