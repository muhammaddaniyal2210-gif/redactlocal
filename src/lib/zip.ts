/**
 * A minimal, store-only ZIP writer.
 *
 * Bundling the batch into one archive is what keeps a multi-file export to a
 * single save dialog, and browsers throttle or block a burst of programmatic
 * downloads anyway. This is written by hand rather than pulled from npm for the
 * same reason everything else here is: a dependency is another thing that could
 * decide to phone home, and the format's stored (uncompressed) profile is a few
 * dozen lines. PDFs already carry compressed streams, so deflating them again
 * would buy almost nothing for a lot more code.
 *
 * Everything below runs on bytes already in this tab's memory. Nothing is read
 * from or written to the network.
 */

/** Standard CRC-32 (polynomial 0xEDB88320), which ZIP requires per entry. */
const CRC_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  bytes: Uint8Array
}

const LOCAL_HEADER = 30
const CENTRAL_HEADER = 46
const END_OF_CENTRAL_DIRECTORY = 22

/**
 * A fixed 1980-01-01 timestamp on every entry.
 *
 * ZIP stores modification times in the writer's *local* time with no zone, so
 * writing the real clock would stamp the user's timezone — and roughly their
 * working hours — onto a file they are redacting for privacy. The exported PDFs
 * already pin their CreationDate to a constant for exactly this reason; the
 * archive around them must not undo it.
 */
const DOS_TIME = 0
const DOS_DATE = 0x0021

/** Marks entry names as UTF-8 (general purpose bit 11) rather than CP437. */
const UTF8_FLAG = 0x0800

/**
 * Build a ZIP archive from in-memory entries.
 *
 * Entry names are assumed to be unique — `uniqueName` upstream is what
 * guarantees it, since a duplicate name in an archive is legal but produces a
 * file that unzips unpredictably.
 */
export function createZip(entries: readonly ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const prepared = entries.map((entry) => {
    const name = encoder.encode(entry.name)
    return { name, bytes: entry.bytes, crc: crc32(entry.bytes) }
  })

  const localSize = prepared.reduce((n, e) => n + LOCAL_HEADER + e.name.length + e.bytes.length, 0)
  const centralSize = prepared.reduce((n, e) => n + CENTRAL_HEADER + e.name.length, 0)

  const out = new Uint8Array(localSize + centralSize + END_OF_CENTRAL_DIRECTORY)
  const view = new DataView(out.buffer)
  let offset = 0

  const u16 = (value: number) => {
    view.setUint16(offset, value, true)
    offset += 2
  }
  const u32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true)
    offset += 4
  }
  const raw = (value: Uint8Array) => {
    out.set(value, offset)
    offset += value.length
  }

  // Local file headers, each immediately followed by its (stored) data.
  const localOffsets: number[] = []
  for (const entry of prepared) {
    localOffsets.push(offset)
    u32(0x04034b50)
    u16(20) // version needed
    u16(UTF8_FLAG)
    u16(0) // method 0 — stored
    u16(DOS_TIME)
    u16(DOS_DATE)
    u32(entry.crc)
    u32(entry.bytes.length) // compressed size == uncompressed size when stored
    u32(entry.bytes.length)
    u16(entry.name.length)
    u16(0) // extra field length
    raw(entry.name)
    raw(entry.bytes)
  }

  const centralStart = offset
  prepared.forEach((entry, index) => {
    u32(0x02014b50)
    u16(20) // version made by
    u16(20) // version needed
    u16(UTF8_FLAG)
    u16(0)
    u16(DOS_TIME)
    u16(DOS_DATE)
    u32(entry.crc)
    u32(entry.bytes.length)
    u32(entry.bytes.length)
    u16(entry.name.length)
    u16(0) // extra
    u16(0) // comment
    u16(0) // disk number start
    u16(0) // internal attributes
    u32(0) // external attributes
    u32(localOffsets[index])
    raw(entry.name)
  })

  // Captured before the end record is written: `offset` advances as each field
  // goes down, so reading it mid-record would overstate the directory's size by
  // however much of the record had already been emitted.
  const centralSizeWritten = offset - centralStart

  u32(0x06054b50)
  u16(0) // this disk
  u16(0) // disk with central directory
  u16(prepared.length)
  u16(prepared.length)
  u32(centralSizeWritten)
  u32(centralStart)
  u16(0) // comment length

  return new Blob([out], { type: 'application/zip' })
}

/** Strip anything an OS or archive tool would object to in a file name. */
export function sanitizeFileName(name: string): string {
  // Path separators, the Windows-reserved set and control characters. Spaces
  // and hyphens are deliberately left alone: both are legal everywhere, and
  // mangling them makes the download harder to match back to its source file.
  const cleaned = name
    .replace(/\.pdf$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'document'
}

/** Give `name` a numeric suffix until it is not already in `taken`. */
export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${extension}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}
