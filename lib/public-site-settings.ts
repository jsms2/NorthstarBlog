import sanitizeHtml from 'sanitize-html'

export function sanitizeLayoutHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  return sanitizeHtml(value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'div', 'section', 'figure', 'figcaption', 'u', 's', 'del']),
    allowedAttributes: {
      a: ['href', 'target', 'title', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
      th: ['align', 'colspan', 'rowspan'],
      td: ['align', 'colspan', 'rowspan'],
      '*': ['id', 'class', 'aria-label'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto'], img: ['http', 'https'] },
    transformTags: {
      a: (tagName, attributes) => ({
        tagName,
        attribs: attributes.target === '_blank'
          ? { ...attributes, rel: 'noopener noreferrer' }
          : attributes,
      }),
    },
  })
}

export function safeStyleText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<\/style/gi, '<\\/style') : ''
}

export function normalizeSiteUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    url.search = ''
    url.hash = ''
    return url.href.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function resolveSiteUrl(configured: unknown, environment: unknown, requestOrigin: string): string {
  return normalizeSiteUrl(configured) || normalizeSiteUrl(environment) || requestOrigin
}

export function resolvePublicSiteSettings(values: Record<string, unknown>, environment: unknown, requestOrigin: string) {
  return {
    headerHtml: sanitizeLayoutHtml(values.headerHtml),
    footerHtml: sanitizeLayoutHtml(values.footerHtml),
    customCss: safeStyleText(values.customCss),
    siteUrl: resolveSiteUrl(values.siteUrl, environment, requestOrigin),
  }
}
