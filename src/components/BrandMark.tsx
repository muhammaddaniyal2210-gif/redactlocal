interface BrandMarkProps {
  className?: string
}

/**
 * The RedactLocal mark: two lines of text with the middle one blacked out.
 *
 * The redaction bar is the product, so the bar is the logo. Three solid shapes,
 * no strokes and no interior detail — which is what lets the same geometry serve
 * as a 16px favicon without being redrawn.
 *
 * Colours come from utility classes rather than being baked in, so the mark
 * inherits the app's palette. The standalone favicon in `public/favicon.svg`
 * carries the same shapes with literal values and a ground behind them.
 */
export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    // The viewBox is cropped to the artwork rather than to a square canvas. Set
    // on a 48-unit square the mark carries 29% empty width and 45% empty height,
    // which beside the wordmark reads as an undersized icon rather than as
    // breathing room. The square, padded composition is the favicon's job.
    <svg
      viewBox="7 11.5 34 26.6"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="7" y="11.5" width="26" height="4.6" rx="2.3" className="fill-slate-600" />
      <rect x="7" y="20.2" width="34" height="9.2" rx="2.6" className="fill-emerald-400" />
      <rect x="7" y="33.5" width="19" height="4.6" rx="2.3" className="fill-slate-600" />
    </svg>
  )
}
