import { ShieldCheck } from 'lucide-react'
import { CUSTOM_PRESET_ID, presetById } from '../lib/jurisdictions'

interface ArmedPresetNoticeProps {
  /** Currently armed preset id. */
  preset: string
  /** True only when this visit arrived carrying a `?preset=`. */
  enteredWithPreset: boolean
}

/**
 * Confirms the rule a campaign link pre-selected, and nothing more.
 *
 * Deliberately invisible to organic traffic. The landing page has to read as
 * a general-purpose redactor, and a permanent rack of regional presets makes
 * a universal tool look like it handles three regulations and nothing else.
 * Someone arriving from the Aadhaar article, on the other hand, has already
 * been promised a specific behaviour and needs to see that it took effect.
 *
 * Gated on how the visit began, not on whether a preset happens to be
 * selected. Those are different questions: a preset can end up selected
 * through the toolbar during an ordinary session, and that is no reason to
 * start showing campaign furniture on the landing page afterwards.
 */
export function ArmedPresetNotice({ preset, enteredWithPreset }: ArmedPresetNoticeProps) {
  if (!enteredWithPreset || preset === CUSTOM_PRESET_ID) return null

  const active = presetById(preset)
  if (!active?.banner) return null

  const { flag, region, rule } = active.banner

  return (
    <div className="mx-auto mb-5 flex w-full max-w-2xl justify-center">
      <p
        className="flex min-w-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs text-emerald-200"
        title={active.hint}
      >
        <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
        <span aria-hidden="true" className="shrink-0">
          {flag}
        </span>
        <span className="min-w-0 truncate">
          <span className="font-semibold">{region}</span>
          {/* The rule is useful but not essential, and a phone has no room
              for it inside a single-line pill. */}
          <span className="hidden sm:inline"> {rule}</span>
          <span className="text-emerald-300/80"> preset armed</span>
        </span>
      </p>
    </div>
  )
}
