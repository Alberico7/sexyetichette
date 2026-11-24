import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { VOICE_CACHE_NAME, VOICE_MODEL_FILE } from './src/voice/model-cache';
import { playwright } from '@vitest/browser-playwright';

function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '–';
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };
const APP_BUILD = {
  version: pkg.version,
  commit: gitCommit(),
  builtAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
};

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(APP_BUILD) },
  // Percorsi relativi: l'app funziona sia su GitHub Pages (sotto /nome-repo/) sia in locale.
  base: './',
  plugins: [
    vue(),
    // App installabile: service worker, funzionamento senza rete, aggiornamento su conferma.
    // Vedi docs/2026-11-10-pwa.md.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registrazione in src/pwa/update.ts
      manifest: false, // si usa public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,otf,txt,webmanifest}'],
        // Fuori dalla precache: Vosk, che si conserva al primo uso.
        globIgnores: ['**/vosk*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Modello della dettatura all'indirizzo fisso: solo dalla cache della dettatura,
            // mai dalla rete (docs/2026-11-24-vosk-copie-del-modello.md). Nomi da model-cache.ts.
            urlPattern: new RegExp(`/${VOICE_MODEL_FILE.replace(/\./g, '\\.')}$`),
            handler: 'CacheOnly',
            options: { cacheName: VOICE_CACHE_NAME },
          },
          {
            urlPattern: ({ url }) => /\/assets\/vosk[^/]*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'rubeculabel-vosk', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
  build: { target: 'es2022', sourcemap: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
