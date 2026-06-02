// 文件访问层：封装三种打开方式（系统选择器 / 文件夹浏览 / 分享接收），
// 以及最近文件记录。区分原生(Capacitor)与浏览器(开发调试)两种运行环境。
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FilePicker } from '@capawesome/capacitor-file-picker'

export const isNative = Capacitor.isNativePlatform()

// 自定义原生插件：读取「打开方式」/「分享」传入的文件（见 android 端 FileOpenPlugin.java）
const FileOpen = registerPlugin('FileOpen')

// ---------- 编码处理 ----------
// Capacitor 读取文件默认返回 base64，这里转成 UTF-8 文本
function base64ToText(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

// 读取一个文件 URI / 路径为文本（用于文件夹浏览和分享接收）
export async function readPathAsText(path) {
  const res = await Filesystem.readFile({ path })
  // 原生端 data 是 base64 字符串；Web 端可能是 Blob
  if (typeof res.data === 'string') return base64ToText(res.data)
  return await res.data.text()
}

// ---------- 方式一：系统文件选择器 ----------
export async function pickFile() {
  if (isNative) {
    const result = await FilePicker.pickFiles({ readData: true })
    const f = result.files?.[0]
    if (!f) return null
    let text
    if (f.data) text = base64ToText(f.data)
    else if (f.path) text = await readPathAsText(f.path)
    else if (f.blob) text = await f.blob.text()
    return { name: f.name, text }
  }
  return pickFileWeb()
}

// 浏览器降级方案：用隐藏的 <input type=file>
function pickFileWeb() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.html,.htm,.txt,text/html,text/markdown,text/plain'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve({ name: file.name, text: String(reader.result) })
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}

// ---------- 方式二：文件夹浏览 ----------
// 需要先申请存储权限
export async function requestStoragePermission() {
  if (!isNative) return false
  try {
    const status = await Filesystem.checkPermissions()
    if (status.publicStorage === 'granted') return true
    const req = await Filesystem.requestPermissions()
    return req.publicStorage === 'granted'
  } catch {
    // 某些 Android 版本访问公共目录无需显式权限
    return true
  }
}

// 列出目录内容。location = { directory: 'ExternalStorage', path: 'Download' }
export async function listDir({ directory, path }) {
  const res = await Filesystem.readdir({
    path: path || '',
    directory: Directory[directory],
  })
  return res.files // [{ name, type:'file'|'directory', size, mtime, uri }]
}

// 读取文件夹里某个文件（传入完整 file:// URI）
export async function readEntryAsText(uri) {
  return readPathAsText(uri)
}

// ---------- 方式二（增强）：SAF 文件夹授权 ----------
const Saf = registerPlugin('Saf')

export const saf = {
  pickFolder: () => Saf.pickFolder(), // -> {treeUri, docId, name}
  list: async (treeUri, docId) => (await Saf.list({ treeUri, docId })).entries,
  readText: async (uri) => (await Saf.readText({ uri })).text,
  readImage: async (treeUri, dirDocId, relPath) =>
    (await Saf.readRelativeImage({ treeUri, dirDocId, relPath })).dataUrl,
}

// 已授权的文件夹列表（持久化）
const SAF_KEY = 'viewnote.safFolders'
export function getSafFolders() {
  try { return JSON.parse(localStorage.getItem(SAF_KEY)) || [] } catch { return [] }
}
export function addSafFolder(folder) {
  const list = getSafFolders().filter((f) => f.treeUri !== folder.treeUri)
  list.unshift(folder)
  try { localStorage.setItem(SAF_KEY, JSON.stringify(list.slice(0, 10))) } catch { /* 忽略 */ }
  return list
}
export function removeSafFolder(treeUri) {
  const list = getSafFolders().filter((f) => f.treeUri !== treeUri)
  try { localStorage.setItem(SAF_KEY, JSON.stringify(list)) } catch { /* 忽略 */ }
  return list
}

// ---------- 方式三：从其他 APP「打开方式 / 分享」接收 ----------
// 由原生 FileOpenPlugin 统一处理 ACTION_VIEW 与 ACTION_SEND，直接返回文本内容
export async function getSharedFile() {
  if (!isNative) return null
  try {
    const res = await FileOpen.getOpenedFile()
    if (res && res.text != null) {
      return { name: res.name || '打开的文件', text: res.text }
    }
    return null
  } catch {
    return null // 没有待处理的打开/分享内容
  }
}

// ---------- 最近文件记录（存 localStorage）----------
const RECENTS_KEY = 'viewnote.recents'
const MAX_RECENTS = 20

export function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []
  } catch {
    return []
  }
}

export function addRecent({ name, type, text, safContext }) {
  const list = getRecents().filter((r) => r.name !== name)
  list.unshift({ name, type, text, safContext, ts: Date.now() })
  const trimmed = list.slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(trimmed))
  } catch {
    // 内容过大写入失败时，丢弃正文只保留元信息
    try {
      localStorage.setItem(
        RECENTS_KEY,
        JSON.stringify(trimmed.map((r) => ({ ...r, text: '' }))),
      )
    } catch {
      /* 忽略 */
    }
  }
  return trimmed
}

export function removeRecent(index) {
  const list = getRecents()
  list.splice(index, 1)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
  } catch {
    /* 忽略 */
  }
  return list
}
