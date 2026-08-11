import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { RedactorWorkspace } from './RedactorWorkspace'
import { HowItWorks } from './HowItWorks'
import { useDocumentHead } from '../hooks/useDocumentHead'
import { buildHeadTags } from '../lib/seo'
import { LANDINGS, type FAQItem, type LandingConfig } from '../content/landings'

type DocumentRedactorLandingProps = LandingConfig

/**
 * One template, five routes. It renders the real editor at the top and the
 * route's own copy underneath — the search-intent wrapper around a tool that is
 * byte-for-byte the same on every page.
 */
export function DocumentRedactorLanding({
  slug,
  documentType,
  H1Title,
  metaDescription,
  intro,
  targetedFAQ,
}: DocumentRedactorLandingProps) {
  const head = useMemo(
    () => buildHeadTags({ slug, documentType, H1Title, metaDescription, intro, targetedFAQ }),
    [slug, documentType, H1Title, metaDescription, intro, targetedFAQ],
  )
  useDocumentHead(head)

  const siblings = LANDINGS.filter((l) => l.slug !== slug)

  return (
    <>
      <RedactorWorkspace
        heading={H1Title}
        subheading={intro}
        editorHeightClass="h-[72vh] min-h-[30rem]"
      />

      <div className="mt-14 space-y-14 pb-6">
        <HowItWorks documentType={documentType} />
        <FAQ documentType={documentType} items={targetedFAQ} />

        <section aria-labelledby="other-documents">
          <h2 id="other-documents" className="text-xl font-semibold tracking-tight sm:text-2xl">
            Redacting something else?
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  to={`/${sibling.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-700 hover:text-slate-100"
                >
                  <span className="min-w-0 flex-1">{sibling.H1Title}</span>
                  <ArrowRight className="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function FAQ({ documentType, items }: { documentType: string; items: FAQItem[] }) {
  return (
    <section aria-labelledby="faq">
      <h2 id="faq" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {titleCase(documentType)} redaction: common questions
      </h2>

      <dl className="mt-6 space-y-4">
        {items.map((item) => (
          <div
            key={item.question}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <dt className="font-medium text-slate-100">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-400">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
