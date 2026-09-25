import TurndownService from 'turndown'

export function htmlToMarkdown(html: string) {
  const service = new TurndownService({
    codeBlockStyle: 'fenced',
    headingStyle: 'atx',
    emDelimiter: '*',
  })
  const originalEscape = service.escape.bind(service)
  service.escape = (text) => originalEscape(text)
    .replace(/(?<=[\p{L}\p{N}])\\_(?=[\p{L}\p{N}])/gu, '_')
  service.addRule('underline', {
    filter: 'u',
    replacement: (_content, node) => (node as HTMLElement).outerHTML,
  })
  service.addRule('strikethrough', {
    filter: (node) => ['S', 'STRIKE', 'DEL'].includes(node.nodeName),
    replacement: (content) => '~~' + content + '~~',
  })
  service.addRule('gfmTable', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = node as HTMLTableElement
      const rows = Array.from(table.querySelectorAll('tr'))
      const cells = rows.map((row) =>
        Array.from(row.children).filter((child) => /^(TH|TD)$/.test(child.nodeName)) as HTMLTableCellElement[],
      )
      const width = cells[0]?.length || 0
      const simple = width > 0
        && cells.every((row) => row.length === width)
        && cells[0]!.every((cell) => cell.nodeName === 'TH')
        && cells.slice(1).every((row) => row.every((cell) => cell.nodeName === 'TD'))
        && cells.flat().every((cell) =>
          (!cell.colSpan || cell.colSpan === 1)
          && (!cell.rowSpan || cell.rowSpan === 1)
          && !cell.querySelector('table, ul, ol, pre, blockquote, br, h1, h2, h3, h4, h5, h6')
          && cell.querySelectorAll('p').length <= 1,
        )
      // GFM cannot represent merged cells or block content. Keep the HTML instead
      // of silently flattening the table and losing its structure.
      if (!simple) return '\n\n' + table.outerHTML + '\n\n'

      const values = cells.map((row) => row.map((cell) =>
        service.turndown(cell.innerHTML).trim().replace(/(?<!\\)\|/g, '\\|'),
      ))
      const alignments = cells[0]!.map((cell) => {
        const align = cell.getAttribute('align')?.toLowerCase()
        if (align === 'center') return ':---:'
        if (align === 'right') return '---:'
        if (align === 'left') return ':---'
        return '---'
      })
      const line = (row: string[]) => '| ' + row.join(' | ') + ' |'
      return '\n\n' + [line(values[0]!), line(alignments), ...values.slice(1).map(line)].join('\n') + '\n\n'
    },
  })
  return service.turndown(html)
}
