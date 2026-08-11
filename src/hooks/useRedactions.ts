import { useCallback, useMemo, useState } from 'react'
import { countBoxes, type RedactionBox, type RedactionMap } from '../lib/redactions'

let boxSeq = 0

/** Redaction boxes for the open document, keyed by page. Lives in memory only. */
export function useRedactions() {
  const [boxes, setBoxes] = useState<RedactionMap>({})

  const addBox = useCallback((page: number, box: Omit<RedactionBox, 'id'>) => {
    // The id is minted outside the updater: updaters must stay pure, or React
    // re-running them (as it does in StrictMode) burns ids.
    const withId: RedactionBox = { ...box, id: `box-${++boxSeq}` }
    setBoxes((current) => ({ ...current, [page]: [...(current[page] ?? []), withId] }))
  }, [])

  const undoLast = useCallback((page: number) => {
    setBoxes((current) => {
      const pageBoxes = current[page]
      if (!pageBoxes?.length) return current
      const next = { ...current, [page]: pageBoxes.slice(0, -1) }
      if (next[page].length === 0) delete next[page]
      return next
    })
  }, [])

  const clearPage = useCallback((page: number) => {
    setBoxes((current) => {
      if (!current[page]) return current
      const next = { ...current }
      delete next[page]
      return next
    })
  }, [])

  const clearAll = useCallback(() => setBoxes({}), [])

  const total = useMemo(() => countBoxes(boxes), [boxes])

  return { boxes, addBox, undoLast, clearPage, clearAll, total }
}
