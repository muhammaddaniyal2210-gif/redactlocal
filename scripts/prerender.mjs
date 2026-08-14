/**
 * Bakes each route's head tags into a static HTML file.
 *
 * The app sets title, meta, canonical and JSON-LD from React at runtime, which
 * is enough for search engines that execute JavaScript. Social scrapers
 * (Slack, Facebook, LinkedIn, X) do not run scripts — they read the HTML as
 * served. This step writes dist/<slug>/index.html with the tags already in the
 * markup, which also means a static host serves these URLs directly without
 * SPA rewrite rules.
 *
 * The page body is still client-rendered; this is head-tag prerendering, not
 * full SSR.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LANDINGS } from '../src/content/landings.ts'
import { buildHeadTags, buildHomeHeadTags, SITE_URL } from '../src/lib/seo.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function headMarkup(tags) {
  const lines = [
    `<title>${escapeHtml(tags.title)}</title>`,
    `<meta name="description" content="${escapeHtml(tags.description)}" />`,
    `<link rel="canonical" href="${tags.canonical}" />`,
    ...Object.entries(tags.og).map(
      ([property, content]) =>
        `<meta property="${property}" content="${escapeHtml(content)}" />`,
    ),
    ...Object.entries(tags.twitter).map(
      ([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`,
    ),
    // JSON-LD is escaped only where it could close the script element early.
    `<script type="application/ld+json">${JSON.stringify(tags.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
  return lines.map((line) => `    ${line}`).join('\n')
}

function render(template, tags) {
  return template
    .replace(/\n?\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\n?\s*<meta\s+name="description"[\s\S]*?\/>/, '')
    .replace('</head>', `${headMarkup(tags)}\n  </head>`)
}

const template = await readFile(path.join(DIST, 'index.html'), 'utf8')

const routes = [
  { dir: '.', tags: buildHomeHeadTags() },
  ...LANDINGS.map((config) => ({ dir: config.slug, tags: buildHeadTags(config) })),
]

for (const { dir, tags } of routes) {
  const outDir = path.join(DIST, dir)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, 'index.html'), render(template, tags), 'utf8')
}

// sitemap.xml and robots.txt are checked-in static files in public/, copied to
// dist by Vite. They are not generated here: writing them from this script
// would silently overwrite the committed versions, so whatever you edited in
// public/ would never reach production.
//
// The trade is that adding a route means adding its <loc> to public/sitemap.xml
// by hand. This check makes that impossible to forget quietly.
const sitemapPath = path.join(DIST, 'sitemap.xml')
const sitemap = await readFile(sitemapPath, 'utf8').catch(() => '')
const missing = routes.map(({ tags }) => tags.canonical).filter((url) => !sitemap.includes(url))

console.log(`prerendered ${routes.length} routes → ${routes.map((r) => r.dir).join(', ')}`)

if (!sitemap) {
  console.warn('warning: dist/sitemap.xml is missing — is public/sitemap.xml present?')
} else if (missing.length) {
  console.warn(`warning: not listed in public/sitemap.xml:\n  ${missing.join('\n  ')}`)
} else {
  console.log(`sitemap.xml lists all ${routes.length} routes for ${SITE_URL}`)
}
