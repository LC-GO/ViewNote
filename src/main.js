import './style.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import { App } from '@capacitor/app'
import { detectType, renderMarkdownTo, highlightCode } from './render.js'
import {
  isNative,
  pickFile,
  getRecents,
  addRecent,
  removeRecent,
  listDir,
  readEntryAsText,
  requestStoragePermission,
  getSharedFile,
} from './files.js'

const app = document.getElementById('app')

// ---------- 应用状态 ----------
const state = {
  view: 'home', // home | viewer | browser
  current: null, // { name, type, text }
  htmlShowSource: false,
  browse: { directory: 'ExternalStorage', path: '' },
}

// ---------- 工具函数 ----------
const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
const escapeAttr = escapeHtml
const byName = (a, b) => a.name.localeCompare(b.name, 'zh')

// ---------- 外观（主题 / 字体 / 字号 / 行距）----------
const SIZES = [13, 14, 15, 16, 17, 18, 20, 22]
const THEMES = {
  light: [
    ['github-light', 'GitHub'], ['notion', 'Notion'], ['sepia', '纸张'],
    ['solarized-light', 'Solarized'], ['latte', 'Latte'],
  ],
  dark: [['github-dark', 'GitHub'], ['oled', '纯黑'], ['one-dark', 'One Dark']],
}
const SWATCH = {
  'github-light': ['#fff', '#0969da'], notion: ['#fff', '#2383e2'], sepia: ['#f4ecd8', '#9a5b27'],
  'solarized-light': ['#fdf6e3', '#268bd2'], latte: ['#eff1f5', '#1e66f5'],
  'github-dark': ['#0d1117', '#2f81f7'], oled: ['#000', '#4493f8'], 'one-dark': ['#282c34', '#61afef'],
}
const lsGet = (k) => {
  try { return localStorage.getItem(k) } catch { return null }
}
const lsSet = (k, v) => {
  try { localStorage.setItem(k, v) } catch { /* 忽略 */ }
}

const appearance = {
  theme: lsGet('viewnote.theme') || 'auto', // 'auto' = 跟随系统（浅→GitHub 浅，深→GitHub 深）
  font: lsGet('viewnote.font') || 'sans',
  fontScale: Number(lsGet('viewnote.fontScale')) || 16,
  lineHeight: lsGet('viewnote.lineHeight') || '1.75',
}
const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches
const resolveTheme = (t) =>
  t === 'auto' ? (prefersDark() ? 'github-dark' : 'github-light') : t

function applyAppearance() {
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(appearance.theme))
  root.setAttribute('data-font', appearance.font)
  root.style.setProperty('--fs', appearance.fontScale + 'px')
  root.style.setProperty('--lh', appearance.lineHeight)
}
function saveAppearance() {
  lsSet('viewnote.theme', appearance.theme)
  lsSet('viewnote.font', appearance.font)
  lsSet('viewnote.fontScale', String(appearance.fontScale))
  lsSet('viewnote.lineHeight', appearance.lineHeight)
}
function watchSystemTheme() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (appearance.theme === 'auto') applyAppearance()
  })
}
const swatch = (v) => {
  const s = SWATCH[v]
  return s ? `linear-gradient(135deg,${s[0]} 50%,${s[1]} 50%)` : '#888'
}

// 打开底部「外观」面板
function openAppearance() {
  const old = document.getElementById('appearance')
  if (old) old.remove()
  const ov = document.createElement('div')
  ov.id = 'appearance'
  ov.className = 'sheet-backdrop'
  const themeChip = (v, n) =>
    `<button class="chip" data-theme-val="${v}">${
      v === 'auto' ? '' : `<span class="sw" style="background:${swatch(v)}"></span>`
    }${n}</button>`
  ov.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><span>外观</span><button class="icon-btn" id="ap-close">✕</button></div>
      <div class="ap-group">
        <div class="ap-label">主题</div>
        <div class="ap-chips">
          ${themeChip('auto', '跟随系统')}
          <span class="ap-sub">浅</span>${THEMES.light.map(([v, n]) => themeChip(v, n)).join('')}
          <span class="ap-sub">深</span>${THEMES.dark.map(([v, n]) => themeChip(v, n)).join('')}
        </div>
      </div>
      <div class="ap-group">
        <div class="ap-label">字体</div>
        <div class="ap-chips">
          <button class="chip" data-font-val="sans">无衬线</button>
          <button class="chip" data-font-val="serif">衬线</button>
        </div>
      </div>
      <div class="ap-group">
        <div class="ap-label">字号</div>
        <div class="ap-chips">
          <button class="chip" id="ap-fs-minus">A−</button>
          <span class="ap-fs" id="ap-fs-val">${appearance.fontScale}</span>
          <button class="chip" id="ap-fs-plus">A+</button>
        </div>
      </div>
      <div class="ap-group">
        <div class="ap-label">行距</div>
        <div class="ap-chips">
          <button class="chip" data-lh-val="1.5">紧凑</button>
          <button class="chip" data-lh-val="1.75">标准</button>
          <button class="chip" data-lh-val="2.0">宽松</button>
        </div>
      </div>
    </div>`
  document.body.appendChild(ov)

  const refresh = () => {
    ov.querySelectorAll('[data-theme-val]').forEach((b) =>
      b.classList.toggle('active', b.dataset.themeVal === appearance.theme))
    ov.querySelectorAll('[data-font-val]').forEach((b) =>
      b.classList.toggle('active', b.dataset.fontVal === appearance.font))
    ov.querySelectorAll('[data-lh-val]').forEach((b) =>
      b.classList.toggle('active', Number(b.dataset.lhVal) === Number(appearance.lineHeight)))
    ov.querySelector('#ap-fs-val').textContent = appearance.fontScale
  }
  const commit = () => {
    applyAppearance()
    saveAppearance()
    refresh()
  }

  ov.querySelectorAll('[data-theme-val]').forEach((b) => {
    b.onclick = () => { appearance.theme = b.dataset.themeVal; commit() }
  })
  ov.querySelectorAll('[data-font-val]').forEach((b) => {
    b.onclick = () => { appearance.font = b.dataset.fontVal; commit() }
  })
  ov.querySelectorAll('[data-lh-val]').forEach((b) => {
    b.onclick = () => { appearance.lineHeight = b.dataset.lhVal; commit() }
  })
  ov.querySelector('#ap-fs-plus').onclick = () => {
    const i = SIZES.indexOf(appearance.fontScale)
    appearance.fontScale = SIZES[Math.min(i + 1, SIZES.length - 1)] || 16
    commit()
  }
  ov.querySelector('#ap-fs-minus').onclick = () => {
    const i = SIZES.indexOf(appearance.fontScale)
    appearance.fontScale = SIZES[Math.max(i - 1, 0)] || 16
    commit()
  }
  const close = () => ov.remove()
  ov.querySelector('#ap-close').onclick = close
  ov.onclick = (e) => {
    if (e.target === ov) close()
  }
  refresh()
}

// ---------- 打开文件的统一入口 ----------
function openRawFile({ name, text }) {
  const type = detectType(name, text)
  const fileObj = { name, type, text }
  addRecent(fileObj)
  openFileObject(fileObj)
}
function openFileObject(fileObj) {
  state.current = fileObj
  state.htmlShowSource = false
  state.view = 'viewer'
  renderViewer()
}
function goHome() {
  state.view = 'home'
  state.current = null
  renderHome()
}

// ---------- 主页 ----------
function renderHome() {
  const recents = getRecents()
  app.innerHTML = `
    <header class="topbar topbar-home">
      <div class="tb-left">
        <span class="studio-logo" title="pigo studio">
          <svg class="studio-svg" viewBox="0 0 200 42" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="pigo studio">
            <rect x="0" y="4" width="38" height="34" rx="17" fill="#F97066" />
            <circle cx="13" cy="21" r="4.5" fill="#fff" opacity="0.55" />
            <circle cx="25" cy="21" r="4.5" fill="#fff" opacity="0.55" />
            <text x="48" y="20" font-family="Outfit, sans-serif" font-size="22" fill="currentColor" font-weight="600" letter-spacing="-0.3">pigo</text>
            <text x="48" y="36" font-family="Outfit, sans-serif" font-size="11" fill="#F97066" font-weight="500" letter-spacing="2.5">STUDIO</text>
          </svg>
        </span>
      </div>
      <div class="tb-center"><span class="app-name">ViewNote</span></div>
      <div class="tb-right">
        <button class="icon-btn" id="appearance-btn" title="外观">Aa</button>
      </div>
    </header>
    <main class="home">
      <section class="hero">
        <h1 class="hero-title">阅读你的文档</h1>
        <p class="hero-sub">优雅地查看 Markdown 与 HTML 文件</p>
      </section>
      <section class="action-grid">
        <button class="action-card" id="open-file-btn">
          <span class="action-tile">📂</span>
          <span class="action-title">打开文件</span>
          <span class="action-sub">选择单个文件</span>
        </button>
        <button class="action-card" id="browse-btn">
          <span class="action-tile">🗂️</span>
          <span class="action-title">浏览文件夹</span>
          <span class="action-sub">浏览目录</span>
        </button>
      </section>
      <section class="recents">
        <h2 class="section-title">最近打开</h2>
        ${
          recents.length === 0
            ? `<div class="empty-state">
                 <div class="empty-icon">📭</div>
                 <p class="empty-text">还没有打开过文件<small>点上面的按钮选一个 .md 或 .html 文件试试</small></p>
               </div>`
            : `<ul class="recent-list">${recents
                .map(
                  (r, i) => `
              <li class="recent-item" data-index="${i}">
                <span class="recent-tile">${r.type === 'html' ? '🌐' : '📝'}</span>
                <span class="recent-info">
                  <span class="recent-name">${escapeHtml(r.name)}</span>
                  <span class="recent-meta">${r.type === 'html' ? 'HTML' : 'Markdown'}</span>
                </span>
                <button class="recent-del" data-del="${i}" title="移除">✕</button>
              </li>`,
                )
                .join('')}</ul>`
        }
      </section>
    </main>`

  document.getElementById('appearance-btn').onclick = openAppearance
  document.getElementById('open-file-btn').onclick = onOpenFile
  document.getElementById('browse-btn').onclick = onBrowse
  app.querySelectorAll('.recent-item').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('.recent-del')) return
      const r = getRecents()[Number(el.dataset.index)]
      if (r) openFileObject(r)
    }
  })
  app.querySelectorAll('.recent-del').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation()
      removeRecent(Number(btn.dataset.del))
      renderHome()
    }
  })
}

async function onOpenFile() {
  try {
    const file = await pickFile()
    if (file) openRawFile(file)
  } catch (e) {
    alert('打开文件失败：' + (e?.message || e))
  }
}

// ---------- 查看页 ----------
function renderViewer() {
  const f = state.current
  const isHtml = f.type === 'html'
  app.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" id="back-btn" title="返回">←</button>
      <div class="file-title">${escapeHtml(f.name)}</div>
      ${
        isHtml
          ? `<button class="icon-btn" id="src-btn" title="预览/源码">${
              state.htmlShowSource ? '👁️' : '〈〉'
            }</button>`
          : ''
      }
      <button class="icon-btn" id="appearance-btn" title="外观">Aa</button>
    </header>
    <main class="viewer" id="viewer-content"></main>`

  document.getElementById('back-btn').onclick = goHome
  document.getElementById('appearance-btn').onclick = openAppearance
  if (isHtml) {
    document.getElementById('src-btn').onclick = () => {
      state.htmlShowSource = !state.htmlShowSource
      renderViewer()
    }
  }

  const content = document.getElementById('viewer-content')
  if (isHtml && !state.htmlShowSource) {
    // HTML 预览：用沙箱 iframe，隔离于本应用，但允许其自身脚本运行
    content.classList.add('frame')
    const iframe = document.createElement('iframe')
    iframe.className = 'html-frame'
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-forms allow-modals')
    iframe.srcdoc = f.text
    content.appendChild(iframe)
  } else if (isHtml && state.htmlShowSource) {
    // HTML 源码视图
    content.classList.add('markdown-body')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-html'
    code.textContent = f.text
    pre.appendChild(code)
    content.appendChild(pre)
    highlightCode(code)
  } else {
    // Markdown 渲染
    content.classList.add('markdown-body')
    renderMarkdownTo(content, f.text)
  }
}

// ---------- 文件夹浏览 ----------
async function onBrowse() {
  if (!isNative) {
    alert('文件夹浏览需在手机 APP 中使用。\n在浏览器调试时请用「打开文件」。')
    return
  }
  const granted = await requestStoragePermission()
  if (!granted) {
    alert('需要存储权限才能浏览文件夹。')
    return
  }
  state.view = 'browser'
  state.browse = { directory: 'ExternalStorage', path: '' }
  renderBrowser()
}

function browserBack() {
  if (state.browse.path) {
    const parts = state.browse.path.split('/').filter(Boolean)
    parts.pop()
    state.browse.path = parts.join('/')
    renderBrowser()
  } else {
    goHome()
  }
}

async function renderBrowser() {
  app.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" id="back-btn" title="返回">←</button>
      <div class="file-title">/${escapeHtml(state.browse.path)}</div>
    </header>
    <main class="home"><ul class="recent-list" id="entries"><li class="empty">加载中…</li></ul></main>`
  document.getElementById('back-btn').onclick = browserBack

  const ul = document.getElementById('entries')
  try {
    const entries = await listDir(state.browse)
    const dirs = entries.filter((e) => e.type === 'directory').sort(byName)
    const docs = entries
      .filter((e) => e.type === 'file' && /\.(md|markdown|html?|txt)$/i.test(e.name))
      .sort(byName)

    if (dirs.length + docs.length === 0) {
      ul.innerHTML = `<li class="empty">这个文件夹里没有子目录或可显示的文件（.md / .html）。</li>`
      return
    }
    ul.innerHTML = [
      ...dirs.map(
        (d) => `
        <li class="recent-item" data-dir="${escapeAttr(d.name)}">
          <span class="recent-tile">📁</span>
          <span class="recent-info"><span class="recent-name">${escapeHtml(d.name)}</span></span>
        </li>`,
      ),
      ...docs.map(
        (d) => `
        <li class="recent-item" data-file="${escapeAttr(d.uri || '')}" data-name="${escapeAttr(d.name)}">
          <span class="recent-tile">${/\.html?$/i.test(d.name) ? '🌐' : '📝'}</span>
          <span class="recent-info"><span class="recent-name">${escapeHtml(d.name)}</span></span>
        </li>`,
      ),
    ].join('')

    ul.querySelectorAll('[data-dir]').forEach((el) => {
      el.onclick = () => {
        const name = el.dataset.dir
        state.browse.path = state.browse.path ? `${state.browse.path}/${name}` : name
        renderBrowser()
      }
    })
    ul.querySelectorAll('[data-file]').forEach((el) => {
      el.onclick = async () => {
        try {
          const text = await readEntryAsText(el.dataset.file)
          openRawFile({ name: el.dataset.name, text })
        } catch (e) {
          alert('读取文件失败：' + (e?.message || e))
        }
      }
    })
  } catch (e) {
    ul.innerHTML = `<li class="empty">无法读取该目录：${escapeHtml(
      String(e?.message || e),
    )}<br><br>可能是 Android 分区存储限制，请尝试用「打开文件」或「打开方式」。</li>`
  }
}

// ---------- 分享 / 打开方式 接收 ----------
async function checkIncomingFile() {
  try {
    const shared = await getSharedFile()
    if (shared && shared.text != null) {
      openRawFile({ name: shared.name, text: shared.text })
    }
  } catch {
    /* 没有待处理的分享，忽略 */
  }
}

// ---------- 原生集成：返回键、恢复时检查分享 ----------
function initNative() {
  if (!isNative) return
  App.addListener('resume', checkIncomingFile)
  App.addListener('backButton', () => {
    const ov = document.getElementById('appearance')
    if (ov) {
      ov.remove() // 优先关闭「外观」面板
      return
    }
    if (state.view === 'viewer') goHome()
    else if (state.view === 'browser') browserBack()
    else App.exitApp()
  })
}

// ---------- 启动 ----------
applyAppearance()
watchSystemTheme()
initNative()
renderHome()
checkIncomingFile() // 若是被「打开方式」拉起的，会直接跳到查看页
