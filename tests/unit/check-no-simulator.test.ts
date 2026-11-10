import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('controllo della build senza simulazione (docs/2026-11-10-manutenibilita.md)', () => {
  it('lo script cerca «__sim», che copre tutto l’oggetto della simulazione', () => {
    const script = readFileSync('scripts/check-no-simulator.mjs', 'utf8');
    const markers = script.slice(script.indexOf('const markers = ['), script.indexOf('];'));
    expect(markers).toContain("'__sim'");
    expect(markers).toContain("'SimulatedPrinterPort'");
    expect(markers).toContain("'SimulatedVoice'");
  });

  it('nel codice dell’app le variabili globali della simulazione passano solo da src/sim.ts', () => {
    const sim = readFileSync('src/sim.ts', 'utf8');
    expect(sim).toContain('__sim');
    for (const f of [
      'src/voice/engine.ts',
      'src/voice/simulated.ts',
      'src/pwa/update.ts',
      'src/components/LabelEditor.vue',
    ]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/window as unknown as \{ __/);
    }
  });
});
