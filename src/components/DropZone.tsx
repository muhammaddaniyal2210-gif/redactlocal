import { useCallback, useRef, useState } from 'react'
import { FileWarning, Loader2, Lock, MonitorSmartphone, UploadCloud } from 'lucide-react'

interface DropZoneProps {
  /** Receives every PDF that was dropped or picked, in the order given. */
  onFiles: (files: File[]) => void
  loading: boolean
  error: string | null
  /** The drop target itself, so a compliance badge can hand it focus. */
  targetRef?: React.Ref<HTMLDivElement>
  /**
   * Shown inside the zone when a preset is armed, so the rule is confirmed
   * before the file is chosen rather than after it is open.
   */
  notice?: React.ReactNode
}

const ASSURANCES = [
  { icon: Lock, label: 'No account, no server' },
  { icon: MonitorSmartphone, label: 'Runs in this tab only' },
  // "Nothing stored on close", not "Nothing is stored on close": the longer
  // form needs 168px in a 168px slot, so it wrapped while its two neighbours
  // did not. Dropping one word restores a ~17px margin and reads in the same
  // clipped register as the other two.
  { icon: FileWarning, label: 'Nothing stored on close' },
]

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function DropZone({ onFiles, loading, error, targetRef, notice }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const dragDepth = useRef(0)

  /**
   * Take the PDFs and say plainly what was left behind.
   *
   * Dropping a folder's worth of files onto a batch tool and having the
   * non-PDFs vanish without a word is how someone ends up believing a document
   * was redacted when it was never opened.
   */
  const accept = useCallback(
    (list: FileList | null | undefined) => {
      const all = Array.from(list ?? [])
      if (all.length === 0) return

      const pdfs = all.filter(isPdf)
      const skipped = all.length - pdfs.length

      if (pdfs.length === 0) {
        setRejected(
          all.length === 1
            ? `“${all[0].name}” is not a PDF.`
            : `None of those ${all.length} files are PDFs.`,
        )
        return
      }

      setRejected(
        skipped > 0
          ? `Skipped ${skipped} ${skipped === 1 ? 'file that is' : 'files that are'} not a PDF.`
          : null,
      )
      onFiles(pdfs)
    },
    [onFiles],
  )

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        ref={targetRef}
        onDragEnter={(e) => {
          e.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          accept(e.dataTransfer?.files)
        }}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Choose one or more PDFs, or drag them here"
        aria-busy={loading}
        className={`group grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
          dragging
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70'
        } ${loading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files)
            e.target.value = ''
          }}
        />

        <span
          className={`grid size-14 place-items-center rounded-2xl ring-1 transition ${
            dragging
              ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
              : 'bg-slate-800/80 text-slate-400 ring-slate-700 group-hover:text-slate-300'
          }`}
        >
          {loading ? (
            <Loader2 className="size-7 animate-spin text-emerald-400" />
          ) : (
            <UploadCloud className="size-7" />
          )}
        </span>

        <p className="mt-5 text-base font-medium text-slate-100">
          {loading
            ? 'Reading in memory…'
            : dragging
              ? 'Drop them — they stay on this device'
              : 'Drop your PDFs here'}
        </p>
        <p className="mt-1.5 text-sm text-slate-400">
          {loading
            ? 'No upload is happening.'
            : 'or click to browse. One .pdf, or many for a batch.'}
        </p>

        {/* The zone is a `place-items-center` grid, so its column track is
            auto-sized: an unconstrained pill widens the track and pushes every
            other child past the viewport edge. The wrapper pins the width to
            the parent and the pill shrinks inside it. */}
        {notice && !loading && (
          <span className="mt-5 flex w-full min-w-0 justify-center">
            <span className="flex min-w-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              {notice}
            </span>
          </span>
        )}
      </div>

      {(rejected || error) && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <FileWarning className="mt-0.5 size-4 shrink-0" />
          {rejected ?? error}
        </p>
      )}

      {/* Equal heights come from the grid itself — items stretch by default —
          so the row was never ragged. What made it look unbalanced was one
          label wrapping while the other two did not, which left two cards
          with a single line floating in a box sized for two.

          The label had 162px of room and wanted 168. Tightening the padding
          and the icon gap buys that back, and `text-balance` means that if a
          narrower breakpoint ever does force a wrap it splits across the two
          lines evenly instead of orphaning a word. `items-center` keeps the
          icon on the optical centre in either case. */}
      {/* Three across from md, not sm. The container is capped at max-w-2xl,
          so a card is 216px wide at every size above ~704px and no wider —
          but between 640 and 704 it is squeezed to ~189px, which is too
          narrow for the longest label. Below md the cards go full width,
          where nothing can wrap at all. */}
      <ul className="mt-8 grid items-stretch gap-3 md:grid-cols-3">
        {ASSURANCES.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm leading-snug text-slate-400"
          >
            <Icon className="size-4 shrink-0 text-emerald-400/80" />
            <span className="min-w-0 text-balance">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
