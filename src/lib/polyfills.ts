/**
 * Polyfills for APIs pdf.js calls directly that older WebKit lacks.
 *
 * This module must be evaluated before pdf.js, in both the window and the
 * worker — hence the deliberate lack of any DOM access here.
 *
 * The one that matters is `Promise.withResolvers`: pdf.js v6 calls it 27 times
 * in the main bundle and 13 times in the worker, and Safari only shipped it in
 * 17.4. On Safari 17.3 and earlier the property is `undefined`, and calling it
 * is reported by WebKit as "undefined is not a function" — the error this file
 * exists to stop.
 */

declare global {
  interface PromiseConstructor {
    withResolvers?<T>(): {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    }
  }
}

/**
 * Which polyfills this engine actually needed. Recorded at patch time because
 * once installed, feature detection can no longer tell you what was missing —
 * and "what was missing" is the single most useful fact when diagnosing a
 * browser you cannot reproduce on.
 */
export const INSTALLED_POLYFILLS: string[] = []

if (typeof Promise.withResolvers !== 'function') {
  INSTALLED_POLYFILLS.push('Promise.withResolvers')
  Promise.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Safari 15.4 for both. Cheap insurance for anyone on an older iOS than that.
if (typeof Object.hasOwn !== 'function') {
  INSTALLED_POLYFILLS.push('Object.hasOwn')
  Object.defineProperty(Object, 'hasOwn', {
    value: (target: object, key: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(target, key),
    configurable: true,
    writable: true,
  })
}

if (typeof globalThis.structuredClone !== 'function') {
  INSTALLED_POLYFILLS.push('structuredClone')
  // Not a faithful structuredClone — no cycles, no transferables — but pdf.js
  // uses it for plain parameter objects, which this handles.
  globalThis.structuredClone = ((value: unknown) =>
    value === undefined ? undefined : JSON.parse(JSON.stringify(value))) as typeof structuredClone
}
