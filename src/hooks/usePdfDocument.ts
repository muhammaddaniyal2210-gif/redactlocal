import { useCallback, useEffect, useRef, useState } from 'react'
import { destroyPdfDocument, loadPdfDocument, readFileBytes, type PDFDocumentProxy } from '../lib/pdfjs'

export type DocStatus = 'empty' | 'loading' | 'ready' | 'error'

export interface LoadedDoc {
  name: string
  size: number
  bytes: Uint8Array
  pdf: PDFDocumentProxy
  pageCount: number
}

/**
 * Owns the single open document. Everything it touches — the bytes, the parsed
 * document, the rendered pages — lives in this tab's memory and is dropped on close.
 */
export function usePdfDocument() {
  const [status, setStatus] = useState<DocStatus>('empty')
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<LoadedDoc | null>(null)

  // Mirrors `doc` so teardown never has to run inside a state updater.
  const openDoc = useRef<PDFDocumentProxy | null>(null)
  const loadId = useRef(0)

  const release = useCallback(() => {
    loadId.current += 1
    const previous = openDoc.current
    openDoc.current = null
    destroyPdfDocument(previous)
  }, [])

  const close = useCallback(() => {
    release()
    setDoc(null)
    setStatus('empty')
    setError(null)
  }, [release])

  const open = useCallback(
    async (file: File) => {
      release()
      const id = loadId.current
      setDoc(null)
      setStatus('loading')
      setError(null)

      try {
        const bytes = await readFileBytes(file)
        const pdf = await loadPdfDocument(bytes)

        // A newer file was picked (or the doc was closed) while we were parsing.
        if (id !== loadId.current) {
          destroyPdfDocument(pdf)
          return
        }

        openDoc.current = pdf
        setDoc({ name: file.name, size: file.size, bytes, pdf, pageCount: pdf.numPages })
        setStatus('ready')
      } catch (err) {
        if (id !== loadId.current) return
        const message = err instanceof Error ? err.message : String(err)
        setError(
          /password/i.test(message)
            ? 'This PDF is password protected. Remove the password and try again.'
            : `Could not open this PDF. ${message}`,
        )
        setStatus('error')
      }
    },
    [release],
  )

  // Drop the document (and its worker resources) if the app unmounts.
  useEffect(() => release, [release])

  return { status, error, doc, open, close }
}
