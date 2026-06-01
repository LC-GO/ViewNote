// 负责把内容渲染成可显示的 HTML：Markdown 用 marked 解析、DOMPurify 净化、
// highlight.js 做代码高亮；HTML 文件则交给主程序用 iframe 直接预览。
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'

marked.setOptions({
  gfm: true, // 支持 GitHub 风格 Markdown（表格、删除线等）
  breaks: false, // 单个换行不强制换行，符合标准 Markdown
})

// 根据文件名后缀（必要时看内容）判断文件类型
export function detectType(name = '', content = '') {
  const lower = name.toLowerCase()
  if (/\.(md|markdown|mdown|mkd|mkdn)$/.test(lower)) return 'markdown'
  if (/\.(html?|xhtml)$/.test(lower)) return 'html'
  // 无可识别后缀时，按内容粗略判断是否为 HTML
  if (/^\s*<(?:!doctype|html|head|body|div|p|h[1-6])\b/i.test(content)) return 'html'
  return 'markdown'
}

// 将 Markdown 文本渲染进指定容器
export function renderMarkdownTo(container, text) {
  const rawHtml = marked.parse(text ?? '')
  container.innerHTML = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'], // 允许链接的 target 属性
  })
  // 对所有代码块做语法高亮
  container.querySelectorAll('pre code').forEach((block) => {
    try {
      hljs.highlightElement(block)
    } catch {
      /* 某些语言不支持时忽略 */
    }
  })
}

// 高亮单个元素（查看 HTML 源码时使用）
export function highlightCode(el) {
  try {
    hljs.highlightElement(el)
  } catch {
    /* 忽略 */
  }
}
