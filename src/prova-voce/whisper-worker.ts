/**
 * Whisper in un worker, così la pagina non si blocca mentre il modello lavora.
 * Vedi docs/2026-11-10-prova-dettatura.md.
 */
import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;

export type WhisperRequest =
  | { type: 'load'; size: string; device: 'webgpu' | 'wasm'; dtype: 'q8' | 'fp16' }
  | { type: 'transcribe'; id: number; audio: Float32Array };

export type WhisperReply =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'loaded'; loadMs: number; warmupMs: number }
  | { type: 'result'; id: number; text: string; ms: number }
  | { type: 'error'; message: string };

type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

let asr: Asr | null = null;
const post = (m: WhisperReply) => self.postMessage(m);

async function run(audio: Float32Array): Promise<string> {
  const out = await asr!(audio, { language: 'italian', task: 'transcribe' });
  return (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim();
}

self.onmessage = async (e: MessageEvent<WhisperRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      const t0 = performance.now();
      asr = await pipeline('automatic-speech-recognition', `onnx-community/whisper-${msg.size}`, {
        device: msg.device,
        dtype: msg.dtype,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress' && p.file)
            post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
        },
      });
      const loadMs = performance.now() - t0;
      // Primo avvio a vuoto (1 s di silenzio): con la scheda grafica compila i calcoli,
      // così le prove misurano solo il riconoscimento.
      const t1 = performance.now();
      await run(new Float32Array(16000));
      post({ type: 'loaded', loadMs, warmupMs: performance.now() - t1 });
    } else if (msg.type === 'transcribe') {
      const t0 = performance.now();
      const text = await run(msg.audio);
      post({ type: 'result', id: msg.id, text, ms: performance.now() - t0 });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
