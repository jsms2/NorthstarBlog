import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
export async function renderMarkdown(markdown: string) {
  const raw = await marked.parse(markdown, { gfm: true })
  return sanitizeContentHtml(raw)
}
export function sanitizeContentHtml(raw:string){return sanitizeHtml(raw,{allowedTags:sanitizeHtml.defaults.allowedTags.concat(['img','details','summary','figure','figcaption','iframe','aside','div','input']),allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,img:['src','alt','title','width','height','loading'],iframe:['src','title','allow','allowfullscreen','sandbox','loading'],code:['class'],input:['type','checked','disabled'],a:['href','name','target','rel','class','data-content-button','data-file-attachment'],details:['open','class'],'*':['id','class','data-callout','data-gallery','data-mermaid','data-math','data-provider','data-url','data-style','data-latex']},allowedIframeHostnames:['www.youtube.com','player.bilibili.com'],allowedSchemes:['http','https','mailto'],allowedSchemesByTag:{img:['http','https'],iframe:['https'],a:['http','https','mailto']},transformTags:{a:sanitizeHtml.simpleTransform('a',{rel:'nofollow noopener noreferrer'})}})}
export function contentMetrics(markdown: string) { const text=markdown.replace(/```[\s\S]*?```|[#>*_`\-[\]()!]/g,' ').replace(/\s+/g,' ').trim(); const words=(text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu)||[]).length; return { wordCount: words, readingMinutes: Math.max(1,Math.ceil(words/300)), searchText:text } }
