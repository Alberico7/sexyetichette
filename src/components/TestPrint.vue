<script setup lang="ts">
/**
 * Stampa di prova: una sola etichetta con bordo, tacche e indicazioni di verso,
 * poi alcune domande le cui risposte finiscono nel testo condiviso.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { diagLog } from '@/diagnostics/log';
import { DENSITY_NAMES, formatSize } from '@/diagnostics/printer-check';
import { computeGeometry } from '@/model/geometry';
import { LW550_HEAD } from '@/printer/media';
import type { PrintJob } from '@/printer/types';
import { useDiagnosticsStore } from '@/stores/diagnostics';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';

const printer = usePrinterStore();
const store = useDocumentStore();
const diagnostics = useDiagnosticsStore();

const confirming = ref(false);
const busy = ref(false);

/** Formato usato: quello del rotolo se letto, altrimenti quello scelto. */
const media = computed(() => printer.detected?.media ?? store.doc.media);
const fromRoll = computed(() => Boolean(printer.detected));
const connected = computed(() => printer.state === 'connected');

const answers = computed(() => diagnostics.testPrint);
const along = computed(() => store.doc.direction === 'along');
const previewCanvas = ref<HTMLCanvasElement | null>(null);

function geometryNow() {
  return computeGeometry(media.value, store.doc.direction, store.doc.continuousLengthMm, LW550_HEAD);
}

/** Anteprima dell'etichetta di prova nel verso di lettura (solo area stampabile). */
async function drawPreview(): Promise<void> {
  const canvas = previewCanvas.value;
  if (!canvas) return;
  const { drawTestLabel } = await import('@/diagnostics/test-label');
  const image = drawTestLabel(geometryNow(), { format: formatSize(media.value), density: DENSITY_NAMES[printer.density] });
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  ctx.putImageData(data, 0, 0);
}

onMounted(() => void drawPreview());
watch([media, () => printer.density, () => store.doc.direction], () => void drawPreview());
const ticks = reactive({ left: '', right: '', top: '', bottom: '' });

const QUESTIONS = [
  {
    key: 'border',
    text: 'Il bordo esterno è completo su tutti e quattro i lati?',
    options: ['sì, completo', 'manca a sinistra', 'manca a destra', 'manca in alto', 'manca in basso', 'manca su più lati'],
  },
  {
    key: 'orientation',
    text: '',
    options: ['dritta', 'capovolta', 'girata di lato', 'specchiata', 'non stampata'],
  },
  {
    key: 'firstOut',
    text: 'Il lato con il triangolo è uscito per primo dalla stampante?',
    options: ['sì', 'no, è uscito per ultimo', 'non ho visto'],
  },
  {
    key: 'darkness',
    text: 'Com’è la stampa?',
    options: ['nitida', 'troppo chiara', 'troppo scura', 'a strisce o con buchi'],
  },
] as const;

type AnswerKey = (typeof QUESTIONS)[number]['key'];

function answer(key: AnswerKey, value: string): void {
  if (!diagnostics.testPrint) return;
  diagnostics.testPrint = { ...diagnostics.testPrint, [key]: value };
  diagLog.add('app', `Stampa di prova, risposta: ${key} = ${value}`);
}

function saveTicks(): void {
  if (!diagnostics.testPrint) return;
  diagnostics.testPrint = { ...diagnostics.testPrint, missingTicks: { ...ticks } };
}

async function print(): Promise<void> {
  confirming.value = false;
  busy.value = true;
  try {
    const m = media.value;
    const geometry = geometryNow();
    const density = DENSITY_NAMES[printer.density];
    // Disegno solo al momento della stampa (usa un canvas).
    const { prepareTestLabel } = await import('@/diagnostics/test-label');
    const prepared = prepareTestLabel(geometry, { format: formatSize(m), density });
    const job: PrintJob = {
      image: prepared.wireImage,
      media: m,
      labelLengthDots: geometry.feedDots,
      copies: 1,
      density: printer.density,
    };
    diagLog.add('app', `Stampa di prova: ${formatSize(m)} (${fromRoll.value ? 'dal rotolo' : 'formato scelto'}), ${prepared.blackDots} punti neri`);
    const ok = await printer.printJob(job);
    const result: NonNullable<typeof diagnostics.testPrint> = { printedAt: new Date(), format: formatSize(m), density };
    if (!ok) result.error = printer.error ? `${printer.error.title}${printer.error.detail ? ` (${printer.error.detail})` : ''}` : 'stampa non riuscita';
    diagnostics.testPrint = result;
    ticks.left = ticks.right = ticks.top = ticks.bottom = '';
  } catch (err) {
    diagnostics.testPrint = { printedAt: new Date(), error: err instanceof Error ? err.message : String(err) };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <p class="intro">
    Stampa <strong>una</strong> etichetta con un bordo sul limite dell’area stampabile, tacche ogni millimetro, la
    scritta «ALTO», gli angoli numerati 1–4 e un triangolo sul lato che dovrebbe uscire per primo. Serve a verificare
    verso, margini e allineamento.
  </p>
  <p class="format" data-testid="test-format">
    Formato: <strong>{{ media.name }}</strong> ({{ fromRoll ? 'letto dal rotolo' : 'scelto nell’app: rotolo non letto' }}) ·
    densità {{ DENSITY_NAMES[printer.density] }}
  </p>

  <canvas ref="previewCanvas" class="preview" aria-label="Anteprima dell’etichetta di prova" data-testid="test-preview" />

  <p v-if="!connected && !busy" class="muted">Collega la stampante per stampare l’etichetta di prova.</p>

  <div v-if="confirming" class="confirm" role="alertdialog" aria-label="Conferma stampa di prova">
    <p>Stampare 1 etichetta di prova su «{{ media.name }}»?</p>
    <div class="row">
      <button type="button" class="grow" @click="confirming = false">Annulla</button>
      <button type="button" class="grow primary" data-testid="test-print-confirm" @click="print">Sì, stampa</button>
    </div>
  </div>
  <button
    v-else
    type="button"
    class="primary"
    data-testid="test-print"
    :disabled="!connected || busy"
    @click="confirming = true"
  >
    {{ busy ? 'Stampa in corso…' : answers?.printedAt ? 'Stampa un’altra etichetta di prova' : 'Stampa un’etichetta di prova' }}
  </button>

  <section v-if="answers?.printedAt" class="questions" data-testid="test-questions">
    <p v-if="answers.error" class="warn" role="alert">Stampa non riuscita: {{ answers.error }}</p>
    <template v-else>
      <h3>Guarda l’etichetta e rispondi</h3>
      <fieldset v-for="q in QUESTIONS" :key="q.key">
        <legend>
          {{
            q.key === 'orientation'
              ? `Girando l’etichetta in modo che il triangolo sia ${along ? 'a sinistra' : 'in alto'}, la scritta «ALTO» è…`
              : q.text
          }}
        </legend>
        <div class="choices">
          <button
            v-for="o in q.options"
            :key="o"
            type="button"
            :aria-pressed="answers[q.key] === o"
            :data-testid="`answer-${q.key}`"
            @click="answer(q.key, o)"
          >
            {{ o }}
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Su ogni lato, fino a quale tacca (mm) manca o è tagliata la stampa? Lascia vuoto se è tutto visibile.</legend>
        <div class="ticks">
          <label class="field">Sinistra <input v-model="ticks.left" inputmode="decimal" data-testid="ticks-left" @change="saveTicks" /></label>
          <label class="field">Destra <input v-model="ticks.right" inputmode="decimal" @change="saveTicks" /></label>
          <label class="field">Alto <input v-model="ticks.top" inputmode="decimal" @change="saveTicks" /></label>
          <label class="field">Basso <input v-model="ticks.bottom" inputmode="decimal" @change="saveTicks" /></label>
        </div>
      </fieldset>
      <p class="muted">Le risposte finiscono nel testo di «Condividi tutto», in fondo al pannello.</p>
    </template>
  </section>
</template>

<style scoped>
.intro,
.format {
  margin: 0;
  font-size: 0.95rem;
}

.muted {
  margin: 0;
  color: var(--muted);
}

.warn {
  margin: 0;
  color: var(--warn);
}

.confirm {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
}

.confirm p {
  margin: 0;
}

.preview {
  display: block;
  max-width: 100%;
  max-height: 160px;
  margin: 0 auto;
  border: 1px solid var(--border);
  background: #fff;
  image-rendering: pixelated;
}

.questions {
  display: grid;
  gap: 10px;
}

.questions h3 {
  margin: 0;
  font-size: 1rem;
}

fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 10px 10px;
  margin: 0;
  min-width: 0;
}

legend {
  padding: 0 4px;
  font-size: 0.92rem;
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.choices button {
  min-height: 40px;
  padding: 0 10px;
  font-size: 0.9rem;
}

.choices button[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
  font-weight: 600;
}

.ticks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ticks input {
  width: 100%;
  min-width: 0;
}
</style>
