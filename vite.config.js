import { defineConfig } from 'vite'

// Capacitor 通过本地服务器加载 dist 目录，base 用相对路径最稳妥
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true, // 方便在手机浏览器里访问局域网调试
    port: 5173,
  },
})
