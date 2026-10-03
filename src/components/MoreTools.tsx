/**
 * A compact, tasteful grid of the file tools, shown under the drop zone on the
 * home route only. It signals that RedactLocal is more than a redactor without
 * turning the page into a converter landing.
 *
 * The tools are standalone static pages in public/, so these are plain anchors
 * (same-tab): the home drop zone holds no in-memory document in its empty state.
 */
const TOOLS: { href: string; name: string; desc: string; icon: React.ReactNode }[] = [
  {
    href: '/pdf-to-jpg', name: 'PDF to JPG', desc: 'Pages to sharp images',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>),
  },
  {
    href: '/jpg-to-pdf', name: 'JPG to PDF', desc: 'Images into one PDF',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>),
  },
  {
    href: '/merge-pdf', name: 'Merge PDF', desc: 'Combine files in order',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>),
  },
  {
    href: '/split-pdf', name: 'Split PDF', desc: 'Extract or separate pages',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M10 20H4v-6" /><path d="M20 4 4 20" /></svg>),
  },
  {
    href: '/compress-pdf', name: 'Compress PDF', desc: 'Make a PDF smaller',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>),
  },
  {
    href: '/organize-pdf', name: 'Organize PDF', desc: 'Reorder & rotate pages',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="m17 14 4 4-4 4" /></svg>),
  },
]

export function MoreTools() {
  return (
    <section aria-labelledby="more-tools" className="mx-auto mt-8 w-full max-w-2xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="more-tools" className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
            More private file tools
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Convert, merge, split, compress and organize PDFs — all on your device.
          </p>
        </div>
        <a href="/tools" className="shrink-0 text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300">
          All tools →
        </a>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-slate-600 hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400" aria-hidden="true">
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-100">{t.name}</span>
              <span className="block truncate text-xs text-slate-400">{t.desc}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
