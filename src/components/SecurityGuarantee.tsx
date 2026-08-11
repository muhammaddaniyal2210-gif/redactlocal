import { ShieldCheck } from 'lucide-react'

/**
 * The security claim, stated plainly under the drop zone.
 *
 * Deliberately quiet: a hard sell here reads as marketing, and this section is
 * doing the opposite job — it has to be the part of the page a sceptical
 * reader believes.
 */
export function SecurityGuarantee() {
  return (
    <section
      aria-labelledby="security-guarantee"
      className="relative mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6"
    >
      {/* A single soft emerald wash, anchored to the icon. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center self-start rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
          <ShieldCheck className="size-5" strokeWidth={2.1} />
        </span>

        <div className="min-w-0">
          <h2
            id="security-guarantee"
            className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg"
          >
            Security Guarantee
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-[0.9375rem]">
            Most tools just hide your text visually. RedactLocal permanently destroys the text
            underneath. Processing is 100% offline in your browser, and zero text layers survive
            the export. Your data never leaves this device.
          </p>
        </div>
      </div>
    </section>
  )
}
