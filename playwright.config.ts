import { defineConfig } from '@playwright/test';

const pixel7a = {
  // Pixel 7a: 412×915 CSS px, densità 2,625.
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  locale: 'it-IT',
  browserName: 'chromium' as const,
};

export default defineConfig({
  timeout: 30_000,
  // Il primo avvio del server di sviluppo può essere lento (compilazione a freddo).
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: 'list',
  projects: [
    {
      name: 'e2e',
      testDir: 'tests/e2e',
      use: { ...pixel7a, baseURL: 'http://localhost:5179' },
    },
    {
      // Prestazioni misurate sulla build di produzione.
      name: 'perf',
      testDir: 'tests/perf',
      fullyParallel: false,
      use: { ...pixel7a, baseURL: 'http://localhost:4179' },
    },
    {
      // App installabile: service worker e funzionamento senza rete, sulla build di produzione.
      name: 'pwa',
      testDir: 'tests/pwa',
      use: { ...pixel7a, baseURL: 'http://localhost:4179' },
    },
  ],
  webServer: [
    {
      command: 'npx vite --port 5179 --strictPort',
      url: 'http://localhost:5179',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx vite build --logLevel error && npx vite preview --port 4179 --strictPort',
      url: 'http://localhost:4179',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
