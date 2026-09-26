import { describe, expect, it } from 'vitest'
import { normalizeSiteUrl, resolvePublicSiteSettings, resolveSiteUrl, safeStyleText, sanitizeLayoutHtml } from '../../lib/public-site-settings'

describe('public site settings', () => {
  it('preserves a footer filing link and secures new tabs', () => {
    const html = sanitizeLayoutHtml('<a href="https://beian.miit.gov.cn/" target="_blank">京ICP备2026049886号-4</a>')
    expect(html).toContain('href="https://beian.miit.gov.cn/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('京ICP备2026049886号-4')
  })

  it('removes active HTML and unsafe links from header and footer content', () => {
    const html = sanitizeLayoutHtml('<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">Bad</a><img src="x" onerror="alert(1)">')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
  })

  it('retains safe structured markup in custom layout HTML', () => {
    const html = sanitizeLayoutHtml('<section><h2>说明</h2><table><tr><td>内容</td></tr></table></section>')
    expect(html).toContain('<h2>说明</h2>')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>内容</td>')
  })

  it('keeps CSS but prevents an HTML style element breakout', () => {
    expect(safeStyleText('a { color: red }')).toBe('a { color: red }')
    expect(safeStyleText('</style><script>')).not.toContain('</style>')
  })

  it('uses the configured site URL before the environment and request origin', () => {
    expect(normalizeSiteUrl('https://example.com/blog/?q=1#top')).toBe('https://example.com/blog')
    expect(resolveSiteUrl('https://example.com/', 'https://old.example/', 'http://localhost:3000')).toBe('https://example.com')
    expect(resolveSiteUrl('javascript:alert(1)', 'https://old.example/', 'http://localhost:3000')).toBe('https://old.example')
    expect(normalizeSiteUrl('https://user:pass@example.com')).toBe('')
  })

  it('maps saved global settings into the public layout payload', () => {
    const settings = resolvePublicSiteSettings({
      headerHtml: '<p>Header</p>',
      footerHtml: '<a href="https://beian.miit.gov.cn/">备案</a>',
      customCss: '.custom { color: red }',
      siteUrl: 'https://blog.example.com/',
    }, 'https://fallback.example.com', 'http://localhost:3000')
    expect(settings).toMatchObject({
      headerHtml: '<p>Header</p>',
      customCss: '.custom { color: red }',
      siteUrl: 'https://blog.example.com',
    })
    expect(settings.footerHtml).toContain('备案</a>')
  })
})
