<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { usePrintWarnings } from '@/composables/quick-print';
import { MAX_COPIES, clampCopies } from '@/printer/print-flow';
import type { Density } from '@/printer/types';
import { paintPreview } from '@/render/preview';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';
import { useRecentStore } from '@/stores/recent';
import type { LabelDocument } from '@/model/types';
import type { PreparedLabel } from '@/render/export';
import { dotsToMm } from '@/model/units';

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ printed: [copies: number] }>();

const store = useDocumentStore();
const printer = usePrinterStore();
const preview = usePreviewStore();
const recent = useRecentStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const actualSize = ref(false);

const densities: { value: Density; label: string }[] = [
  { value: 'light', label: 'Chiara' },
  { value: 'medium', label: 'Media' },
  { value: 'normal', label: 'Normale' },
  { value: 'high', label: 'Scura' },
];

/** L'anteprima è calcolata in sottofondo: qui la si disegna soltanto. */
async function paint(): Promise<void> {
  await nextTick();
  const p = preview.prepared;
  if (props.active && p && canvas.value) paintPreview(canvas.value, p.wireBitmap, p.geometry);
}

watch(
  () => props.active,
  (a) => {
    if (!a) return;
    void paint();
    // Se il documento è cambiato da poco, completa subito il calcolo.
    if (!preview.ready) void preview.ensure().catch(() => {});
  },
  { immediate: true },
);
watch(
  () => preview.prepared,
  () => void paint(),
);

const rendering = computed(() => !preview.ready);
const isEmpty = computed(() => preview.ready && preview.inkDots === 0);
// Gli stessi avvisi fermano la stampa rapida (vedi composables/quick-print.ts).
const { mismatch, overflow } = usePrintWarnings();
const sizeText = computed(() => {
  const g = store.geometry;
  const mm = (d: number) => dotsToMm(d).toFixed(1).replace('.', ',');
  return `${mm(g.label.width)} × ${mm(g.label.height)} mm · area stampabile ${g.printable.width} × ${g.printable.height} punti`;
});

const canPrint = computed(
  () => printer.state === 'connected' && printer.blockingProblems.length === 0 && preview.prepared !== null,
);

/** Stampa da più copie in corso: il pulsante diventa «Ferma». */
const multiProgress = computed(() =>
  printer.state === 'printing' && printer.progress && printer.progress.total > 1 ? printer.progress : null,
);

function step(delta: number): void {
  printer.copies = clampCopies(printer.copies + delta);
}

async function doPrint(): Promise<void> {
  // Stampa esattamente il bitmap dell'anteprima (ricalcolato solo se il documento è cambiato).
  let printed: PreparedLabel | null = null;
  const snapshot = JSON.parse(JSON.stringify(store.doc)) as LabelDocument;
  const copies = printer.copies;
  const ok = await printer.print(snapshot, async () => (printed = await preview.ensure()));
  if (!ok) return;
  recent.add(snapshot, printed);
  emit('printed', copies);
}
</script>

<template>
  <!-- In verticale i due gruppi non contano (display: contents); in orizzontale sono due colonne. -->
  <div class="print-sheet">
    <div class="ps-preview">
      <div class="preview-wrap" :class="{ actual: actualSize }">
        <canvas ref="canvas" class="preview" data-testid="preview-canvas" aria-label="Anteprima in bianco e nero" />
        <p v-if="rendering" class="muted">Aggiornamento anteprima…</p>
        <p v-if="preview.error" class="error">Errore nell'anteprima: {{ preview.error }}</p>
      </div>
      <div class="row meta">
        <small class="grow">{{ sizeText }}</small>
        <button type="button" @click="actualSize = !actualSize">{{ actualSize ? 'Adatta' : '1:1' }}</button>
      </div>
      <p class="muted note">
        Anteprima alla risoluzione reale (300 dpi), in bianco e nero come verrà stampata. La zona rossa non è
        raggiungibile dalla testina.
      </p>
    </div>

    <div class="ps-controls">
      <p v-if="isEmpty" class="warn" data-testid="empty-warning">L'etichetta è vuota.</p>
      <p v-if="overflow" class="warn" data-testid="overflow-warning">
        Un testo non entra nel suo riquadro ed è stampato alla dimensione minima.
      </p>
      <p v-if="mismatch" class="warn" data-testid="mismatch-warning">
        Il formato scelto ({{ store.doc.media.name }}) non corrisponde al rotolo inserito ({{
          printer.detected?.media.name
        }}).
      </p>
      <p v-if="printer.state === 'disconnected'" class="warn">Collega la stampante per stampare.</p>
      <p v-for="p in printer.blockingProblems" :key="p.code" class="error">{{ p.title }}: {{ p.hint }}</p>

      <div class="field">
        Copie
        <div class="row">
          <button type="button" aria-label="Una copia in meno" :disabled="printer.copies <= 1" @click="step(-1)">
            −
          </button>
          <input
            v-model.number="printer.copies"
            class="copies"
            type="number"
            inputmode="numeric"
            min="1"
            :max="MAX_COPIES"
            aria-label="Numero di copie"
            @change="printer.copies = clampCopies(printer.copies)"
          />
          <button type="button" aria-label="Una copia in più" :disabled="printer.copies >= MAX_COPIES" @click="step(1)">
            +
          </button>
        </div>
      </div>

      <div class="field">
        Densità di stampa
        <div class="segmented" role="group" aria-label="Densità di stampa">
          <button
            v-for="d in densities"
            :key="d.value"
            type="button"
            :aria-pressed="printer.density === d.value"
            @click="printer.density = d.value"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <button
        v-if="multiProgress"
        type="button"
        class="danger print"
        data-testid="print-stop"
        :disabled="printer.stopRequested"
        @click="printer.requestStop()"
      >
        {{ printer.stopRequested ? 'Fermo…' : `Ferma · ${multiProgress.sent} di ${multiProgress.total}` }}
      </button>
      <button
        v-else
        type="button"
        class="primary print"
        data-testid="print-button"
        :disabled="!canPrint"
        @click="doPrint"
      >
        {{
          printer.state === 'printing'
            ? 'Stampa in corso…'
            : printer.copies > 1
              ? `Stampa ${printer.copies} copie`
              : 'Stampa'
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview-wrap {
  background: repeating-conic-gradient(var(--surface-2) 0 25%, var(--bg) 0 50%) 0 0 / 16px 16px;
  border-radius: var(--radius);
  padding: 12px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.preview-wrap.actual {
  overflow: auto;
  max-height: 50dvh;
  place-items: start;
}

.preview {
  max-width: 100%;
  height: auto;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.3);
  image-rendering: pixelated;
}

.actual .preview {
  max-width: none;
}

.meta small,
.muted {
  color: var(--muted);
}

.note {
  margin: 0;
  font-size: 0.85rem;
}

.warn {
  margin: 0;
  color: var(--warn);
}

.error {
  margin: 0;
  color: var(--danger);
}

.copies {
  width: 80px;
  text-align: center;
}

.print {
  width: 100%;
  min-height: 56px;
  font-size: 1.1rem;
}
.print-sheet,
.ps-preview,
.ps-controls {
  display: contents;
}

/* Orizzontale su telefono: anteprima a sinistra, impostazioni e Stampa a destra (docs/2026-11-08-orizzontale.md). */
@media (max-height: 600px) {
  :root[data-screen='landscape'] .print-sheet {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  :root[data-screen='landscape'] .ps-preview,
  :root[data-screen='landscape'] .ps-controls {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  /* «Stampa» sempre in vista anche se gli avvisi allungano la colonna. */
  :root[data-screen='landscape'] .print {
    position: sticky;
    bottom: 0;
    min-height: 52px;
  }
}
</style>
