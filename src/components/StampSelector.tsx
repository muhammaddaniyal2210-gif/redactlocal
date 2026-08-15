import { ChevronDown, Stamp } from 'lucide-react'
import {
  CUSTOM_STAMP_ID,
  MAX_STAMP_LENGTH,
  STAMP_PRESETS,
  type StampSelection,
} from '../lib/stamps'

interface StampSelectorProps {
  value: StampSelection
  onChange: (next: StampSelection) => void
  disabled?: boolean
}

/**
 * Picks the compliance code stamped onto new redactions.
 *
 * A native `<select>` on purpose. A custom popover here would have to be
 * positioned against a toolbar that already wraps to three rows on a laptop
 * with the sidebar open — the previous one in this app ended up 73px off-screen
 * on a phone. The platform control opens as a sheet on mobile, takes keyboard
 * and screen-reader behaviour for free, and cannot be pushed anywhere wrong.
 */
export function StampSelector({ value, onChange, disabled = false }: StampSelectorProps) {
  const custom = value.id === CUSTOM_STAMP_ID

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Stamp className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <select
          value={value.id}
          onChange={(e) => onChange({ ...value, id: e.target.value })}
          disabled={disabled}
          aria-label="Compliance stamp for new redactions"
          title="Text burned into each new redaction box"
          className="min-h-11 appearance-none rounded-xl border border-slate-700/60 bg-slate-800/40 py-2 pl-8 pr-7 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-9"
        >
          {STAMP_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-100">
              {preset.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
      </div>

      {custom && (
        <input
          type="text"
          value={value.customText}
          maxLength={MAX_STAMP_LENGTH}
          onChange={(e) => onChange({ ...value, customText: e.target.value })}
          placeholder="Your code"
          aria-label="Custom stamp text"
          className="min-h-11 w-32 rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 transition-colors duration-150 focus:border-emerald-500/60 focus:outline-none disabled:opacity-40 lg:min-h-9"
          disabled={disabled}
        />
      )}
    </div>
  )
}
