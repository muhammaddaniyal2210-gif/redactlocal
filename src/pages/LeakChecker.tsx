import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FileSearch,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { DropZone } from '../components/DropZone'
import { PrivacyProofBanner } from '../components/PrivacyProofBanner'
import { useDocumentHead } from '../hooks/useDocumentHead'
import { buildCheckHeadTags } from '../lib/seo'
import { readFileBytes } from '../lib/pdfjs'
import { inspectPdf, type InspectionResult } from '../lib/inspect'

type Status = 'idle' | 'reading' | 'done' | 'error'

/**
 * The Redaction Leak Checker.
 *
 * A free, self-contained diagnostic that reads a PDF's recoverable text layer
 * entirely in the browser and shows whether a "redacted" document still carries
 * the words underneath. It is the visceral proof behind the whole product: drop
 * a file you blacked out in a normal editor and watch the "removed" text appear.
 *
 * Nothing is uploaded — the same local pipeline the redactor uses.
 */
export function LeakChecker() {
  useDocumentHead(useMemo(() => buildCheckHeadTags(), []))

  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<InspectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setStatus('reading')
    setError(null)
    setResult(null)
    setFileName(file.name)
    setProgress(null)
    try {
      const bytes = await readFileBytes(file)
      const res = await inspectPdf(bytes, (page, total) => setProgress({ page, total }))
      setResult(res)
      setStatus('done')
    } catch (err) {
      console.error('Leak Checker could not read the PDF:', err)
      setError(err instanceof Error ? err.message : 'This file could not be read as a PDF.')
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setFileName('')
    setProgress(null)
  }, [])

  const exposed = result ? result.characters > 0 : false
  const allUnreadable = result ? result.unreadablePages.length >= result.pageCount : false

  return (
    <>
      <PrivacyProofBanner />

      <div className="mx-auto w-full max-w-3xl py-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <FileSearch className="size-3.5" />
            Free · 100% in your browser
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            Is your PDF really redacted?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            A black box drawn over text does not remove it — the words stay in the file, copyable
            in one click. Drop a PDF and this checks, on your device, whether its text is still
            recoverable. Nothing is uploaded.
          </p>
        </div>

        {status !== 'done' && (
          <div className="mt-8">
            <DropZone onFiles={onFiles} loading={status === 'reading'} error={error} />
            {status === 'reading' && (
              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin text-emerald-400" />
                {progress
                  ? `Scanning page ${progress.page} of ${progress.total}…`
                  : 'Reading the document…'}
              </p>
            )}
          </div>
        )}

        {status === 'done' && result && (
          <div className="mt-8 space-y-5">
            <p className="truncate text-center text-xs text-slate-500" title={fileName}>
              {fileName}
            </p>

            {allUnreadable ? (
              <Verdict
                tone="warn"
                icon={<TriangleAlert className="size-6" />}
                title="Couldn’t read this document’s text"
                lead="The pages could not be parsed for text, so this is not a clean result — check the file by eye."
              />
            ) : exposed ? (
              <Verdict
                tone="danger"
                icon={<ShieldAlert className="size-6" />}
                title={`This PDF exposes ${result.characters.toLocaleString()} characters of recoverable text`}
                lead={`Across ${result.pagesWithText} of ${result.pageCount} ${
                  result.pageCount === 1 ? 'page' : 'pages'
                }. If any of it sits under a black box, that text is still fully present and can be copied, searched, or extracted with pdftotext.`}
              />
            ) : (
              <Verdict
                tone="safe"
                icon={<ShieldCheck className="size-6" />}
                title="No recoverable text found"
                lead="This document has no extractable text layer — it appears to be flattened to images. There is nothing here to copy back out. (A scanned document with no OCR looks the same; confirm it is the file you expect.)"
              />
            )}

            {exposed && (
              <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40">
                <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5">
                  <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                    Recoverable text {result.sampleTruncated && '(first part)'}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-500">
                    {result.words.toLocaleString()} words
                  </span>
                </div>
                <pre className="max-h-72 overflow-auto px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                  {result.sample}
                </pre>
                <p className="border-t border-slate-700/50 px-4 py-2 text-[11px] text-slate-500">
                  This was read from the file on your device. It is exactly what anyone else could
                  extract from it.
                </p>
              </div>
            )}

            {result.unreadablePages.length > 0 && !allUnreadable && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {result.unreadablePages.length} page
                {result.unreadablePages.length === 1 ? '' : 's'} could not be read and{' '}
                {result.unreadablePages.length === 1 ? 'was' : 'were'} not included — check{' '}
                {result.unreadablePages.length === 1 ? 'it' : 'them'} by eye.
              </p>
            )}

            <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-center">
              {exposed && (
                <Link
                  to="/"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.98] sm:w-auto"
                >
                  Redact it properly — destroy the text
                  <ArrowRight className="size-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/40 px-5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:w-auto"
              >
                Check another file
              </button>
            </div>
          </div>
        )}

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/30 p-6 text-sm leading-relaxed text-slate-400">
          <h2 className="text-base font-semibold text-slate-200">How this works</h2>
          <p className="mt-2">
            A PDF stores text as instructions, separate from anything drawn on top of it. Covering a
            name with a black rectangle adds a drawing instruction — it does not delete the
            characters underneath, which stay in the file at known positions. This tool reads that
            text layer back the same way a copy-paste, a converter, or{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
              pdftotext
            </code>{' '}
            would.
          </p>
          <p className="mt-3">
            The only way to truly remove it is to flatten the page to an image and burn the
            redaction into the pixels — which is what{' '}
            <Link to="/" className="text-emerald-400 underline-offset-2 hover:underline">
              the redactor
            </Link>{' '}
            does, with the file never leaving your browser. More on the mechanism in{' '}
            <a
              href="/blog/black-box-flaw"
              target="_blank"
              rel="noopener"
              className="text-emerald-400 underline-offset-2 hover:underline"
            >
              The Black Box Flaw
            </a>
            .
          </p>
        </section>
      </div>
    </>
  )
}

function Verdict({
  tone,
  icon,
  title,
  lead,
}: {
  tone: 'danger' | 'safe' | 'warn'
  icon: React.ReactNode
  title: string
  lead: string
}) {
  const styles = {
    danger: 'border-red-500/40 bg-red-500/10 text-red-300',
    safe: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{lead}</p>
        </div>
      </div>
    </div>
  )
}
