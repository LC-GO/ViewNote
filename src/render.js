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

let mermaidSeq = 0

// 将 Markdown 文本渲染进指定容器
export function renderMarkdownTo(container, text) {
  const rawHtml = marked.parse(text ?? '')
  container.innerHTML = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'], // 允许链接的 target 属性
  })
  // 代码块语法高亮（mermaid 块跳过，交给图表渲染）
  container.querySelectorAll('pre code').forEach((block) => {
    if (block.classList.contains('language-mermaid')) return
    try {
      hljs.highlightElement(block)
    } catch {
      /* 某些语言不支持时忽略 */
    }
  })
  // Mermaid 图表：按需懒加载 + 滚动到可视区才渲染
  renderMermaid(container).catch(() => {})
}

// 把容器内所有 ```mermaid 代码块渲染成图表
async function renderMermaid(container) {
  const codeBlocks = [...container.querySelectorAll('code.language-mermaid')]
  if (!codeBlocks.length) return

  // 先替换为占位卡片，避免先闪现 mermaid 源码
  const placeholders = codeBlocks.map((codeEl) => {
    const pre = codeEl.closest('pre') || codeEl
    const ph = document.createElement('div')
    ph.className = 'mermaid-diagram mermaid-loading'
    ph.textContent = '📊 加载图表…'
    ph._code = codeEl.textContent
    pre.replaceWith(ph)
    return ph
  })

  let mermaid
  try {
    mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
  } catch {
    // mermaid 加载失败：还原为源码，至少能看到内容
    placeholders.forEach((ph) => {
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      code.textContent = ph._code
      pre.appendChild(code)
      ph.replaceWith(pre)
    })
    return
  }

  const renderOne = async (ph) => {
    try {
      const { svg } = await mermaid.render('mermaid-' + ++mermaidSeq, ph._code)
      ph.classList.remove('mermaid-loading')
      ph.innerHTML = svg
    } catch (e) {
      ph.classList.remove('mermaid-loading')
      ph.classList.add('mermaid-error')
      ph.textContent = '图表渲染失败：' + (e?.message || e)
    }
  }

  // 大文档可能有很多图，滚动到附近才渲染，避免卡顿
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            obs.unobserve(en.target)
            renderOne(en.target)
          }
        })
      },
      { rootMargin: '400px' },
    )
    placeholders.forEach((ph) => io.observe(ph))
  } else {
    for (const ph of placeholders) await renderOne(ph)
  }
}

// 高亮单个元素（查看 HTML 源码时使用）
export function highlightCode(el) {
  try {
    hljs.highlightElement(el)
  } catch {
    /* 忽略 */
  }
}
