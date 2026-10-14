/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Bundled fonts live in assets/fonts (single source of truth) and are served/copied as the public dir.
export default defineConfig({
  publicDir: 'assets',
  resolve: { alias: { '@': r('./src'), '@research': r('./research') } },
  clearScreen: false,
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache well across app updates.
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-konva', test: /node_modules[\\/](konva|react-konva|react-reconciler|its-fine)[\\/]/ },
            { name: 'vendor-data', test: /node_modules[\\/](zod|dexie|dexie-react-hooks|zustand|zundo)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'CarouselForge',
        short_name: 'CarouselForge',
        description: 'Turn raw content into professional social media carousels — online or offline.',
        theme_color: '#5B5BF0',
        background_color: '#0F1115',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // wasm = onnxruntime-web runtime (~14 MB), onnx = background-removal model (src/image/bgremove).
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2,json,wasm,onnx}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
