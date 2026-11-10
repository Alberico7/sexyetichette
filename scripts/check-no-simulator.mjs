// Verifica che la build di produzione non contenga la stampante simulata.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
// `__sim` copre tutto l'oggetto della simulazione (src/sim.ts): stampante, dettatura, aggiornamento.
const markers = [
  '__sim',
  'SimulatedPrinterPort',
  'SimulatedVoice',
  'Simulazione (solo sviluppo)',
  'disconnect-on-print',
];
const found = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.js')) continue;
  const text = readFileSync(join(dir, file), 'utf8');
  for (const m of markers) if (text.includes(m)) found.push(`${file}: ${m}`);
}
if (found.length) {
  console.error('La build contiene codice della simulazione:\n' + found.join('\n'));
  process.exit(1);
}
console.log('OK: nessuna traccia della stampante simulata nella build.');
