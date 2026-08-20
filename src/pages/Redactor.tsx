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
      heading="Securely Redact PDFs and Sensitive Documents — 100% Local & Private"
      subheading="From legal contracts and medical records to personal identification, RedactLocal processes every file directly in your browser. No server. No cloud. No leaks."
    />
  )
}
