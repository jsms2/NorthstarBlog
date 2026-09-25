import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../lib/editor-markdown'
import { renderMarkdown } from '../../server/utils/content'

describe('visual editor Markdown conversion', () => {
  it('preserves underscores inside strong text', () => {
    expect(htmlToMarkdown('<p>111<strong>1111_1111111_1111</strong>111111</p>'))
      .toBe('111**1111_1111111_1111**111111')
  })

  it('preserves underline and strikethrough after rendering', async () => {
    const markdown = htmlToMarkdown('<p><u>下划线</u> <s>删除线</s></p>')
    expect(markdown).toContain('<u>下划线</u>')
    expect(markdown).toContain('~~删除线~~')
    const html = await renderMarkdown(markdown)
    expect(html).toContain('<u>下划线</u>')
    expect(html).toContain('<del>删除线</del>')
  })

  it('uses asterisks for italic text inside a word', async () => {
    const markdown = htmlToMarkdown('<p>111<em>斜体</em>111</p>')
    expect(markdown).toBe('111*斜体*111')
    expect(await renderMarkdown(markdown)).toContain('<em>斜体</em>')
  })

  it('converts a visual table to a GFM table without losing cells or inline formatting', async () => {
    const markdown = htmlToMarkdown(
      '<table><tbody><tr><th><p>姓名</p></th><th><p>分数</p></th></tr>'
      + '<tr><td><p>甲|乙</p></td><td><p><em>90</em></p></td></tr></tbody></table>',
    )
    expect(markdown).toContain('| 姓名 | 分数 |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| 甲\\|乙 | *90* |')
    const rendered = await renderMarkdown(markdown)
    expect(rendered).toContain('<table>')
    expect(rendered).toContain('甲|乙')
    expect(rendered).toContain('<em>90</em>')
  })

  it('keeps merged tables as HTML rather than flattening their contents', async () => {
    const markdown = htmlToMarkdown(
      '<table><tbody><tr><th colspan="2"><p>标题</p></th></tr>'
      + '<tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>',
    )
    expect(markdown).toContain('<table>')
    expect(markdown).toContain('colspan="2"')
    expect(markdown).toContain('>A<')
    expect(await renderMarkdown(markdown)).toContain('colspan="2"')
  })
})
