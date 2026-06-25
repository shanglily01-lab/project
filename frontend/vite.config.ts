import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/data': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/scoring': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/actions': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3100',
        ws: true,
      },
    },
  },
})
