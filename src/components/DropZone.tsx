import { useCallback, useRef, useState } from 'react'
import { FileWarning, Loader2, Lock, MonitorSmartphone, UploadCloud } from 'lucide-react'

interface DropZoneProps {
  onFile: (file: File) => void
  loading: boolean
  error: string | null
}

const ASSURANCES = [
  { icon: Lock, label: 'No account, no server' },
  { icon: MonitorSmartphone, label: 'Runs in this tab only' },
  { icon: FileWarning, label: 'Nothing is stored on close' },
]

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function DropZone({ onFile, loading, error }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const dragDepth = useRef(0)

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!isPdf(file)) {
        setRejected(`“${file.name}” is not a PDF.`)
        return
      }
      setRejected(null)
      onFile(file)
    },
    [onFile],
  )

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
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
          accept(e.dataTransfer?.files?.[0])
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
        aria-label="Choose a PDF, or drag one here"
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
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0])
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
          {loading ? 'Reading in memory…' : dragging ? 'Drop it — it stays on this device' : 'Drop a PDF here'}
        </p>
        <p className="mt-1.5 text-sm text-slate-400">
          {loading ? 'No upload is happening.' : 'or click to browse. Single .pdf file.'}
        </p>
      </div>

      {(rejected || error) && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <FileWarning className="mt-0.5 size-4 shrink-0" />
          {rejected ?? error}
        </p>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {ASSURANCES.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 text-sm text-slate-400"
          >
            <Icon className="size-4 shrink-0 text-emerald-400/80" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
