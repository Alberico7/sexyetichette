/**
 * Riconoscimento simulato, solo in sviluppo (`?sim`), per i test e2e: niente
 * modello né microfono. Le frasi da «riconoscere» si mettono in
 * `window.__sim.voice.phrases` (una per pressione); vedi `src/sim.ts`.
 * Vedi docs/2026-11-10-dettatura.md.
 */
import { simHooks } from '@/sim';
import type { VoiceEngine, VoiceProgress, VoiceResult } from './engine';

const voice = () => (simHooks().voice ??= {});

export class SimulatedVoice implements VoiceEngine {
  private phrase = '';
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready: Promise<void> | null = null;

  prepare(onProgress?: VoiceProgress): Promise<void> {
    this.ready ??= (async () => {
      onProgress?.('Scaricamento (simulato)…', 0.5);
      await new Promise((r) => setTimeout(r, 50));
      voice().downloaded = true;
    })();
    return this.ready;
  }

  start(onPartial: (text: string) => void): Promise<void> {
    this.phrase = voice().phrases?.shift() ?? 'tubo diametro venti';
    this.startedAt = performance.now();
    const firstWords = this.phrase.split(' ').slice(0, 2).join(' ');
    this.timer = setTimeout(() => onPartial(firstWords), 50);
    return Promise.resolve();
  }

  async stop(): Promise<VoiceResult> {
    if (this.timer) clearTimeout(this.timer);
    const audioMs = performance.now() - this.startedAt;
    const delay = voice().delayMs ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return { text: this.phrase, audioMs, ms: delay };
  }

  closeMic(): void {}
}
