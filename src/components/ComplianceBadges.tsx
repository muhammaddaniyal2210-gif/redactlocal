import { Check } from 'lucide-react'
import { JURISDICTION_PRESETS } from '../lib/jurisdictions'

interface ComplianceBadgesProps {
  /** Currently armed preset id. */
  value: string
  /** Selects the preset and hands focus to the drop zone. */
  onSelect: (id: string) => void
}

/**
 * The regulations the scanner knows, shown before a file exists.
 *
 * Someone arriving with an Aadhaar card cannot tell from a drop zone whether
 * this tool understands their rule, and finding out costs them an upload
 * elsewhere. Naming the three regimes up front answers that, and clicking one
 * arms the scanner so the rule is already set when the file lands.
 *
 * Buttons rather than links: this changes state in a tool that is already
 * open, so a navigation would throw away nothing to gain nothing.
 */
export function ComplianceBadges({ value, onSelect }: ComplianceBadgesProps) {
  const badged = JURISDICTION_PRESETS.filter((p) => p.badge)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-2.5 text-center text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        Built-in compliance presets
      </p>

      {/* Three across at every width. Stacked, these are three 55px cards
          sitting between the headline and the drop zone, which pushes the
          only control that matters off a phone screen. The detail line and
          the tick are dropped below sm to buy that height back; the armed
          rule is then confirmed inside the drop zone, where it is about to
          be used. */}
      <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {badged.map((preset) => {
          const on = preset.id === value
          const { flag, region, detail } = preset.badge!
          return (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => onSelect(preset.id)}
                aria-pressed={on}
                title={preset.hint}
                className={`flex min-h-11 w-full items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:gap-2.5 sm:px-3 sm:py-2.5 ${
                  on
                    ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <span aria-hidden="true" className="shrink-0 text-sm leading-none sm:text-base">
                  {flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-xs font-semibold ${on ? 'text-emerald-200' : 'text-slate-200'}`}
                  >
                    {region}
                  </span>
                  <span className="hidden truncate text-[11px] text-slate-500 sm:block">
                    {detail}
                  </span>
                </span>
                {on && (
                  <Check
                    className="hidden size-3.5 shrink-0 text-emerald-400 sm:block"
                    strokeWidth={3}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
