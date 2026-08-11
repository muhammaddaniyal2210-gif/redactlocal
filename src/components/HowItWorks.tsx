import { FileUp, SquareDashedMousePointer, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    icon: FileUp,
    title: 'Select Document',
    body: 'Drop the PDF in, or pick it from your device. It is read into this tab and goes nowhere else.',
  },
  {
    icon: SquareDashedMousePointer,
    title: 'Draw Blackout Rectangles',
    body: 'Drag over anything sensitive — with a mouse or a finger — on any page, at any zoom level.',
  },
  {
    icon: ShieldCheck,
    title: 'Download Flattened PDF',
    body: 'Every page becomes an image with the boxes burned in, so the text underneath is gone, not covered.',
  },
]

/** The three-step explanation, shared by every landing route. */
export function HowItWorks({ documentType }: { documentType: string }) {
  return (
    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-xl font-semibold tracking-tight sm:text-2xl">
        How to redact a {documentType} in three steps
      </h2>

      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, index) => (
          <li
            key={title}
            className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                <Icon className="size-4.5" />
              </span>
              <span className="text-sm font-semibold text-slate-500 tabular-nums">
                Step {index + 1}
              </span>
            </div>
            <h3 className="mt-3.5 font-medium text-slate-100">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>

            {/* Connector between cards, on wide screens only. */}
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute -right-2.5 top-1/2 hidden size-1.5 -translate-y-1/2 rotate-45 border-r border-t border-slate-700 sm:block"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
