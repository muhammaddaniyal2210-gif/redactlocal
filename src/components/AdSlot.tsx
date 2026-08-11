/**
 * Reserved space for a display ad.
 *
 * The space is committed by the layout whether or not anything ever fills it,
 * so an ad arriving late cannot push the editor around — the canvas keeps its
 * position and a half-drawn redaction box does not jump under the cursor.
 * The slots are inert placeholders: no ad script is loaded, because fetching
 * one would put a third-party request on a page that promises none.
 */
interface AdSlotProps {
  variant: 'sidebar' | 'post-download'
  className?: string
}

const VARIANTS = {
  // 300 × 250 medium rectangle, only once there is room beside the editor.
  sidebar: {
    box: 'w-[300px] h-[250px] hidden lg:block',
    label: '300 × 250',
  },
  // 728 × 90-style leaderboard under the success state, capped to the column.
  'post-download': {
    box: 'w-full max-w-2xl h-[90px]',
    label: '728 × 90',
  },
} as const

export function AdSlot({ variant, className = '' }: AdSlotProps) {
  const { box, label } = VARIANTS[variant]

  return (
    <div
      className={`adsense-slot-container ${box} ${className}`}
      data-ad-slot={variant}
      aria-hidden="true"
    >
      <span className="adsense-slot-placeholder">
        Ad space
        <span className="adsense-slot-dimensions">{label}</span>
      </span>
    </div>
  )
}
