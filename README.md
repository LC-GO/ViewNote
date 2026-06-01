# ViewNote 📄

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-3DDC84.svg)](https://github.com/LC-GO/viewnote/releases)
[![Capacitor 8](https://img.shields.io/badge/Capacitor-8-119EFF.svg)](https://capacitorjs.com/)

一个用于在 **Android 手机** 上查看 **HTML** 和 **Markdown** 文件的 APP。

基于 **Capacitor + Vite**（Web 技术打包成原生 APP）。

## 📥 下载安装

去 [Releases 页](https://github.com/LC-GO/viewnote/releases) 下载最新 APK，传到手机点击安装即可（首次需在系统设置里允许「安装未知来源应用」）。

> 本项目**不上架任何应用商店**，仅通过 GitHub Releases 分发。

## ✨ 功能

- 📝 **Markdown 渲染**：标题、列表、表格、引用、代码高亮（marked + highlight.js），内容经 DOMPurify 净化，安全。
- 🌐 **HTML 预览**：用沙箱 iframe 真实渲染网页，并可一键切换「预览 / 源码」。
- 📂 **三种打开方式**：
  1. **系统文件选择器** —— 点「打开文件」选一个文件。
  2. **内置文件夹浏览** —— 浏览手机里的目录（受 Android 版本限制，见下文）。
  3. **「打开方式」/ 分享** —— 在文件管理器或其他 APP 里选择用 ViewNote 打开。
- 🎨 **8 套主题** + 字体（无衬线/衬线）/ 字号 / 行距自定义，默认跟随系统深浅，设置持久化。
- 🌓 记住最近打开的文件。

## 🧱 项目结构

```
ViewNote/
├── index.html              # 入口页
├── src/
│   ├── main.js             # 主程序：界面、导航、原生集成
│   ├── render.js           # Markdown / 代码高亮渲染
│   ├── files.js            # 三种文件打开方式 + 最近文件
│   └── style.css           # 移动端样式、明暗主题
├── samples/                # 测试用的 demo.md / demo.html
├── android/                # Capacitor 生成的原生工程
│   └── app/src/main/
│       ├── java/com/viewnote/app/
│       │   ├── MainActivity.java     # 注册插件、处理 intent
│       │   └── FileOpenPlugin.java   # 自定义插件：读取「打开方式/分享」的文件
│       └── AndroidManifest.xml       # intent-filter（打开方式/分享）、权限
├── capacitor.config.json
└── vite.config.js
```

---

## 🚀 环境准备（首次必看）

要把项目编译成手机能装的 APK，需要安装两样东西：

### 1. JDK 21（Capacitor 8 要求）

最简单的方式是直接装 **Android Studio**，它自带 JDK 21（无需单独装 Java）。
如果想单独装：用 `winget install Microsoft.OpenJDK.21`。

### 2. Android Studio（一次装齐 SDK + adb + 模拟器）

下载安装：<https://developer.android.com/studio>

首次启动按向导走，它会自动下载 **Android SDK**。完成后：

- 编译用的 Java、Android SDK、adb、模拟器都齐了。
- 如需命令行用 adb，把 SDK 的 `platform-tools` 目录加入系统 PATH，
  默认在 `C:\Users\你的用户名\AppData\Local\Android\Sdk\platform-tools`。

---

## 🛠️ 开发与运行

### 在电脑浏览器里预览（最快，改 UI 时用）

```bash
npm install        # 首次
npm run dev        # 打开 http://localhost:5173
```

> 浏览器里「打开文件」可用；「浏览文件夹 / 打开方式」是 Android 原生功能，需在手机上测。

### 编译并在手机 / 模拟器上运行

```bash
npm run build              # 1. 构建 Web 资源到 dist/
npx cap sync android       # 2. 同步到原生工程
npx cap open android       # 3. 用 Android Studio 打开 android/ 工程
```

然后在 Android Studio 里点绿色 ▶️ 运行（选模拟器或已连接的真机）。

也可以用一条命令跑完前两步并打开：

```bash
npm run android
```

### 用真机调试（推荐，无需模拟器）

1. 手机「设置 → 关于手机 → 连续点击版本号」开启开发者模式。
2. 「开发者选项」里打开 **USB 调试**，用数据线连上电脑。
3. `adb devices` 能看到设备后，在 Android Studio 选该设备点运行。

### 直接出一个 APK 安装包（不连电脑装）

```bash
cd android
./gradlew assembleDebug
```

生成的 APK 在 `android/app/build/outputs/apk/debug/app-debug.apk`，
传到手机点击安装即可（需允许「安装未知来源应用」）。

---

## 📱 使用说明

- **打开文件**：主页点「📂 打开文件」，选一个 `.md` / `.html` 文件。
- **浏览文件夹**：主页点「🗂️ 浏览文件夹」（见下方限制）。
- **打开方式**：在系统文件管理器里长按一个 html/md 文件 → 打开方式 → 选 ViewNote；
  或在其他 APP 里「分享 → ViewNote」。
- 查看 HTML 时，右上角 `〈〉` 按钮可切换「预览 / 源码」。
- **切主题/字体**：顶栏「Aa」按钮打开底部面板，选主题（8 套）、字体、字号（A−/A+）、行距。

---

## 🎨 主题与外观

ViewNote 内置 **8 套主题**，覆盖常见的阅读偏好：

| 浅色 | 深色 |
| --- | --- |
| GitHub Light · Notion Light · Paper · Solarized Light · Catppuccin Latte | GitHub Dark · 纯黑 (OLED) · One Dark |

- **默认 auto** 跟随系统：浅色 → GitHub Light，深色 → GitHub Dark。
- 可独立切换 **字体**（无衬线 / 衬线）、**字号**（A− A+）、**行距**。
- 设置持久化到 `localStorage`，键名 `viewnote.{theme,font,fontScale,lineHeight}`。
- 代码高亮（highlight.js）会把 token class 映射到当前主题的 `--tok-*` CSS 变量，做到全主题统一观感。

> 详细设计见 [DESIGN.md](DESIGN.md) 6.5 节，可视化预览：在浏览器里打开 `samples/theme-preview.html`。

---

## ⚠️ 已知限制

- **文件夹浏览在 Android 13+ 受限**：从 Android 11 起系统采用「分区存储」，
  APP 无法随意遍历整个手机存储。本项目用 `READ_EXTERNAL_STORAGE`（仅 Android 12 及以下生效）
  做了基础浏览。**在 Android 13+ 上，请优先用「打开文件」或「打开方式」**，这两种方式在所有版本都稳定可用。
  （后续可加 SAF 目录授权或「所有文件访问」权限来增强，属于 v2 增强项。）
- `marked` 默认不解析原始 HTML 中的脚本；Markdown 内容经 DOMPurify 净化，HTML 文件则在隔离的沙箱 iframe 中渲染。

---

## 📦 技术栈

| 用途 | 库 |
| --- | --- |
| 原生壳 | Capacitor 8 |
| 构建 | Vite 8 |
| Markdown 解析 | marked 18 |
| HTML 净化 | DOMPurify 3 |
| 代码高亮 | highlight.js 11 |
| 文件选择 | @capawesome/capacitor-file-picker |
| 文件系统 | @capacitor/filesystem |
| 打开方式/分享 | 自定义 `FileOpenPlugin`（android/） |

---

## 🤝 贡献

欢迎提 Issue 或 PR。这是个用爱发电的小工具项目，没有应用商店的发版周期压力，迭代节奏比较自由。

- 报 bug / 提建议：开 [Issue](https://github.com/LC-GO/viewnote/issues)
- 改代码：fork → 改 → PR

---

## 🙏 致谢

本项目站在巨人的肩上，特别感谢以下开源项目（均为宽松许可，详见各自仓库）：

- [Capacitor](https://capacitorjs.com/) — 把 Web 包成原生 APP 的框架（MIT）
- [Vite](https://vitejs.dev/) — 极快的前端构建工具（MIT）
- [marked](https://github.com/markedjs/marked) — Markdown 解析（MIT）
- [DOMPurify](https://github.com/cure53/DOMPurify) — XSS 净化（Apache-2.0 / MPL-2.0）
- [highlight.js](https://highlightjs.org/) — 代码高亮（BSD-3-Clause）
- [@capawesome/capacitor-file-picker](https://github.com/capawesome-team/capacitor-plugins) — 文件选择插件（MIT）

主题配色参考了 GitHub、Notion、Solarized、Catppuccin、One Dark 等社区流行的设计。

---

## 📄 License

[MIT](LICENSE) © 2026 zbliuzhanxian
