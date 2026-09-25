import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const markdownParser = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = lang?.trim().toLowerCase()
      if (language === 'mermaid')
        return '<pre class="mermaid" data-mermaid="true"><code>' + escapeHtml(text) + '</code></pre>\n'
      if (language === 'math' || language === 'latex' || language === 'tex')
        return '<div class="math-block" data-latex="' + escapeHtml(text) + '">' + escapeHtml(text) + '</div>\n'
      const className = language ? ' class="language-' + escapeHtml(language) + '"' : ''
      return '<pre><code' + className + '>' + escapeHtml(text) + '\n</code></pre>\n'
    },
  },
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start: (src) => src.indexOf('$$'),
      tokenizer(src) {
        const match = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$(?:[ \t]*\n|$)|^\$\$([^\n]+?)\$\$(?:[ \t]*\n|$)/.exec(src)
        if (match) return { type: 'mathBlock', raw: match[0], text: (match[1] || match[2] || '').trim() }
      },
      renderer(token) {
        const text = String(token.text || '')
        return '<div class="math-block" data-latex="' + escapeHtml(text) + '">' + escapeHtml(text) + '</div>\n'
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer(src) {
        const match = /^\$([^\s$\n](?:[^$\n]*?[^\s$\n])?)\$(?!\d)/.exec(src)
        if (match) return { type: 'mathInline', raw: match[0], text: match[1] }
      },
      renderer(token) {
        const text = String(token.text || '')
        return '<span class="math-inline" data-latex="' + escapeHtml(text) + '">' + escapeHtml(text) + '</span>'
      },
    },
  ],
})

export async function renderMarkdown(markdown: string) {
  return sanitizeContentHtml(await markdownParser.parse(markdown))
}

export function sanitizeContentHtml(raw: string) {
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'details', 'summary', 'figure', 'figcaption', 'iframe', 'aside', 'div', 'input', 'u', 's', 'del',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: ['src', 'title', 'allow', 'allowfullscreen', 'sandbox', 'loading'],
      code: ['class'],
      input: ['type', 'checked', 'disabled'],
      th: ['align', 'colspan', 'rowspan'], td: ['align', 'colspan', 'rowspan'],
      a: ['href', 'name', 'target', 'rel', 'class', 'data-content-button', 'data-file-attachment'],
      details: ['open', 'class'],
      '*': ['id', 'class', 'data-callout', 'data-gallery', 'data-mermaid', 'data-math',
        'data-provider', 'data-url', 'data-style', 'data-latex'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'player.bilibili.com'],
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'], a: ['http', 'https', 'mailto'] },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }) },
  })
}

export function contentMetrics(markdown: string) {
  const text = markdown.replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60|[#>*_\x60\-[\]()!]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = (text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) || []).length
  return { wordCount: words, readingMinutes: Math.max(1, Math.ceil(words / 300)), searchText: text }
}
