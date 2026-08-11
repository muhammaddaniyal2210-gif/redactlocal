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

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(({ tags }) => `  <url><loc>${tags.canonical}</loc></url>`),
  '</urlset>',
].join('\n')
await writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8')

await writeFile(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  'utf8',
)

console.log(`prerendered ${routes.length} routes → ${routes.map((r) => r.dir).join(', ')}`)
console.log(`sitemap.xml and robots.txt written for ${SITE_URL}`)
