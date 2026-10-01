import type { FAQItem, LandingConfig } from '../content/landings'

/**
 * Absolute origin used for canonical and OpenGraph URLs. Set VITE_SITE_URL at
 * build time; the fallback only keeps development honest.
 */
const NODE_ENV_URL = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.SITE_URL

export const SITE_URL = (
  import.meta.env?.VITE_SITE_URL ??
  NODE_ENV_URL ??
  'https://redactlocal.org'
).replace(/\/$/, '')

export const SITE_NAME = 'RedactLocal'

export const HOME_DESCRIPTION =
  'Securely redact sensitive documents and PDFs directly in your browser. 100% private, zero uploads, and HIPAA/PCI-DSS/GDPR compliant.'

export interface HeadTags {
  title: string
  description: string
  canonical: string
  og: Record<string, string>
  twitter: Record<string, string>
  jsonLd: object
}

/**
 * `SoftwareApplication` describing what this actually is: a free tool that runs
 * in the browser and needs no server. The FAQ is published as `FAQPage` in the
 * same graph so the questions on the page are the questions search engines see.
 */
export function buildJsonLd(config: LandingConfig, canonical: string): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `${SITE_NAME} — ${titleCase(config.documentType)} Redactor`,
        url: canonical,
        applicationCategory: 'SecurityApplication',
        applicationSubCategory: 'PDF redaction',
        operatingSystem: 'Any — runs in a web browser',
        browserRequirements: 'Requires JavaScript and HTML5 canvas support',
        softwareRequirements: 'No installation, account or server connection required',
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        permissions: 'None. Files are processed in the browser and are never uploaded.',
        featureList: [
          `Redact a ${config.documentType} without uploading it`,
          'Draw black redaction boxes with a mouse or by touch',
          'Flatten every page to an image so the text layer is destroyed',
          'Export a PDF with no selectable text, fonts or annotations',
          'Works with the network disconnected',
        ],
        description: config.metaDescription,
      },
      {
        '@type': 'FAQPage',
        mainEntity: config.targetedFAQ.map((item: FAQItem) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  }
}

export function buildHeadTags(config: LandingConfig): HeadTags {
  const canonical = `${SITE_URL}/${config.slug}`
  const title = `${config.H1Title} | ${SITE_NAME}`

  return {
    title,
    description: config.metaDescription,
    canonical,
    og: {
      'og:type': 'website',
      'og:site_name': SITE_NAME,
      'og:title': config.H1Title,
      'og:description': config.metaDescription,
      'og:url': canonical,
      'og:locale': 'en_US',
    },
    twitter: {
      'twitter:card': 'summary',
      'twitter:title': config.H1Title,
      'twitter:description': config.metaDescription,
    },
    jsonLd: buildJsonLd(config, canonical),
  }
}

/** Head tags for the tool's own home page. Shared with the prerender script. */
export function buildHomeHeadTags(): HeadTags {
  const canonical = `${SITE_URL}/`
  // One title across the tab, the search result and the social card, so the
  // branding is identical wherever the page surfaces.
  const title = 'Redact PDFs and Sensitive Documents Locally | RedactLocal'

  return {
    title,
    description: HOME_DESCRIPTION,
    canonical,
    og: {
      'og:type': 'website',
      'og:site_name': SITE_NAME,
      'og:title': title,
      'og:description': HOME_DESCRIPTION,
      'og:url': canonical,
      'og:locale': 'en_US',
    },
    twitter: {
      'twitter:card': 'summary',
      'twitter:title': title,
      'twitter:description': HOME_DESCRIPTION,
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      url: canonical,
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any — runs in a web browser',
      browserRequirements: 'Requires JavaScript and HTML5 canvas support',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      permissions: 'None. Files are processed in the browser and are never uploaded.',
      description: HOME_DESCRIPTION,
    },
  }
}

/**
 * The Leak Checker (/check). Targets the high-intent, lower-competition query a
 * new site can actually rank for — "is my PDF really redacted", "recover text
 * under a black box" — rather than the Adobe-owned head term "redact a PDF".
 */
export function buildCheckHeadTags(): HeadTags {
  const canonical = `${SITE_URL}/check`
  const title = 'Redaction Checker: Is Your PDF Really Redacted?'
  const description =
    'Free, 100% in-browser tool. Drop a PDF and instantly see if “redacted” text is still recoverable under the black boxes — nothing is uploaded, nothing leaves your device.'

  return {
    title,
    description,
    canonical,
    og: {
      'og:type': 'website',
      'og:site_name': SITE_NAME,
      'og:title': 'Is Your PDF Really Redacted? Free In-Browser Checker',
      'og:description': description,
      'og:url': canonical,
      'og:locale': 'en_US',
      'og:image': `${SITE_URL}/check-og.jpg`,
      'og:image:width': '1600',
      'og:image:height': '957',
      'og:image:alt': 'A document whose “redacted” account number is still readable through the black box',
    },
    twitter: {
      'twitter:card': 'summary_large_image',
      'twitter:title': 'Is Your PDF Really Redacted? Free In-Browser Checker',
      'twitter:description': description,
      'twitter:image': `${SITE_URL}/check-og.jpg`,
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RedactLocal Redaction Leak Checker',
      url: canonical,
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any — runs in a web browser',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      permissions: 'None. The PDF is read in the browser and is never uploaded.',
      description,
    },
  }
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
