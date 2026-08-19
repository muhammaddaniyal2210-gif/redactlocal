import { PrivacyProofBanner } from './PrivacyProofBanner'
import { DropZone } from './DropZone'
import { ArmedPresetNotice } from './ArmedPresetNotice'
import { PdfViewer } from './PdfViewer'
import { SecurityGuarantee } from './SecurityGuarantee'
import { useDocumentQueue } from '../hooks/useDocumentQueue'

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
  const queue = useDocumentQueue()
  const { status, error, doc, addFiles, closeAll } = queue
  const Heading = headingLevel

  return (
    <>
      <PrivacyProofBanner />

      {/* From lg up — where Find & Redact sits beside the page — the row takes
          a definite height so the canvas and the panel each scroll inside
          themselves and match. Left to grow it reached 1146px against a 764px
          viewport area and scrolled the page instead. Below lg the panel stacks
          under the editor and the two share the row, so a fixed height there
          squeezes the toolbar out of the card; the row grows instead. */}
      <div
        className={`mt-5 flex min-h-0 ${
          doc
            ? 'lg:h-[calc(100dvh-16.5rem)] lg:min-h-[26rem]'
            : editorHeightClass
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* `doc`, not `status === 'ready'`: during a queue switch the status
              goes back to loading while the previous document is still on
              screen, and keying the editor off that would unmount it — and the
              panel, the zoom and the mode with it — on every click in the queue. */}
          {doc ? (
            <PdfViewer doc={doc} onClose={closeAll} queue={queue} />
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
              {/* Renders nothing for organic traffic, so the default page is
                  a drop zone and nothing else. */}
              <ArmedPresetNotice
                preset={queue.preset}
                enteredWithPreset={queue.enteredWithPreset}
              />

              <DropZone onFiles={addFiles} loading={status === 'loading'} error={error} />

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
