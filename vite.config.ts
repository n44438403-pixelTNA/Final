import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'maskable-icon-512x512.png'],
          manifest: {
            name: 'IDEAL INSPIRATION CLASSES',
            short_name: 'IIC AI',
            description: 'IDEAL INSPIRATION CLASSES - IIC AI Learning Platform',
            theme_color: '#0f172a',
            background_color: '#f8fafc',
            display: 'standalone',
            orientation: 'portrait',
            icons: [
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'maskable-icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ],
            shortcuts: [
              {
                name: "Revision Hub",
                short_name: "Revision",
                description: "Quickly access your revision notes",
                url: "/?action=revision",
                icons: [{ src: "icon-192x192.png", sizes: "192x192" }]
              },
              {
                name: "AI Tutor",
                short_name: "Ask AI",
                description: "Ask your AI Tutor a question",
                url: "/?action=ai",
                icons: [{ src: "icon-192x192.png", sizes: "192x192" }]
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json,ttf,woff,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],
      optimizeDeps: {
        include: ['pdfjs-dist'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'pdfjs-dist': path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.js'),
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      }
    };
});
