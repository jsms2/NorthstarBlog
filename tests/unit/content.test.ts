import { describe, it, expect } from 'vitest'
import { contentMetrics, renderMarkdown } from '../../server/utils/content'

describe('content pipeline', () => {
  it('computes readable metrics', () => {
    expect(contentMetrics('你好 world').wordCount).toBe(3)
  })

  it('renders complex Markdown consistently', async () => {
    const markdown = [
      '# 标题',
      '',
      '| 左 | 右 |',
      '| :--- | ---: |',
      '| A | B |',
      '',
      '- [x] 已完成',
      '- [ ] 待完成',
      '',
      '行内公式 $E = mc^2$。',
      '',
      '$$',
      'x^2 + y^2 = z^2',
      '$$',
      '',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
      '```ts',
      'const answer = 42',
      '```',
    ].join('\n')
    const html = await renderMarkdown(markdown)
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('align="right"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('class="math-inline"')
    expect(html).toContain('class="math-block"')
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('language-ts')
  })

  it('removes dangerous scripts and event handlers', async () => {
    const html = await renderMarkdown('# Safe\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>')
    expect(html).toContain('<h1>Safe</h1>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('onerror')
  })
})
