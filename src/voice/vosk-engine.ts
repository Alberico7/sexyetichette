/**
 * Dettatura con Vosk (modello italiano 0.22) e il microfono del telefono.
 * Caricato solo alla prima dettatura: vosk-browser pesa 5,8 MB.
 * Vedi docs/2026-11-10-dettatura.md.
 */
import { createModel, type Model } from 'vosk-browser';
import { TARGET_RATE, durationMs, resample } from './audio';
import type { VoiceEngine, VoiceProgress, VoiceResult } from './engine';
import { loadVoskModelFile } from './vosk-model';

type Recognizer = InstanceType<Model['KaldiRecognizer']>;

export class VoskVoice implements VoiceEngine {
  private ready: Promise<void> | null = null;
  private rec: Recognizer | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private listening = false;
  private samples = 0;
  private segments: string[] = [];
  private onPartial: ((text: string) => void) | null = null;
  private finishing: ((text: string) => void) | null = null;

  prepare(onProgress?: VoiceProgress): Promise<void> {
    this.ready ??= this.load(onProgress ?? (() => {})).catch((e: unknown) => {
      this.ready = null; // si potrà riprovare
      throw e;
    });
    return this.ready;
  }

  private async load(onProgress: VoiceProgress): Promise<void> {
    const file = await loadVoskModelFile(onProgress);
    onProgress('Preparazione del riconoscimento…');
    const model = await createModel(file.url, -1);
    URL.revokeObjectURL(file.url);
    const rec = new model.KaldiRecognizer(TARGET_RATE);
    rec.on('partialresult', (m) => {
      const partial = (m as { result: { partial: string } }).result.partial;
      if (partial && this.listening) this.onPartial?.([...this.segments, partial].join(' '));
    });
    rec.on('result', (m) => {
      const text = (m as { result: { text: string } }).result.text;
      if (text) {
        this.segments.push(text);
        if (this.listening) this.onPartial?.(this.segments.join(' '));
      }
      if (this.finishing) {
        const done = this.finishing;
        this.finishing = null;
        done(this.segments.splice(0).join(' '));
      }
    });
    this.rec = rec;
  }

  private async openMic(): Promise<void> {
    if (this.ctx && this.stream?.active) return;
    this.closeMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    let ctx: AudioContext;
    let src: MediaStreamAudioSourceNode;
    try {
      // A 16 kHz il browser converte da sé; se non può, si converte qui.
      ctx = new AudioContext({ sampleRate: TARGET_RATE });
      src = ctx.createMediaStreamSource(stream);
    } catch {
      ctx = new AudioContext();
      src = ctx.createMediaStreamSource(stream);
    }
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    proc.onaudioprocess = (ev) => {
      if (!this.listening || !this.rec) return;
      const chunk = resample(ev.inputBuffer.getChannelData(0), ctx.sampleRate);
      this.samples += chunk.length;
      this.rec.acceptWaveformFloat(chunk, TARGET_RATE);
    };
    this.ctx = ctx;
    this.stream = stream;
  }

  async start(onPartial: (text: string) => void): Promise<void> {
    await this.prepare();
    await this.openMic();
    await this.ctx!.resume();
    this.onPartial = onPartial;
    this.segments = [];
    this.samples = 0;
    this.listening = true;
  }

  async stop(): Promise<VoiceResult> {
    if (!this.listening || !this.rec) return { text: '', audioMs: 0, ms: 0 };
    // Ancora un attimo di ascolto: l'ultimo pezzo di audio arriva con un piccolo ritardo.
    await new Promise((r) => setTimeout(r, 200));
    this.listening = false;
    const audioMs = durationMs(this.samples);
    const t0 = performance.now();
    const rec = this.rec;
    const text = await new Promise<string>((res) => {
      this.finishing = res;
      rec.retrieveFinalResult();
    });
    return { text, audioMs, ms: performance.now() - t0 };
  }

  closeMic(): void {
    this.listening = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
  }
}
