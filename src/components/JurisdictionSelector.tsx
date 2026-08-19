import { ChevronDown, Scale } from 'lucide-react'
import { JURISDICTION_PRESETS, presetById } from '../lib/jurisdictions'

interface JurisdictionSelectorProps {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

/**
 * Picks a regulatory preset, which sets what Auto-Detect looks for and how
 * much of each value it covers.
 *
 * A native `<select>`, for the same reasons the stamp selector is one: this
 * toolbar already wraps to three rows on a laptop with the sidebar open, and a
 * custom popover here would have to be positioned against it. The platform
 * control opens as a sheet on a phone and cannot be pushed off-screen.
 *
 * The width is capped and the label allowed to ellipsis. The option text is
 * long on purpose — "Mask First 8 Digits, Keep Last 4" is the whole point of
 * the India entry and belongs where the choice is made — but a select sizes
 * itself to its widest option, and at full width this one pushed the toolbar
 * past the edge of a phone. The full string stays available as the title.
 */
export function JurisdictionSelector({
  value,
  onChange,
  disabled = false,
}: JurisdictionSelectorProps) {
  const active = presetById(value)

  return (
    <div className="relative">
      <Scale className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      <select
        id="jurisdiction-preset"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Regulatory compliance preset"
        title={active ? `${active.label} — ${active.hint}` : 'Regulatory compliance preset'}
        className="min-h-11 w-full max-w-[13.5rem] truncate appearance-none rounded-xl border border-slate-700/60 bg-slate-800/40 py-2 pl-8 pr-7 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-9 lg:max-w-[15rem]"
      >
        {JURISDICTION_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-100">
            {preset.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
    </div>
  )
}
