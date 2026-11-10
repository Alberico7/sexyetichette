import { describe, expect, it } from 'vitest';
import {
  TARGET_RATE,
  concat,
  durationMs,
  megabytes,
  realTimeFactor,
  resample,
  seconds,
  toMono,
} from '@/prova-voce/audio';

/** Sinusoide di `freq` Hz, `ms` millisecondi a `rate` Hz. */
function sine(freq: number, rate: number, ms: number): Float32Array {
  const n = Math.round((rate * ms) / 1000);
  return Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freq * i) / rate));
}

/** Frequenza stimata contando gli attraversamenti dello zero. */
function frequency(x: Float32Array, rate: number): number {
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1]! < 0 !== x[i]! < 0) crossings++;
  return (crossings / 2) * (rate / x.length);
}

describe('audio della prova dettatura (docs/2026-11-10-prova-dettatura.md)', () => {
  it('da 48 kHz a 16 kHz: durata e frequenza conservate', () => {
    const input = sine(440, 48000, 1000);
    const out = resample(input, 48000);
    expect(TARGET_RATE).toBe(16000);
    expect(out.length).toBe(16000);
    expect(durationMs(out.length)).toBeCloseTo(1000, 5);
    expect(frequency(out, 16000)).toBeCloseTo(440, -1);
  });

  it('da 44,1 kHz e da 8 kHz (in salita)', () => {
    expect(resample(sine(300, 44100, 500), 44100).length).toBe(8000);
    const up = resample(sine(300, 8000, 500), 8000);
    expect(up.length).toBe(8000);
    expect(frequency(up, 16000)).toBeCloseTo(300, -1);
  });

  it('un segnale costante resta costante; alla stessa frequenza è una copia', () => {
    const flat = new Float32Array(4800).fill(0.25);
    for (const v of resample(flat, 48000)) expect(v).toBeCloseTo(0.25, 6);
    const same = sine(100, 16000, 100);
    const copy = resample(same, 16000);
    expect(copy).toEqual(same);
    expect(copy).not.toBe(same);
  });

  it('il filtro in discesa attenua le frequenze che a 16 kHz non si possono rappresentare', () => {
    const high = resample(sine(12000, 48000, 200), 48000);
    const peak = Math.max(...Array.from(high, Math.abs));
    expect(peak).toBeLessThan(0.5);
  });

  it('mono, unione dei pezzi e calcolo dei tempi', () => {
    const l = new Float32Array([1, 0, -1]);
    const r = new Float32Array([0, 0, 1]);
    expect(Array.from(toMono([l, r]))).toEqual([0.5, 0, 0]);
    expect(Array.from(concat([l, r]))).toEqual([1, 0, -1, 0, 0, 1]);
    expect(toMono([]).length).toBe(0);
    expect(realTimeFactor(500, 2000)).toBe(0.25);
    expect(realTimeFactor(500, 0)).toBeNaN();
    expect(seconds(1234)).toBe('1,23 s');
    expect(megabytes(77_100_000)).toBe('77,1 MB');
  });
});
