import { useLayoutEffect } from 'react'
import type { HeadTags } from '../lib/seo'

/** Marks every element this hook owns, so a route change can clean up after itself. */
const MANAGED = 'data-managed-head'

function upsert(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    el.setAttribute(MANAGED, '')
    document.head.appendChild(el)
  }
  apply(el)
}

function meta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  upsert(
    `meta[${attr}="${name}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute(attr, name)
      return el
    },
    (el) => el.setAttribute('content', content),
  )
}

/**
 * Applies a route's head tags on mount and removes the ones it created on the
 * way out, so navigating between landing pages never leaves a previous route's
 * canonical or OpenGraph data behind.
 *
 * These tags are written by the client. Search engines that execute JavaScript
 * will see them; social scrapers generally will not, which is why the build
 * also bakes them into a static HTML file per route (`npm run prerender`).
 */
export function useDocumentHead(tags: HeadTags) {
  useLayoutEffect(() => {
    const previousTitle = document.title
    document.title = tags.title

    meta('description', tags.description)
    // `Object.entries(undefined)` throws, so a route with no OG block would
    // take the whole page down rather than just miss a preview tag.
    for (const [property, content] of Object.entries(tags.og ?? {})) {
      meta(property, content, 'property')
    }
    for (const [name, content] of Object.entries(tags.twitter ?? {})) meta(name, content)

    upsert(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        return el
      },
      (el) => el.setAttribute('href', tags.canonical),
    )

    // JSON-LD is replaced wholesale rather than patched — it is one blob.
    document.head.querySelector('script[type="application/ld+json"][data-managed-head]')?.remove()
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(MANAGED, '')
    script.textContent = JSON.stringify(tags.jsonLd)
    document.head.appendChild(script)

    return () => {
      document.title = previousTitle
      // Array.from before iterating: removing nodes from a live-ish collection
      // while walking it is the kind of thing that differs between engines.
      for (const el of Array.from(document.head.querySelectorAll(`[${MANAGED}]`))) el.remove()
    }
  }, [tags])
}
