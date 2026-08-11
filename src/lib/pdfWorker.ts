/**
 * The pdf.js worker, with our polyfills applied first.
 *
 * A worker is a separate JavaScript realm: polyfilling `Promise.withResolvers`
 * on the window does nothing for the worker thread, and pdf.js calls it there
 * too. This wrapper is what `GlobalWorkerOptions.workerSrc` points at, so the
 * patch is in place before any pdf.js worker code runs.
 */
import './polyfills'
import 'pdfjs-dist/build/pdf.worker.min.mjs'
