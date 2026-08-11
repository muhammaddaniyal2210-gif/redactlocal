# RedactLocal

A PDF redactor that never uploads anything. The file is read into the tab with the
browser's `FileReader`, parsed by `pdfjs-dist` in a worker, and painted to a `<canvas>`.
There is no backend — pull the network cable and the app keeps working.

## Run it

```bash
npm install
npm run dev
```

Build: `npm run build` · lint: `npm run lint`

## Phase 1 (done)

- Dark shell with the "100% Local (Zero Uploads)" badge and an offline self-test walkthrough
- Drag & drop / click-to-browse for a single `.pdf`
- In-memory load via `FileReader.readAsArrayBuffer`
- Canvas rendering at device pixel ratio, with render cancellation on fast page/zoom changes
- Page navigation (buttons, page box, ← / → keys) and zoom (25 %–400 %, reset, fit-to-width)

## Why the pdf.js worker is not on a CDN

The spec asked for the worker to come from a CDN. That directly defeats the
"Test Offline: Disconnect Wi-Fi" promise — with the network off, a CDN worker never
loads and nothing renders. So the worker is bundled from `node_modules` with Vite's
`?url` import, and pdf.js's `standard_fonts`, `cmaps`, `wasm` and `iccs` are copied to
`public/pdfjs/` (`npm run sync:pdfjs` refreshes them after a `pdfjs-dist` upgrade).
Everything is served from our own origin. Verified: no request in the app leaves
`localhost`.

The `wasm` and `iccs` directories matter more than they look. pdf.js v6 decodes JBIG2
and JPEG 2000 — the formats scanners emit — through WebAssembly, and applies ICC colour
profiles the same way. Left unconfigured, `wasmUrl` and `iccUrl` resolve against the page
URL and quietly fail, so a scanned document would render wrong or not at all. Scanned
documents are precisely what people bring to a redaction tool.

## Phase 2 (done)

- A transparent `<canvas>` overlay on top of the page takes mouse and touch drags and
  paints `#000000` boxes. The page canvas underneath is never drawn on, so re-rendering
  at a new zoom cannot lose a redaction.
- Boxes are stored in **unscaled PDF units** (`getViewport({ scale: 1 })`, rotation
  already applied), so the same numbers drive the 100 % view, the 400 % view and the
  144 dpi export.
- Toolbar: Draw Mode, Undo Last Box, Clear Page, Clear All Pages, Export Redacted PDF.
  `Esc` abandons the box being dragged.

### Why the export is a raster

A black rectangle drawn *into* a PDF is a shape sitting on top of the text; the text is
still there and still selectable. So the export never edits the original: every page is
rasterised to a canvas, the boxes are filled onto those pixels, and the canvas — via
`toDataURL('image/png', 1.0)` — becomes the only content of a new `jspdf` document. Text
objects, fonts, vector paths and the source's metadata have no path into the output.

Two jsPDF details matter for that promise:

- `putOnlyUsedFonts: true` — jsPDF otherwise writes its 14 standard font dictionaries
  into every document. With no text drawn, this leaves **zero** font objects.
- `setCreationDate("D:20000101000000+00'00'")` as a literal string — passing a `Date`
  makes jsPDF format it in local time, stamping the user's timezone onto every file.

`/Producer (jsPDF 4.2.1)` is written unconditionally by jsPDF and cannot be suppressed
through its API. It identifies the library, not the user or the document.

### Self-verification

After building the file and before handing it over, `verifyExport` re-opens the exact
bytes and reports what a recipient could recover: characters via `getTextContent`,
text-showing operators in the content streams, font objects (counted straight off the
raw bytes), and annotations. The result is shown in the UI; anything non-zero turns the
banner amber and says not to share the file.

Audited on a 3-page fixture with an independent pdf.js instance: 0 extractable
characters on every page, 0 font objects, 0 annotations, 3 image XObjects, and a solid
black bar at rows 126–151 pt — exactly the line where the original's SSN text sat at
y = 142 pt.

## Phase 3 (done)

- **Mobile.** The page canvas and the redaction overlay carry `max-w-full h-auto`
  with only their width set inline, so a 595 pt page renders at 317 px on a 375 px
  phone with its aspect ratio intact. Hit-testing divides by the overlay's *measured*
  width, not by the zoom level — at 0.53× display scale a touch still lands where the
  finger pointed. `touch-action: none` on the overlay stops the page scrolling mid-drag.
- **Privacy Proof banner** above the workspace, with a live online/offline pill and a
  collapsible three-bullet explanation of why this beats a cloud tool. It is an inline
  disclosure rather than an overlay — a second modal on top of the existing "Test
  Offline" dialog would be one dialog too many, and it reads better on a phone.
- **Ad slots** (`.adsense-slot-container`): a 300 × 250 sidebar (`hidden lg:block`) and
  a 728 × 90 post-download banner. Both reserve their box unconditionally and set
  `contain: layout paint`.
- **Progress**: "Processing Page X of Y…" with a determinate bar, then a verify step.

### Layout stability

The export progress and the result sit *below* the page stage, not above it. Above it,
every ad and success message would push the canvas down at the exact moment the user is
still working on it. Measured across a 5-page export: the canvas top-left stayed at
(261, 356) and its width at 595 px, with two 0.00025 layout-shift entries recorded by
`PerformanceObserver` — a total CLS of 0.017 for the whole session, against Google's 0.1
"good" threshold.

`main` carries `min-h-0` so the stage, not the window, does the scrolling. Without it a
flex item refuses to shrink below its content and the whole page scrolls, pushing the
toolbars and the export result off-screen.

### The ad slots are inert

No ad script is loaded. Adding one would put a third-party request — and its tracking —
on a page whose entire pitch is that it makes none, and would break the offline test in
the banner directly above it. The slots reserve layout only; wiring a network in is a
decision with a real privacy cost attached.

## Phase 4 (done)

Five high-intent routes, generated from one content table
([`src/content/landings.ts`](src/content/landings.ts)) and one template
([`DocumentRedactorLanding.tsx`](src/components/DocumentRedactorLanding.tsx)):

| Route | H1 |
| --- | --- |
| `/redact-bank-statement` | Redact Bank Statements Online (100% Private & Free) |
| `/redact-tax-forms` | Blackout SSN & Tax Forms Without Uploading Files |
| `/redact-passport-id` | Free Passport & ID Card Photo Redactor |
| `/redact-w9-form` | Redact W9 Forms & Financial Records Locally |
| `/blackout-invoice-pdf` | Censor Invoice Balances & Client Details Offline |

Adding a sixth document type is a data change, not a code change.

Every route mounts the same `RedactorWorkspace` — the actual editor, not a
landing-page imitation of it — then renders the three-step workflow, a ~300-word
FAQ written for that document type, and links to its siblings. `useDocumentHead`
sets title, description, canonical, OpenGraph, Twitter and JSON-LD per route and
removes them on the way out, so navigating between landings never accumulates a
second canonical.

### Why the build prerenders

Head tags written by React are enough for search engines that execute JavaScript.
Social scrapers — Slack, Facebook, LinkedIn, X — do not run scripts and would see
the bare `index.html`, so `npm run prerender` (part of `npm run build`) writes
`dist/<slug>/index.html` with the tags already in the markup, plus `sitemap.xml`
and `robots.txt`. It also means a static host serves these URLs directly with no
SPA rewrite rules. The page *body* is still client-rendered; this is head-tag
prerendering, not SSR.

The script imports `landings.ts` and `seo.ts` directly — Node 24 strips the types
— so the routes, copy and schema have exactly one definition shared by the app and
the build.

Set `VITE_SITE_URL` (build) or `SITE_URL` (prerender) to control the origin used
in canonical and OpenGraph URLs. It defaults to `https://redactlocal.app`.

### Schema

Each route emits a `@graph` with `SoftwareApplication` — free (`price: "0"`,
`isAccessibleForFree`), browser-based (`operatingSystem: "Any — runs in a web
browser"`, no install or server), with the redaction feature list — and a
`FAQPage` built from the same `targetedFAQ` that renders on the page, so the
questions a crawler sees are the questions a visitor reads.

## Memory model

One document is open at a time. `usePdfDocument` holds the raw bytes plus the parsed
`PDFDocumentProxy`; the pristine bytes are kept because `getDocument` detaches whatever
buffer it is handed. Redaction boxes live in `useRedactions` and are dropped when the
file is closed. Closing destroys the loading task and frees the worker's copy. Nothing
touches disk, IndexedDB, `localStorage`, or the network.

## Next

Phase 3 candidates: move/resize/delete an existing box, a thumbnail rail, an export
density control, and an optional text-search-driven "find and redact every occurrence".
