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
  },
  {
    id: 'us-frcp',
    label: '🇺🇸 Federal Courts (FRCP 5.2 - SSN, Tax ID Full Mask)',
    hint: 'Finds social security and taxpayer ID numbers, covered in full.',
    caveat:
      'Rule 5.2(a) lists five categories. Birth dates, minors’ names, and financial account numbers are not covered by this preset and need a manual pass. The rule also asks for partial redaction — last four digits of an SSN, birth year — which this preset does not attempt.',
    categories: ['ssns', 'ein'],
  },
  {
    id: 'eu-gdpr',
    label: '🌐 GDPR / General PII (Emails, Phones)',
    hint: 'Finds email addresses and phone numbers, covered in full.',
    caveat:
      'Direct contact details only. Names, addresses, and anything identifying someone in combination are not pattern-detectable and remain your judgement.',
    categories: ['emails', 'phones'],
  },
]

const BY_ID = new Map(JURISDICTION_PRESETS.map((p) => [p.id, p]))

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
