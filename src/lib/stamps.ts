/**
 * Compliance stamps: a short code burned into the redaction box itself.
 *
 * A black rectangle says something was removed but not under what authority.
 * Disclosure regimes generally expect the withheld area to carry its own
 * justification — a FOIA release marks each redaction with the exemption
 * claimed, and a privilege log is read against the page it describes. Putting
 * the code inside the box keeps that pairing intact through printing,
 * photocopying and re-scanning, which a separate cover sheet does not survive.
 *
 * These are labels, not legal advice: the user picks the code that applies.
 */
export interface StampPreset {
  id: string
  /** What the selector shows. */
  label: string
  /** What is drawn on the box. Empty means no stamp. */
  text: string
}

export const STAMP_PRESETS: readonly StampPreset[] = [
  { id: 'none', label: 'No stamp', text: '' },
  { id: 'confidential', label: 'CONFIDENTIAL', text: 'CONFIDENTIAL' },
  { id: 'pii', label: 'PII REDACTED', text: 'PII REDACTED' },
  { id: 'privacy-act', label: 'PRIVACY ACT', text: 'PRIVACY ACT' },
  { id: 'foia', label: 'FOIA EXEMPTION', text: 'FOIA EXEMPTION' },
  { id: 'custom', label: 'Custom…', text: '' },
]

export const CUSTOM_STAMP_ID = 'custom'
export const NO_STAMP_ID = 'none'

/** Longer than this cannot be read inside a box the size of a phone number. */
export const MAX_STAMP_LENGTH = 40

export interface StampSelection {
  id: string
  /** Only meaningful for the custom preset; presets carry their own text. */
  customText: string
}

export const NO_STAMP: StampSelection = { id: NO_STAMP_ID, customText: '' }

/** The text a new box should carry, or '' for an unstamped box. */
export function stampTextFor(selection: StampSelection): string {
  if (selection.id === CUSTOM_STAMP_ID) {
    return selection.customText.trim().slice(0, MAX_STAMP_LENGTH)
  }
  return STAMP_PRESETS.find((preset) => preset.id === selection.id)?.text ?? ''
}
