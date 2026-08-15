import { PrivacyProofBanner } from './PrivacyProofBanner'
import { DropZone } from './DropZone'
import { PdfViewer } from './PdfViewer'
import { SecurityGuarantee } from './SecurityGuarantee'
import { usePdfDocument } from '../hooks/usePdfDocument'

interface RedactorWorkspaceProps {
  /** Headline above the tool. The landing routes pass their own H1. */
  heading: React.ReactNode
  subheading: string
  /** Height of the editor block. Home fills the viewport; landings are capped
   *  so the SEO content below them is reachable by scrolling. */
  editorHeightClass?: string
  headingLevel?: 'h1' | 'h2'
}

/**
 * The tool itself — privacy banner, drop zone, editor.
 *
 * Every route mounts this same component, so a visitor arriving on
 * /redact-bank-statement gets the identical editor as the home page rather than
 * a landing-page imitation of it.
 */
export function RedactorWorkspace({
  heading,
  subheading,
  editorHeightClass = 'flex-1',
  headingLevel = 'h1',
}: RedactorWorkspaceProps) {
  const { status, error, doc, open, close } = usePdfDocument()
  const Heading = headingLevel

  return (
    <>
      <PrivacyProofBanner />

      {/* With a document open the editor row takes a definite height, so the
          page canvas and the Find & Redact panel each scroll inside themselves
          and stay the same height. Left to grow it reached 1146px against a
          764px viewport area, which scrolled the page instead. The empty state
          keeps its flexible height so the drop zone stays centred. */}
      <div
        className={`mt-5 flex min-h-0 ${
          doc && status === 'ready'
            ? 'h-[calc(100dvh-17rem)] min-h-[26rem]'
            : editorHeightClass
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {doc && status === 'ready' ? (
            <PdfViewer doc={doc} onClose={close} />
          ) : (
            <div className="flex flex-1 flex-col justify-center py-4">
              <div className="mb-8 text-center">
                <Heading className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
                  {heading}
                </Heading>
                <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
                  {subheading}
                </p>
              </div>
              <DropZone onFile={open} loading={status === 'loading'} error={error} />
              {/* Directly under the drop zone, in the same column width, so it
                  reads as part of the tool rather than as page furniture. */}
              <div className="mx-auto w-full max-w-2xl">
                <SecurityGuarantee />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
