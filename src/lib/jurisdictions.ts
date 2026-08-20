import { SWEEP_CATEGORIES, type SweepCategoryId } from './detect'

/**
 * Regulatory presets: a named regime mapped onto the patterns this app can
 * actually detect.
 *
 * A preset is a starting point, not a compliance certificate. Each one turns
 * on the categories that carry the weight of the rule it names and says, in
 * `caveat`, what the rule additionally requires that no pattern can find. That
 * honesty is the point — a selector that implied "FRCP 5.2, handled" would be
 * the most dangerous control in the product.
 *
 * Adding a region is a matter of appending an entry here: nothing downstream
 * knows the ids, and the UI renders whatever this array holds.
 */
export interface JurisdictionPreset {
  id: string
  /** Shown in the dropdown. */
  label: string
  /** One line on what the preset switches on, shown under the control. */
  hint: string
  /**
   * What the named rule also demands that pattern matching cannot supply.
   * Null only for the manual option, which promises nothing.
   */
  caveat: string | null
  /**
   * Categories to switch on, replacing the current selection. `null` means
   * "leave the ticks alone", which is what Custom is.
   */
  categories: readonly SweepCategoryId[] | null
  /**
   * Copy for the armed-preset banner, shown only when this preset arrived in
   * the URL. Omitted where there is nothing to announce — Custom is the
   * default state, not a rule someone chose.
   */
  banner?: { flag: string; region: string; rule: string }
}

export const CUSTOM_PRESET_ID = 'custom'

export const JURISDICTION_PRESETS: readonly JurisdictionPreset[] = [
  {
    id: CUSTOM_PRESET_ID,
    label: 'Custom / Manual Search',
    hint: 'Your own selection of patterns, unchanged.',
    caveat: null,
    categories: null,
  },
  {
    id: 'in-uidai',
    label: '🇮🇳 UIDAI / RBI Aadhaar (Mask First 8 Digits, Keep Last 4)',
    hint: 'Finds 12-digit Aadhaar numbers and covers only the first 8.',
    caveat:
      'Aadhaar only. Names, photographs, and the QR code on an Aadhaar letter carry the same identity and are not detected — check the page by eye.',
    // Deliberately Aadhaar alone. With the broader categories left on, the
    // phone and account patterns also match a bare 12-digit number and cover
    // it end to end, which would quietly undo the partial mask this preset
    // exists to produce.
    categories: ['aadhaar'],
    banner: { flag: '🇮🇳', region: 'India', rule: 'UIDAI Aadhaar masking' },
  },
  {
    id: 'us-frcp',
    label: '🇺🇸 Federal Courts (FRCP 5.2 - SSN, Tax ID Full Mask)',
    hint: 'Finds social security and taxpayer ID numbers, covered in full.',
    caveat:
      'Rule 5.2(a) lists five categories. Birth dates, minors’ names, and financial account numbers are not covered by this preset and need a manual pass. The rule also asks for partial redaction — last four digits of an SSN, birth year — which this preset does not attempt.',
    categories: ['ssns', 'ein'],
    banner: { flag: '🇺🇸', region: 'US', rule: 'FRCP 5.2 redaction' },
  },
  {
    id: 'eu-gdpr',
    label: '🌐 GDPR / General PII (Emails, Phones)',
    hint: 'Finds email addresses and phone numbers, covered in full.',
    caveat:
      'Direct contact details only. Names, addresses, and anything identifying someone in combination are not pattern-detectable and remain your judgement.',
    categories: ['emails', 'phones'],
    banner: { flag: '🌐', region: 'Global', rule: 'GDPR & general PII' },
  },
  {
    id: 'us-hipaa',
    label: '🏥 US Healthcare: HIPAA (NPIs & Provider IDs)',
    hint: 'Finds checksum-valid NPIs and labelled medical record numbers.',
    caveat:
      'Identifiers only. HIPAA also treats names, dates, addresses and other PHI as protected, and those are not pattern-detectable — read the record by eye. Medical record numbers are matched by their label, so an unlabelled one will be missed.',
    categories: ['npi', 'mrn'],
    banner: { flag: '🏥', region: 'US', rule: 'HIPAA identifiers' },
  },
  {
    id: 'pci-dss',
    label: '💳 Global Finance: PCI-DSS (Credit Card PANs)',
    hint: 'Finds 16-digit card numbers that pass the Luhn checksum.',
    caveat:
      'Sixteen-digit PANs only. Amex (15 digits) and Diners are not matched, and PCI-DSS also governs the CVV, expiry and cardholder name, which are not detected — check the page before filing.',
    categories: ['pan'],
    banner: { flag: '💳', region: 'Global', rule: 'PCI-DSS card PANs' },
  },
  {
    id: 'privacy-first',
    label: '🛡️ Privacy-First: Scan for All Identifiers',
    hint: 'Turns on every detection pattern at once for a broad sweep.',
    caveat:
      'A broad sweep flags more, including false positives, so review each match. It finds structured identifiers, not free-text secrets — names, proprietary terms and context still need your eyes.',
    // Every category the scanner knows. Filtered against the live category
    // list at read time, so this stays correct as categories are added.
    categories: ['emails', 'phones', 'ssns', 'ein', 'govIds', 'aadhaar', 'npi', 'mrn', 'pan', 'cards', 'iban', 'accounts'],
    banner: { flag: '🛡️', region: 'Privacy-First', rule: 'all identifiers' },
  },
]

/**
 * Public URL slugs for `?preset=`, kept deliberately separate from the internal
 * ids above.
 *
 * These appear in blog CTAs and in links other people may share, which makes
 * them a published contract: renaming an internal id must never turn somebody's
 * saved link into a silent no-op. Adding an alias here is cheap; changing one
 * is not.
 */
const SLUG_TO_ID: Readonly<Record<string, string>> = {
  'india-aadhaar': 'in-uidai',
  'us-frcp52': 'us-frcp',
  'global-pii': 'eu-gdpr',
  'us-hipaa': 'us-hipaa',
  'pci-dss': 'pci-dss',
  'privacy-first': 'privacy-first',
}

const ID_TO_SLUG = new Map(Object.entries(SLUG_TO_ID).map(([slug, id]) => [id, slug]))

const BY_ID = new Map(JURISDICTION_PRESETS.map((p) => [p.id, p]))

/** The `?preset=` slug for a preset, for building links. */
export function slugForPreset(id: string): string | undefined {
  return ID_TO_SLUG.get(id)
}

/**
 * Read a preset id out of a query string, or null if there isn't a usable one.
 *
 * Accepts the public slug and, for convenience, the internal id. Anything
 * unrecognised returns null rather than throwing: a mistyped link should open
 * the ordinary tool, never an error page. Takes the search string rather than
 * reading `location` itself so it stays callable where there is no DOM.
 */
export function presetFromQuery(search: string): string | null {
  let raw: string | null = null
  try {
    raw = new URLSearchParams(search).get('preset')
  } catch {
    return null
  }
  if (!raw) return null

  const key = raw.trim().toLowerCase()
  const id = SLUG_TO_ID[key] ?? key
  // Custom is the default and selects nothing, so treating it as "no preset"
  // keeps `?preset=custom` from looking like it did something.
  if (!BY_ID.has(id) || id === CUSTOM_PRESET_ID) return null
  return id
}

export function presetById(id: string): JurisdictionPreset | undefined {
  return BY_ID.get(id)
}

/**
 * The categories a preset switches on, or null to keep the current selection.
 *
 * Unknown ids and categories that no longer exist are filtered out rather than
 * throwing: a preset is a convenience, and a stale id should never be able to
 * take the scanner down with it.
 */
export function categoriesForPreset(id: string): Set<SweepCategoryId> | null {
  const preset = BY_ID.get(id)
  if (!preset?.categories) return null
  const known = new Set(SWEEP_CATEGORIES.map((c) => c.id))
  return new Set(preset.categories.filter((c) => known.has(c)))
}
