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
  'Black out sensitive parts of a PDF in your browser. Nothing is uploaded — the file is read into the tab, flattened to images on export, and the text underneath is destroyed.'

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
  const ogTitle = `${SITE_NAME} — 100% local PDF redaction`

  return {
    title: `${SITE_NAME} — Redact PDFs in your browser, with zero uploads`,
    description: HOME_DESCRIPTION,
    canonical,
    og: {
      'og:type': 'website',
      'og:site_name': SITE_NAME,
      'og:title': ogTitle,
      'og:description': HOME_DESCRIPTION,
      'og:url': canonical,
      'og:locale': 'en_US',
    },
    twitter: {
      'twitter:card': 'summary',
      'twitter:title': ogTitle,
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

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
