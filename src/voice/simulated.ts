/**
 * Riconoscimento simulato, solo in sviluppo (`?sim`), per i test e2e: niente
 * modello né microfono. La frase da «riconoscere» si mette in `window.__simVoice`
 * (una lista: ogni pressione ne usa una). Vedi docs/2026-11-10-dettatura.md.
 */
import type { VoiceEngine, VoiceProgress, VoiceResult } from './engine';

interface SimWindow {
  __simVoice?: string[];
  /** Il modello simulato è già «scaricato». */
  __simVoiceDownloaded?: boolean;
  /** Ritardo del riconoscimento in ms, per provare l'avviso di lentezza. */
  __simVoiceDelayMs?: number;
}

const sim = () => window as unknown as SimWindow;

export class SimulatedVoice implements VoiceEngine {
  private phrase = '';
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready: Promise<void> | null = null;

  prepare(onProgress?: VoiceProgress): Promise<void> {
    this.ready ??= (async () => {
      onProgress?.('Scaricamento (simulato)…', 0.5);
      await new Promise((r) => setTimeout(r, 50));
      sim().__simVoiceDownloaded = true;
    })();
    return this.ready;
  }

  start(onPartial: (text: string) => void): Promise<void> {
    this.phrase = sim().__simVoice?.shift() ?? 'tubo diametro venti';
    this.startedAt = performance.now();
    const firstWords = this.phrase.split(' ').slice(0, 2).join(' ');
    this.timer = setTimeout(() => onPartial(firstWords), 50);
    return Promise.resolve();
  }

  async stop(): Promise<VoiceResult> {
    if (this.timer) clearTimeout(this.timer);
    const audioMs = performance.now() - this.startedAt;
    const delay = sim().__simVoiceDelayMs ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    return { text: this.phrase, audioMs, ms: delay };
  }

  closeMic(): void {}
}
