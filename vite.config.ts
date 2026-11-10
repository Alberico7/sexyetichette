import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
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
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Seconda pagina: la prova della dettatura (docs/2026-11-10-prova-dettatura.md).
      // Le sue librerie finiscono solo nei suoi file, non nell'app.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'prova-voce': fileURLToPath(new URL('./prova-voce.html', import.meta.url)),
      },
    },
  },
  // Il worker di Whisper carica parti della libreria su richiesta: serve il formato a moduli.
  worker: { format: 'es' },
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
