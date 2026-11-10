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

/**
 * Raccolta dell'audio fuori dal filo principale della pagina (AudioWorklet, al posto del
 * vecchio ScriptProcessorNode). Manda pezzi da 1024 campioni; con «flush» consegna anche
 * l'ultimo pezzo, quando si lascia il pulsante. Caricato come Blob: niente file in più.
 * Vedi docs/2026-11-10-manutenibilita.md (punto 6).
 */
const CAPTURE = 'rubeculabel-capture';
const CAPTURE_WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1024);
    this.n = 0;
    this.port.onmessage = () => this.send();
  }
  send() {
    if (this.n) this.port.postMessage(this.buf.slice(0, this.n));
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) this.send();
      }
    }
    return true;
  }
}
registerProcessor('${CAPTURE}', Capture);
`;

export class VoskVoice implements VoiceEngine {
  private ready: Promise<void> | null = null;
  private rec: Recognizer | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
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
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const capture = new AudioWorkletNode(ctx, CAPTURE, { numberOfInputs: 1, numberOfOutputs: 1 });
    // Collegato all'uscita a volume zero, così il browser lo fa lavorare.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(capture);
    capture.connect(mute);
    mute.connect(ctx.destination);
    capture.port.onmessage = (ev: MessageEvent<Float32Array>) => {
      if (!this.listening || !this.rec) return;
      const chunk = resample(ev.data, ctx.sampleRate);
      this.samples += chunk.length;
      this.rec.acceptWaveformFloat(chunk, TARGET_RATE);
    };
    this.ctx = ctx;
    this.stream = stream;
    this.capture = capture;
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
    // Ancora un attimo di ascolto, poi l'ultimo pezzo raccolto: le ultime sillabe non si perdono.
    await new Promise((r) => setTimeout(r, 150));
    this.capture?.port.postMessage('flush');
    await new Promise((r) => setTimeout(r, 50));
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
    this.capture = null;
  }
}
