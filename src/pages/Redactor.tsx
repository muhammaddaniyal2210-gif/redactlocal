import { useMemo } from 'react'
import { RedactorWorkspace } from '../components/RedactorWorkspace'
import { useDocumentHead } from '../hooks/useDocumentHead'
import { buildHomeHeadTags } from '../lib/seo'

/** The home route: the tool, filling the viewport, with no landing copy below. */
export function Redactor() {
  const head = useMemo(() => buildHomeHeadTags(), [])
  useDocumentHead(head)

  return (
    <RedactorWorkspace
      heading="Redact a PDF without it ever leaving your device"
      subheading="The file is read into this tab's memory with the browser's own FileReader and rendered here. There is no server to send it to."
    />
  )
}
