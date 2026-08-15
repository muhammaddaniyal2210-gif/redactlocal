import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  destroyPdfDocument,
  loadPdfDocument,
  readFileBytes,
  type PDFDocumentProxy,
} from '../lib/pdfjs'
import {
  countQueueBoxes,
  createQueueItem,
  pendingMatches,
  runPool,
  scanConcurrency,
  type QueueItem,
} from '../lib/batch'
import { SWEEP_CATEGORIES, scanDocument, type ScanMatch, type SweepCategoryId } from '../lib/detect'
import { downloadBlob, exportRedactedPdf, ExportFailure, type ExportProgress } from '../lib/export'
import { createZip, sanitizeFileName, uniqueName } from '../lib/zip'
import type { RedactionBox, RedactionMap } from '../lib/redactions'
import { NO_STAMP, stampTextFor, type StampSelection } from '../lib/stamps'

export type DocStatus = 'empty' | 'loading' | 'ready' | 'error'

export interface LoadedDoc {
  name: string
  size: number
  pdf: PDFDocumentProxy
  pageCount: number
}

export type BulkExportMode = 'zip' | 'separate'

export interface BulkExportProgress {
  /** Documents finished so far, out of the whole queue. */
  done: number
  total: number
  currentName: string
  /** Page-level progress inside the document currently being flattened. */
  page: ExportProgress | null
}

export interface BulkExportSummary {
  mode: BulkExportMode
  succeeded: number
  failed: number
  /** Files whose post-export verification could not be completed in full. */
  partiallyVerified: number
  fileName: string | null
}

let boxSeq = 0

/**
 * Gap between two programmatic downloads in "separate files" mode. Browsers
 * throttle a burst of them, and Chrome shows a "download multiple files"
 * prompt; spacing them out keeps every file arriving.
 */
const DOWNLOAD_GAP_MS = 350

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The document queue: one or many PDFs, all held in this tab.
 *
 * A batch changes nothing about the privacy model. Every file stays a `File`
 * handle until it is needed, is parsed in a worker in this tab, and is released
 * immediately afterwards. Nothing is uploaded, nothing is persisted, and the
 * whole queue disappears with the tab — the same guarantee as a single file,
 * repeated N times.
 */
export function useDocumentQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [doc, setDoc] = useState<LoadedDoc | null>(null)
  const [status, setStatus] = useState<DocStatus>('empty')
  const [error, setError] = useState<string | null>(null)

  const [enabled, setEnabled] = useState<Set<SweepCategoryId>>(
    () => new Set(SWEEP_CATEGORIES.map((c) => c.id)),
  )
  // The stamp is a tool setting, not a document's property: it is shared across
  // the queue so a batch comes out marked consistently, and it is read only at
  // the moment a box is created.
  const [stamp, setStamp] = useState<StampSelection>(NO_STAMP)
  const [scanningAll, setScanningAll] = useState(false)
  const [bulkExport, setBulkExport] = useState<BulkExportProgress | null>(null)
  const [bulkSummary, setBulkSummary] = useState<BulkExportSummary | null>(null)

  // Mirrors kept in sync during render so async work and event handlers can
  // read current values without either going stale or forcing a re-subscribe.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const stampRef = useRef(stamp)
  stampRef.current = stamp

  /** The parsed active document, so teardown never runs inside a state updater. */
  const openDoc = useRef<PDFDocumentProxy | null>(null)
  const loadId = useRef(0)

  const patch = useCallback(
    (id: string, update: Partial<QueueItem> | ((item: QueueItem) => Partial<QueueItem>)) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, ...(typeof update === 'function' ? update(item) : update) }
            : item,
        ),
      )
    },
    [],
  )

  // ---------------------------------------------------------------- queue

  const addFiles = useCallback((files: readonly File[]) => {
    if (files.length === 0) return
    const created = files.map(createQueueItem)
    setItems((current) => [...current, ...created])
    // Only the first drop takes focus. Adding to a running batch must not yank
    // the canvas away from the document being worked on.
    setActiveId((current) => current ?? created[0].id)
  }, [])

  const activate = useCallback((id: string) => setActiveId(id), [])

  const remove = useCallback((id: string) => {
    const current = itemsRef.current
    const index = current.findIndex((item) => item.id === id)
    if (index === -1) return
    const next = current.filter((item) => item.id !== id)
    setItems(next)
    if (activeIdRef.current === id) {
      // Prefer the document that slides into this row, then the one above it.
      setActiveId(next[index]?.id ?? next[index - 1]?.id ?? null)
    }
  }, [])

  const closeAll = useCallback(() => {
    loadId.current += 1
    const previous = openDoc.current
    openDoc.current = null
    destroyPdfDocument(previous)
    setItems([])
    setActiveId(null)
    setDoc(null)
    setStatus('empty')
    setError(null)
    setBulkSummary(null)
    setBulkExport(null)
  }, [])

  // ------------------------------------------------------- active document

  /** Last document that opened cleanly, to fall back to when one refuses to. */
  const lastGoodId = useRef<string | null>(null)

  // Parse whichever document is active.
  //
  // The document on screen is held until its replacement is ready, then swapped
  // and released. Tearing the old one down first would empty the canvas — and
  // with it unmount the whole editor, which flashes the upload screen between
  // every click in the queue and resets the panel, the zoom and the mode along
  // with it. Two parsed documents exist for the moment of the swap; never more.
  useEffect(() => {
    const id = activeId
    if (!id) {
      loadId.current += 1
      const previous = openDoc.current
      openDoc.current = null
      destroyPdfDocument(previous)
      lastGoodId.current = null
      setDoc(null)
      setStatus('empty')
      setError(null)
      return
    }

    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item) return

    loadId.current += 1
    const generation = loadId.current
    let cancelled = false
    setStatus('loading')
    setError(null)
    patch(id, { load: 'loading', loadError: null })

    void (async () => {
      try {
        const bytes = await readFileBytes(item.file)
        const pdf = await loadPdfDocument(bytes)

        // A different document was selected while this one was parsing.
        if (cancelled || generation !== loadId.current) {
          destroyPdfDocument(pdf)
          return
        }

        const previous = openDoc.current
        openDoc.current = pdf
        lastGoodId.current = id
        setDoc({ name: item.name, size: item.size, pdf, pageCount: pdf.numPages })
        setStatus('ready')
        patch(id, { load: 'ready', pageCount: pdf.numPages, loadError: null })
        destroyPdfDocument(previous)
      } catch (err) {
        if (cancelled || generation !== loadId.current) return
        const message = err instanceof Error ? err.message : String(err)
        const friendly = /password/i.test(message)
          ? 'This PDF is password protected. Remove the password and try again.'
          : `Could not open this PDF. ${message}`
        patch(id, { load: 'error', loadError: friendly })

        // One bad file must not end the batch. Go back to whatever was last
        // open, or forward to the next file that has not already failed; the
        // row keeps its own error either way. Only when nothing at all can be
        // shown does the workspace fall back to the drop zone.
        const queue = itemsRef.current
        const failedIndex = queue.findIndex((entry) => entry.id === id)
        const fallback =
          (lastGoodId.current && lastGoodId.current !== id ? lastGoodId.current : null) ??
          queue.slice(failedIndex + 1).find((entry) => entry.load !== 'error')?.id ??
          null

        if (fallback) {
          setActiveId(fallback)
          return
        }

        const previous = openDoc.current
        openDoc.current = null
        destroyPdfDocument(previous)
        setDoc(null)
        setError(friendly)
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeId, patch])

  // Drop the open document (and its worker) if the app unmounts.
  useEffect(
    () => () => {
      loadId.current += 1
      destroyPdfDocument(openDoc.current)
      openDoc.current = null
    },
    [],
  )

  /**
   * Open a queued document, run `fn`, then release it.
   *
   * Batch work always parses its own copy rather than borrowing the active
   * document. Re-parsing costs a moment; sharing a proxy that the active-document
   * effect is free to destroy at any time would cost correctness.
   */
  const withDocument = useCallback(
    async <T,>(item: QueueItem, fn: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> => {
      const bytes = await readFileBytes(item.file)
      const pdf = await loadPdfDocument(bytes)
      try {
        return await fn(pdf)
      } finally {
        destroyPdfDocument(pdf)
      }
    },
    [],
  )

  // -------------------------------------------------------------- boxes

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId],
  )

  const addBox = useCallback(
    (page: number, box: Omit<RedactionBox, 'id'>) => {
      const id = activeIdRef.current
      if (!id) return
      // Minted outside the updater: updaters must stay pure, or React re-running
      // them (as it does in StrictMode) burns ids.
      const label = stampTextFor(stampRef.current)
      const withId: RedactionBox = { ...box, id: `box-${++boxSeq}`, ...(label ? { label } : {}) }
      patch(id, (item) => ({
        boxes: { ...item.boxes, [page]: [...(item.boxes[page] ?? []), withId] },
      }))
    },
    [patch],
  )

  const addBoxes = useCallback(
    (page: number, incoming: readonly Omit<RedactionBox, 'id'>[]) => {
      const id = activeIdRef.current
      if (!id || incoming.length === 0) return
      const label = stampTextFor(stampRef.current)
      const withIds: RedactionBox[] = incoming.map((box) => ({
        ...box,
        id: `box-${++boxSeq}`,
        ...(label ? { label } : {}),
      }))
      patch(id, (item) => ({
        boxes: { ...item.boxes, [page]: [...(item.boxes[page] ?? []), ...withIds] },
      }))
    },
    [patch],
  )

  const undoLast = useCallback(
    (page: number) => {
      const id = activeIdRef.current
      if (!id) return
      patch(id, (item) => {
        const pageBoxes = item.boxes[page]
        if (!pageBoxes?.length) return {}
        const boxes = { ...item.boxes, [page]: pageBoxes.slice(0, -1) }
        if (boxes[page].length === 0) delete boxes[page]
        return { boxes }
      })
    },
    [patch],
  )

  const clearPage = useCallback(
    (page: number) => {
      const id = activeIdRef.current
      if (!id) return
      patch(id, (item) => {
        if (!item.boxes[page]) return {}
        const boxes = { ...item.boxes }
        delete boxes[page]
        return { boxes }
      })
    },
    [patch],
  )

  const clearAll = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return
    patch(id, { boxes: {} })
  }, [patch])

  // -------------------------------------------------------------- scanning

  const toggleCategory = useCallback((id: SweepCategoryId) => {
    setEnabled((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** Scan one queued document and store its findings on that document. */
  const scanItem = useCallback(
    async (item: QueueItem) => {
      patch(item.id, { scanProgress: { page: 0, total: item.pageCount ?? 0 }, scanError: null })
      try {
        const scan = await withDocument(item, (pdf) =>
          scanDocument(pdf, enabledRef.current, (page, total) =>
            patch(item.id, { scanProgress: { page, total } }),
          ),
        )
        patch(item.id, {
          scan,
          scanError: null,
          scanProgress: null,
          pageCount: scan.pagesScanned,
          // Everything found starts ticked: the common case is confirming, not
          // hunting for the one hit worth keeping.
          selected: new Set(scan.matches.map((m) => m.id)),
          redacted: new Set(),
        })
      } catch (err) {
        console.error(`Find & Redact could not scan "${item.name}":`, err)
        patch(item.id, {
          scanProgress: null,
          scanError: err instanceof Error ? err.message : 'The scan could not finish.',
        })
      }
    },
    [patch, withDocument],
  )

  const scanActive = useCallback(async () => {
    const item = itemsRef.current.find((entry) => entry.id === activeIdRef.current)
    if (item) await scanItem(item)
  }, [scanItem])

  /**
   * Scan every queued document, several at a time.
   *
   * Each document gets its own pdf.js instance, and pdf.js does its parsing in
   * a Web Worker — so the pattern matching for a twenty-file batch runs off the
   * main thread and the canvas stays interactive throughout.
   */
  const scanAll = useCallback(async () => {
    const targets = itemsRef.current
    if (targets.length === 0) return
    setScanningAll(true)
    try {
      await runPool(targets, scanConcurrency(), scanItem)
    } finally {
      setScanningAll(false)
    }
  }, [scanItem])

  const toggleMatch = useCallback(
    (matchId: string) => {
      const id = activeIdRef.current
      if (!id) return
      patch(id, (item) => {
        const selected = new Set(item.selected)
        if (selected.has(matchId)) selected.delete(matchId)
        else selected.add(matchId)
        return { selected }
      })
    },
    [patch],
  )

  /** Draw every ticked-but-not-yet-drawn match on the active document. */
  const applySelected = useCallback(() => {
    const item = itemsRef.current.find((entry) => entry.id === activeIdRef.current)
    if (!item) return
    const pending = pendingMatches(item)
    if (pending.length === 0) return

    const byPage = new Map<number, ScanMatch['box'][]>()
    for (const match of pending) {
      const list = byPage.get(match.page) ?? []
      list.push(match.box)
      byPage.set(match.page, list)
    }
    for (const [page, boxes] of byPage) addBoxes(page, boxes)

    patch(item.id, (current) => {
      const redacted = new Set(current.redacted)
      for (const match of pending) redacted.add(match.id)
      return { redacted }
    })
  }, [addBoxes, patch])

  // ---------------------------------------------------------- bulk export

  /**
   * Flatten and download every queued document.
   *
   * Sequential by design: each export rasterises a page at print density and
   * builds a PDF in memory, so running several at once is the one thing most
   * likely to have a phone kill the tab. The archive is assembled here in the
   * page — there is no server step, and the bytes never leave this tab until
   * the browser writes them to disk.
   */
  const exportAll = useCallback(
    async (mode: BulkExportMode) => {
      const targets = itemsRef.current
      if (targets.length === 0) return
      setBulkSummary(null)

      const taken = new Set<string>()
      const bundle: { name: string; bytes: Uint8Array }[] = []
      let succeeded = 0
      let failed = 0
      let partiallyVerified = 0

      for (const [index, item] of targets.entries()) {
        setBulkExport({ done: index, total: targets.length, currentName: item.name, page: null })
        patch(item.id, { exportState: 'working', exportError: null })

        const fileName = uniqueName(`redacted_${sanitizeFileName(item.name)}.pdf`, taken)
        try {
          const result = await withDocument(item, (pdf) => {
            // A document exported without ever being opened has no page count
            // yet; parsing it here is the first and only chance to fill it in.
            patch(item.id, { pageCount: pdf.numPages })
            return exportRedactedPdf(
              pdf,
              item.boxes,
              (page) =>
                setBulkExport({
                  done: index,
                  total: targets.length,
                  currentName: item.name,
                  page,
                }),
              { fileName },
            )
          })

          if (!result.verification.clean) partiallyVerified += 1
          succeeded += 1
          patch(item.id, { exportState: 'done', exportError: null })

          if (mode === 'zip') {
            bundle.push({
              name: result.fileName,
              bytes: new Uint8Array(await result.blob.arrayBuffer()),
            })
          } else {
            downloadBlob(result.blob, result.fileName)
            await delay(DOWNLOAD_GAP_MS)
          }
        } catch (err) {
          failed += 1
          const message =
            err instanceof ExportFailure || err instanceof Error ? err.message : String(err)
          console.error(`Batch export failed for "${item.name}":`, err)
          patch(item.id, { exportState: 'failed', exportError: message })
        }
      }

      let archiveName: string | null = null
      if (mode === 'zip' && bundle.length > 0) {
        archiveName = 'redacted_documents.zip'
        downloadBlob(createZip(bundle), archiveName)
      }

      setBulkExport(null)
      setBulkSummary({
        mode,
        succeeded,
        failed,
        partiallyVerified,
        fileName: archiveName,
      })
    },
    [patch, withDocument],
  )

  const totalBoxes = useMemo(() => countQueueBoxes(items), [items])
  const busy = scanningAll || bulkExport !== null

  return {
    // queue
    items,
    activeId,
    activeItem,
    addFiles,
    activate,
    remove,
    closeAll,
    isBatch: items.length > 1,

    // active document
    doc,
    status,
    error,

    // redactions on the active document
    boxes: activeItem?.boxes ?? EMPTY_BOXES,
    addBox,
    addBoxes,
    undoLast,
    clearPage,
    clearAll,
    totalBoxes,

    // stamps
    stamp,
    setStamp,

    // find & redact
    enabled,
    toggleCategory,
    scanActive,
    scanAll,
    scanningAll,
    toggleMatch,
    applySelected,

    // bulk export
    exportAll,
    bulkExport,
    bulkSummary,
    dismissSummary: useCallback(() => setBulkSummary(null), []),

    busy,
  }
}

const EMPTY_BOXES: RedactionMap = {}

/** Everything the workspace and viewer need from the queue, in one object. */
export type DocumentQueue = ReturnType<typeof useDocumentQueue>
