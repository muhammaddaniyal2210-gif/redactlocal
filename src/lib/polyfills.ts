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

  // TC39 "upsert" proposal. Chromium shipped it very recently; most Android
  // browsers, Safari and Firefox have not.
  interface Map<K, V> {
    getOrInsert?(key: K, value: V): V
    getOrInsertComputed?(key: K, callback: (key: K) => V): V
  }
  interface WeakMap<K extends WeakKey, V> {
    getOrInsert?(key: K, value: V): V
    getOrInsertComputed?(key: K, callback: (key: K) => V): V
  }
}

/**
 * Which polyfills this engine actually needed. Recorded at patch time because
 * once installed, feature detection can no longer tell you what was missing —
 * and "what was missing" is the single most useful fact when diagnosing a
 * browser you cannot reproduce on.
 */
export const INSTALLED_POLYFILLS: string[] = []

/**
 * `Map`/`WeakMap` upsert helpers, used 16 times in pdf.js's main bundle and 15
 * times in its worker. They come from the TC39 upsert proposal, which only very
 * recent Chromium ships — an Android browser one release behind throws
 * "this[#t].getOrInsertComputed is not a function" the instant a PDF is parsed.
 *
 * Both are defined non-enumerably, matching how the engine would install them,
 * so nothing that walks these prototypes sees a surprise own-property.
 */
function installUpsert(target: object, label: string) {
  const proto = target as {
    getOrInsert?: unknown
    getOrInsertComputed?: unknown
    get(key: unknown): unknown
    set(key: unknown, value: unknown): unknown
    has(key: unknown): boolean
  }

  const define = (name: string, value: (this: typeof proto, ...args: never[]) => unknown) => {
    Object.defineProperty(proto, name, { value, writable: true, configurable: true })
  }

  if (typeof proto.getOrInsert !== 'function') {
    INSTALLED_POLYFILLS.push(`${label}.getOrInsert`)
    define('getOrInsert', function (this: typeof proto, key: never, value: never) {
      if (this.has(key)) return this.get(key)
      this.set(key, value)
      return value
    })
  }

  if (typeof proto.getOrInsertComputed !== 'function') {
    INSTALLED_POLYFILLS.push(`${label}.getOrInsertComputed`)
    define(
      'getOrInsertComputed',
      function (this: typeof proto, key: never, callback: (key: never) => unknown) {
        if (this.has(key)) return this.get(key)
        if (typeof callback !== 'function') {
          throw new TypeError('getOrInsertComputed: callback is not a function')
        }
        // Per spec the callback receives the key, and the map is re-checked
        // afterwards because the callback may have inserted it itself.
        const computed = callback(key)
        if (this.has(key)) return this.get(key)
        this.set(key, computed)
        return computed
      },
    )
  }
}

installUpsert(Map.prototype, 'Map')
installUpsert(WeakMap.prototype, 'WeakMap')

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
