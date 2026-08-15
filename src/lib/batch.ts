import { canvasPixelBudget } from './canvasBudget'
import type { DocumentScan } from './detect'
import type { RedactionMap } from './redactions'

/** How far a queued file has got through parsing. */
export type LoadState = 'queued' | 'loading' | 'ready' | 'error'

/** Where a queued file is in the bulk export. */
export type ExportState = 'idle' | 'working' | 'done' | 'failed'

/**
 * One document in the queue.
 *
 * The `File` is the only handle kept between visits — it is a reference to
 * bytes the browser already has, not a copy in the heap, so a twenty-file batch
 * costs almost nothing until a document is actually opened. Everything derived
 * (the parsed PDF, its page text) is built on demand and released straight
 * after, which is what keeps a batch inside a phone's memory.
 */
export interface QueueItem {
  id: string
  file: File
  name: string
  size: number
  /** Known once the document has been parsed at least once. */
  pageCount: number | null
  load: LoadState
  loadError: string | null

  /** Redaction boxes for this document, kept while the user works elsewhere. */
  boxes: RedactionMap

  /** Find & Redact results for this document. */
  scan: DocumentScan | null
  scanError: string | null
  /** Non-null while a scan is running, so the queue row can show progress. */
  scanProgress: { page: number; total: number } | null
  /** Match ids the user has ticked, and the ones already drawn. */
  selected: Set<string>
  redacted: Set<string>

  exportState: ExportState
  exportError: string | null
}

let itemSeq = 0

export function createQueueItem(file: File): QueueItem {
  return {
    id: `doc-${++itemSeq}`,
    file,
    name: file.name,
    size: file.size,
    pageCount: null,
    load: 'queued',
    loadError: null,
    boxes: {},
    scan: null,
    scanError: null,
    scanProgress: null,
    selected: new Set(),
    redacted: new Set(),
    exportState: 'idle',
    exportError: null,
  }
}

/**
 * How many documents to scan at once.
 *
 * Each concurrent scan opens its own pdf.js document, and pdf.js parses in a
 * Web Worker — so the work genuinely runs off the main thread and the UI keeps
 * responding while a batch churns. The ceiling is memory, not cores: every open
 * document holds parsed page structures, and a phone that opens six at once
 * will have the tab discarded out from under it. The canvas budget is reused
 * here as a device-class signal because it already encodes exactly that
 * judgement (RAM where the browser reports it, screen size everywhere else).
 */
export function scanConcurrency(): number {
  const budget = canvasPixelBudget()
  const cores = navigator.hardwareConcurrency || 2
  if (budget <= 3_000_000) return 1
  if (budget <= 8_000_000) return Math.min(2, Math.max(1, cores - 1))
  return Math.min(3, Math.max(1, cores - 1))
}

/**
 * Run `task` over `items` with at most `limit` in flight.
 *
 * Results are not collected: each task reports through its own side effects, so
 * a queue of twenty documents streams its findings into the UI as they land
 * rather than appearing all at once at the end.
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      await task(items[index])
    }
  })
  await Promise.all(workers)
}

/** Total redaction boxes across every document in the queue. */
export function countQueueBoxes(items: readonly QueueItem[]): number {
  let total = 0
  for (const item of items) {
    for (const boxes of Object.values(item.boxes)) total += boxes.length
  }
  return total
}

/** Matches ticked but not yet drawn, for one document. */
export function pendingMatches(item: QueueItem) {
  if (!item.scan) return []
  return item.scan.matches.filter((m) => item.selected.has(m.id) && !item.redacted.has(m.id))
}
