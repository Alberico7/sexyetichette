/**
 * Audio per la prova della dettatura: entrambi i motori (Whisper e Vosk) vogliono
 * campioni mono a 16 kHz. Vedi docs/2026-11-10-prova-dettatura.md.
 */
export const TARGET_RATE = 16000;

/** Unisce i pezzi registrati in un solo array. */
export function concat(chunks: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Media dei canali: da stereo (o più) a mono. */
export function toMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first.slice();
  const out = new Float32Array(first.length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i]! += (ch[i] ?? 0) / channels.length;
  return out;
}

/**
 * Cambia la frequenza di campionamento. Scendendo (es. 48 → 16 kHz) ogni campione
 * è la media dei campioni originali che copre: un filtro semplice che evita la
 * maggior parte del rumore di aliasing. Salendo interpola linearmente.
 */
export function resample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return input.slice();
  const outLength = Math.round((input.length * toRate) / fromRate);
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  if (ratio > 1) {
    for (let i = 0; i < outLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += input[j]!;
      out[i] = sum / (end - start);
    }
  } else {
    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio;
      const j = Math.floor(pos);
      const a = input[j] ?? 0;
      const b = input[j + 1] ?? a;
      out[i] = a + (b - a) * (pos - j);
    }
  }
  return out;
}

/** Durata in millisecondi di `samples` campioni a `rate` Hz. */
export function durationMs(samples: number, rate = TARGET_RATE): number {
  return (samples / rate) * 1000;
}

/** Tempo di riconoscimento diviso durata della frase: sotto 1 è più veloce del parlato. */
export function realTimeFactor(processingMs: number, audioMs: number): number {
  return audioMs > 0 ? processingMs / audioMs : NaN;
}

/** «1,23 s» con la virgola, come nel resto dell'app. */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
}

/** «12,3 MB». */
export function megabytes(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB`;
}
