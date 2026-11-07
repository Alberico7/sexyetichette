// Genera le icone PNG per la schermata home dagli SVG in public/.
// Uso: node scripts/make-icons.mjs (da rilanciare solo se cambia il disegno).
// - icona.svg → icona-180/192.png: fondo pieno senza angoli arrotondati, li arrotonda il telefono.
// - icona-ritagliabile.svg → icona-ritagliabile-192/512.png: icone «maskable» del manifest.
// Vedi docs/2026-11-07-icona-pettirosso.md e docs/2026-11-07-icona-ritagliabile.md.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const squared = (file) => readFileSync(`public/${file}`, 'utf8').replace(/rx="112"/, 'rx="0"');
const JOBS = [
  { svg: squared('icona.svg'), out: { 'icona-180.png': 180, 'icona-192.png': 192 } },
  {
    svg: squared('icona-ritagliabile.svg'),
    out: { 'icona-ritagliabile-192.png': 192, 'icona-ritagliabile-512.png': 512 },
  },
];

const browser = await chromium.launch();
try {
  for (const { svg, out } of JOBS) {
    const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    for (const [file, size] of Object.entries(out)) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        `<body style="margin:0"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body>`,
      );
      await page.screenshot({ path: `public/${file}`, omitBackground: true });
      await page.close();
      console.log(`public/${file} (${size}×${size})`);
    }
  }
} finally {
  await browser.close();
}
