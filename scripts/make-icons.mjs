// Genera le icone PNG per la schermata home da public/icona.svg.
// Uso: node scripts/make-icons.mjs (da rilanciare solo se cambia il disegno).
// I PNG hanno il fondo pieno, senza angoli arrotondati: li arrotonda il telefono.
// Vedi docs/2026-11-07-icona-pettirosso.md.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('public/icona.svg', 'utf8').replace(/rx="112"/, 'rx="0"');
const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const SIZES = { 'icona-180.png': 180, 'icona-192.png': 192 };

const browser = await chromium.launch();
try {
  for (const [file, size] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.screenshot({ path: `public/${file}`, omitBackground: true });
    await page.close();
    console.log(`public/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
