import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'אודיסאה – העוזר האישי',
        short_name: 'אודיסאה',
        description: 'מערכת שעות, נקודות זכות, משימות ומבחנים לתלמידי תוכנית אודיסאה',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f7fb',
        theme_color: '#3b5bdb',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
