import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { OfflineTestDialog } from './OfflineTestDialog'

/**
 * Chrome shared by every route. `main` owns the scrolling: the home route fits
 * it exactly and lets the editor scroll internally, while a landing route
 * overflows it with copy below the tool.
 */
export function Layout() {
  const [offlineDialog, setOfflineDialog] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <Header onTestOffline={() => setOfflineDialog(true)} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* `min-h-full` (not `h-full`): tall enough for the home route's editor
            to fill the viewport with `flex-1`, but free to grow past it when a
            landing route stacks copy underneath — which also stops the editor
            from being flex-shrunk by that copy. */}
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-slate-800/80 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        Files are held in memory and discarded when you close the tab.
      </footer>

      <OfflineTestDialog open={offlineDialog} onClose={() => setOfflineDialog(false)} />
    </div>
  )
}
