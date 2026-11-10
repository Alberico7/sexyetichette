/**
 * Pagina di prova della dettatura: misura Whisper e Vosk sul telefono.
 * Vedi docs/2026-11-10-prova-dettatura.md.
 */
import '@/styles/base.css';
import './style.css';
import { APP_BUILD } from '@/app-info';
import { TARGET_RATE, concat, durationMs, megabytes, realTimeFactor, resample, seconds } from '@/voice/audio';
import type { WhisperReply, WhisperRequest } from './whisper-worker';

/** Dimensione approssimativa da scaricare, in MB (encoder + decoder, da Hugging Face). */
const WHISPER_MB: Record<string, Record<'q8' | 'fp16', number>> = {
  tiny: { q8: 41, fp16: 76 },
  base: { q8: 77, fp16: 146 },
  small: { q8: 249, fp16: 485 },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const infoEl = $<HTMLDListElement>('info');
const engineSel = $<HTMLSelectElement>('engine');
const deviceSel = $<HTMLSelectElement>('device');
const dtypeSel = $<HTMLSelectElement>('dtype');
const whisperOpts = $<HTMLDivElement>('whisper-options');
const sizeEl = $<HTMLParagraphElement>('size');
const loadBtn = $<HTMLButtonElement>('load');
const progressEl = $<HTMLProgressElement>('progress');
const statusEl = $<HTMLParagraphElement>('status');
const talkBtn = $<HTMLButtonElement>('talk');
const textEl = $<HTMLParagraphElement>('text');
const trialsEl = $<HTMLOListElement>('trials');

// ---------- Caratteristiche del browser ----------

const info: [string, string][] = [];

function showInfo() {
  infoEl.replaceChildren(
    ...info.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

async function collectInfo() {
  info.push(['Browser', navigator.userAgent]);
  info.push(['Core del processore', String(navigator.hardwareConcurrency ?? '?')]);
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  info.push(['Memoria', mem ? `${mem} GB (circa)` : 'non dichiarata']);
  info.push(['Più core insieme', self.crossOriginIsolated ? 'sì' : 'no (pagina non isolata)']);

  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) info.push(['Scheda grafica (WebGPU)', 'assente']);
  else {
    try {
      const adapter = (await gpu.requestAdapter()) as {
        features: Set<string>;
        info?: { vendor?: string; architecture?: string; description?: string };
      } | null;
      if (!adapter) info.push(['Scheda grafica (WebGPU)', 'presente ma senza adattatore']);
      else {
        const i = adapter.info;
        const name = [i?.vendor, i?.architecture, i?.description].filter(Boolean).join(' ') || 'senza nome';
        info.push([
          'Scheda grafica (WebGPU)',
          `sì: ${name}; fp16: ${adapter.features.has('shader-f16') ? 'sì' : 'no'}`,
        ]);
      }
    } catch (e) {
      info.push(['Scheda grafica (WebGPU)', `errore: ${String(e)}`]);
    }
  }

  const SR = speechRecognition();
  info.push([
    SR_LABEL,
    !SR ? 'assente' : typeof SR.available === 'function' ? 'presente (premi «Controlla»)' : 'presente',
  ]);
  checkSrBtn.hidden = !SR || typeof SR.available !== 'function';
  showInfo();
}

const SR_LABEL = 'Riconoscimento del browser';
const checkSrBtn = $<HTMLButtonElement>('check-sr');

function speechRecognition() {
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    { available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> } | undefined;
}

/**
 * Chiede al browser se riconosce l'italiano senza Internet. In Chromium per computer
 * questa domanda fa chiudere la pagina: per questo non parte da sola, ma con un pulsante.
 */
async function checkSpeechRecognition() {
  let local: string;
  try {
    local = (await speechRecognition()?.available?.({ langs: ['it-IT'], processLocally: true })) ?? 'non dichiarato';
  } catch (e) {
    local = `errore: ${String(e)}`;
  }
  const row = info.find(([k]) => k === SR_LABEL);
  if (row) row[1] = `presente; italiano senza Internet: ${local}`;
  showInfo();
}

checkSrBtn.addEventListener('click', () => void checkSpeechRecognition());

// ---------- Motori ----------

interface Engine {
  label: string;
  /** Pezzo di audio a 16 kHz mentre si parla (Vosk lo elabora subito). */
  feed(chunk: Float32Array): void;
  /** Fine della frase: restituisce il testo e il tempo del riconoscimento. */
  finish(audio: Float32Array): Promise<{ text: string; ms: number }>;
  dispose(): void;
}

interface Load {
  label: string;
  downloadedBytes: number;
  loadMs: number;
  warmupMs?: number;
}

const loads: Load[] = [];
let engine: Engine | null = null;

function setStatus(text: string) {
  statusEl.textContent = text;
}

function loadWhisper(size: string, device: 'webgpu' | 'wasm', dtype: 'q8' | 'fp16'): Promise<Engine> {
  const label = `Whisper ${size} · ${device === 'webgpu' ? 'WebGPU' : 'WASM'} · ${dtype}`;
  const worker = new Worker(new URL('./whisper-worker.ts', import.meta.url), { type: 'module' });
  const files = new Map<string, { loaded: number; total: number }>();
  const pending = new Map<number, (r: { text: string; ms: number }) => void>();
  let nextId = 1;
  let failTranscribe: ((e: Error) => void) | null = null;

  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WhisperReply>) => {
      const m = e.data;
      if (m.type === 'progress') {
        files.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        progressEl.hidden = false;
        progressEl.value = total ? loaded / total : 0;
        setStatus(`Scaricamento: ${megabytes(loaded)} di ${megabytes(total)}`);
      } else if (m.type === 'loaded') {
        const downloadedBytes = [...files.values()].reduce((n, f) => n + f.total, 0);
        loads.push({ label, downloadedBytes, loadMs: m.loadMs, warmupMs: m.warmupMs });
        progressEl.hidden = true;
        resolve({
          label,
          feed() {},
          finish(audio) {
            const id = nextId++;
            return new Promise((res, rej) => {
              pending.set(id, res);
              failTranscribe = rej;
              const req: WhisperRequest = { type: 'transcribe', id, audio };
              worker.postMessage(req, [audio.buffer]);
            });
          },
          dispose: () => worker.terminate(),
        });
      } else if (m.type === 'result') {
        pending.get(m.id)?.({ text: m.text, ms: m.ms });
        pending.delete(m.id);
      } else if (m.type === 'error') {
        if (failTranscribe && pending.size) failTranscribe(new Error(m.message));
        else {
          worker.terminate();
          reject(new Error(m.message));
        }
      }
    };
    worker.onerror = (e) => reject(new Error(e.message || 'errore nel worker'));
    const req: WhisperRequest = { type: 'load', size, device, dtype };
    worker.postMessage(req);
  });
}

async function loadVosk(): Promise<Engine> {
  const label = 'Vosk italiano 0.22';
  const t0 = performance.now();
  // Libreria e modello si caricano solo qui: chi prova Whisper non li scarica.
  const [{ createModel }, { loadVoskModelFile }] = await Promise.all([
    import('vosk-browser'),
    import('@/voice/vosk-model'),
  ]);
  const file = await loadVoskModelFile((text, fraction) => {
    setStatus(text);
    progressEl.hidden = fraction === undefined;
    if (fraction !== undefined) progressEl.value = fraction;
  });
  progressEl.hidden = true;
  setStatus('Avvio di Vosk…');
  const model = await createModel(file.url, -1);
  URL.revokeObjectURL(file.url);
  loads.push({ label, downloadedBytes: file.downloadedBytes, loadMs: performance.now() - t0 });
  const rec = new model.KaldiRecognizer(TARGET_RATE);
  const segments: string[] = [];
  let finishing: ((text: string) => void) | null = null;
  rec.on('partialresult', (m) => {
    const partial = (m as { result: { partial: string } }).result.partial;
    if (partial) showText([...segments, partial].join(' '), true);
  });
  rec.on('result', (m) => {
    const text = (m as { result: { text: string } }).result.text;
    if (text) segments.push(text);
    if (finishing) {
      const done = finishing;
      finishing = null;
      done(segments.splice(0).join(' '));
    }
  });
  return {
    label,
    feed: (chunk) => rec.acceptWaveformFloat(chunk, TARGET_RATE),
    finish() {
      const t = performance.now();
      return new Promise((res) => {
        finishing = (text) => res({ text, ms: performance.now() - t });
        rec.retrieveFinalResult();
      });
    },
    dispose: () => model.terminate(),
  };
}

function selection() {
  const [kind, size = ''] = engineSel.value.split('-');
  return {
    kind: kind as 'whisper' | 'vosk',
    size,
    device: deviceSel.value as 'webgpu' | 'wasm',
    dtype: dtypeSel.value as 'q8' | 'fp16',
  };
}

function updateSize() {
  const s = selection();
  whisperOpts.hidden = s.kind !== 'whisper';
  sizeEl.textContent =
    s.kind === 'whisper'
      ? `Circa ${WHISPER_MB[s.size]![s.dtype]} MB da scaricare la prima volta.`
      : 'Circa 50 MB da scaricare la prima volta.';
}

async function loadSelected() {
  engine?.dispose();
  engine = null;
  talkBtn.disabled = true;
  loadBtn.disabled = true;
  const s = selection();
  try {
    engine = s.kind === 'whisper' ? await loadWhisper(s.size, s.device, s.dtype) : await loadVosk();
    const l = loads.at(-1)!;
    setStatus(
      `Pronto: ${l.label}. Caricato in ${seconds(l.loadMs)}` +
        (l.warmupMs !== undefined ? `, primo avvio ${seconds(l.warmupMs)}.` : '.'),
    );
    talkBtn.disabled = false;
  } catch (e) {
    setStatus(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    progressEl.hidden = true;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', () => void loadSelected());

for (const sel of [engineSel, deviceSel, dtypeSel]) sel.addEventListener('change', updateSize);

// ---------- Microfono ----------

let ctx: AudioContext | null = null;
let recording = false;
let chunks: Float32Array[] = [];

async function ensureMic(): Promise<void> {
  if (ctx) return;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let c: AudioContext;
  let src: MediaStreamAudioSourceNode;
  try {
    // A 16 kHz il browser converte da sé; se non può, si converte qui (resample).
    c = new AudioContext({ sampleRate: TARGET_RATE });
    src = c.createMediaStreamSource(stream);
  } catch {
    c = new AudioContext();
    src = c.createMediaStreamSource(stream);
  }
  const proc = c.createScriptProcessor(2048, 1, 1);
  const mute = c.createGain();
  mute.gain.value = 0;
  src.connect(proc);
  proc.connect(mute);
  mute.connect(c.destination);
  proc.onaudioprocess = (ev) => {
    if (!recording) return;
    const chunk = resample(ev.inputBuffer.getChannelData(0), c.sampleRate);
    chunks.push(chunk);
    engine?.feed(chunk);
  };
  ctx = c;
}

function showText(text: string, partial = false) {
  textEl.textContent = text;
  textEl.classList.toggle('partial', partial);
}

interface Trial {
  label: string;
  audioMs: number;
  ms: number;
  text: string;
}
const trials: Trial[] = [];

function renderTrials() {
  trialsEl.replaceChildren(
    ...trials.map((t) => {
      const li = document.createElement('li');
      li.append(`«${t.text || '(niente)'}» `);
      const small = document.createElement('small');
      small.textContent = `${t.label} · frase ${seconds(t.audioMs)} · riconoscimento ${seconds(t.ms)} (${realTimeFactor(t.ms, t.audioMs).toFixed(2).replace('.', ',')}×)`;
      li.append(small);
      return li;
    }),
  );
}

let pressing = false;

async function startTalk(e: PointerEvent) {
  e.preventDefault();
  if (!engine || pressing) return;
  pressing = true;
  try {
    await ensureMic();
    await ctx!.resume();
  } catch (err) {
    pressing = false;
    setStatus(`Microfono non disponibile: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (!pressing) return; // lasciato mentre si chiedeva il permesso
  chunks = [];
  recording = true;
  talkBtn.classList.add('on');
  talkBtn.textContent = 'Ascolto… lascia per finire';
  showText('');
}

async function stopTalk() {
  if (!pressing) return;
  pressing = false;
  if (!recording) return;
  talkBtn.classList.remove('on');
  talkBtn.textContent = 'Riconoscimento…';
  talkBtn.disabled = true;
  // Ancora un attimo di ascolto: l'ultimo pezzo di audio arriva con un piccolo ritardo.
  await new Promise((r) => setTimeout(r, 200));
  recording = false;
  const audio = concat(chunks);
  chunks = [];
  const audioMs = durationMs(audio.length);
  const current = engine!;
  try {
    const { text, ms } = await current.finish(audio);
    showText(text);
    trials.push({ label: current.label, audioMs, ms, text });
    renderTrials();
  } catch (err) {
    setStatus(`Errore: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    talkBtn.textContent = 'Tieni premuto e parla';
    talkBtn.disabled = false;
  }
}

talkBtn.addEventListener('pointerdown', (e) => void startTalk(e));
talkBtn.addEventListener('pointerup', () => void stopTalk());
talkBtn.addEventListener('pointercancel', () => void stopTalk());
talkBtn.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Risultati ----------

function resultsText(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const lines = [
    `Rubeculabel – prova dettatura ${stamp}`,
    `App ${APP_BUILD.version} (${APP_BUILD.commit}${APP_BUILD.builtAt ? `, build ${APP_BUILD.builtAt}` : ''})`,
    '',
    ...info.map(([k, v]) => `${k}: ${v}`),
    '',
    `Caricamenti (${loads.length}):`,
    ...loads.map(
      (l) =>
        `  ${l.label}: ${megabytes(l.downloadedBytes)}, caricato in ${seconds(l.loadMs)}` +
        (l.warmupMs !== undefined ? `, primo avvio ${seconds(l.warmupMs)}` : ''),
    ),
    '',
    `Prove (${trials.length}):`,
    ...trials.map(
      (t, i) =>
        `  ${i + 1}. ${t.label} · frase ${seconds(t.audioMs)} · riconoscimento ${seconds(t.ms)} (${realTimeFactor(t.ms, t.audioMs).toFixed(2).replace('.', ',')}×): «${t.text}»`,
    ),
  ];
  return lines.join('\n');
}

async function copyResults() {
  const text = resultsText();
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Risultati copiati.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    setStatus('Risultati copiati.');
  }
}

$<HTMLButtonElement>('copy').addEventListener('click', () => void copyResults());

$<HTMLButtonElement>('clear').addEventListener('click', () => {
  trials.length = 0;
  renderTrials();
  showText('');
});

updateSize();
void collectInfo();
