import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTar, entriesFromFiles, sha256Hex } from '@/voice/tar';

const enc = new TextEncoder();

describe('archivio tar per il modello Vosk (docs/2026-11-10-prova-dettatura.md)', () => {
  it('aggiunge le cartelle e ordina le voci', () => {
    const entries = entriesFromFiles({
      'modello/graph/Gr.fst': enc.encode('g'),
      'modello/am/final.mdl': enc.encode('m'),
      'modello/README': enc.encode('r'),
    });
    expect(entries.map((e) => e.name)).toEqual([
      'modello/',
      'modello/am/',
      'modello/am/final.mdl',
      'modello/graph/',
      'modello/graph/Gr.fst',
      'modello/README',
    ]);
  });

  it('blocchi da 512 byte e somma di controllo corretta', () => {
    const tar = createTar([{ name: 'a.txt', data: enc.encode('ciao') }]);
    expect(tar.length).toBe(512 * 4); // intestazione + contenuto + 2 blocchi vuoti
    const h = tar.subarray(0, 512);
    const stored = parseInt(new TextDecoder().decode(h.subarray(148, 154)), 8);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]!;
    expect(stored).toBe(sum);
    expect(new TextDecoder().decode(tar.subarray(512, 516))).toBe('ciao');
  });

  it('il programma tar del sistema lo legge ed estrae i file identici', () => {
    const big = Uint8Array.from({ length: 1300 }, (_, i) => i % 251);
    const tar = createTar(
      entriesFromFiles({
        'vosk-model-small-it-0.22/am/final.mdl': big,
        'vosk-model-small-it-0.22/README': enc.encode('x'),
      }),
    );
    const dir = mkdtempSync(join(tmpdir(), 'tar-'));
    try {
      writeFileSync(join(dir, 'm.tar'), tar);
      const list = execFileSync('tar', ['-tf', 'm.tar'], { cwd: dir }).toString().trim().split(/\r?\n/);
      expect(list).toContain('vosk-model-small-it-0.22/am/final.mdl');
      execFileSync('tar', ['-xf', 'm.tar'], { cwd: dir });
      expect(new Uint8Array(readFileSync(join(dir, 'vosk-model-small-it-0.22/am/final.mdl')))).toEqual(big);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('impronta SHA-256', async () => {
    expect(await sha256Hex(enc.encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
