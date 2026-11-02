<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { LW550_HEAD, sameMediaSize } from '@/printer/media';
import { MAX_COPIES, clampCopies } from '@/printer/print-flow';
import { countBlack } from '@/printer/raster';
import type { Density } from '@/printer/types';
import { prepareLabel, type PreparedLabel } from '@/render/export';
import { paintPreview } from '@/render/preview';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';
import { dotsToMm } from '@/model/units';

const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ printed: [] }>();

const store = useDocumentStore();
const printer = usePrinterStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const prepared = ref<PreparedLabel | null>(null);
const rendering = ref(false);
const renderError = ref<string | null>(null);
const actualSize = ref(false);

const densities: { value: Density; label: string }[] = [
  { value: 'light', label: 'Chiara' },
  { value: 'medium', label: 'Media' },
  { value: 'normal', label: 'Normale' },
  { value: 'high', label: 'Scura' },
];

async function refresh(): Promise<void> {
  rendering.value = true;
  renderError.value = null;
  try {
    const result = await prepareLabel(store.doc, LW550_HEAD);
    prepared.value = result;
    await nextTick();
    if (canvas.value) paintPreview(canvas.value, result.wireBitmap, result.geometry);
  } catch (err) {
    renderError.value = err instanceof Error ? err.message : String(err);
  } finally {
    rendering.value = false;
  }
}

watch(
  () => props.active,
  (a) => {
    if (a) void refresh();
  },
  { immediate: true },
);

const isEmpty = computed(() => (prepared.value ? countBlack(prepared.value.wireBitmap) === 0 : false));
const mismatch = computed(() => printer.detected && !sameMediaSize(printer.detected.media, store.doc.media));
const sizeText = computed(() => {
  const g = store.geometry;
  const mm = (d: number) => dotsToMm(d).toFixed(1).replace('.', ',');
  return `${mm(g.label.width)} × ${mm(g.label.height)} mm · area stampabile ${g.printable.width} × ${g.printable.height} punti`;
});

const canPrint = computed(
  () =>
    printer.state === 'connected' &&
    printer.blockingProblems.length === 0 &&
    !!prepared.value &&
    !rendering.value,
);

function step(delta: number): void {
  printer.copies = clampCopies(printer.copies + delta);
}

async function doPrint(): Promise<void> {
  const ok = await printer.print(store.doc);
  if (ok) emit('printed');
}
</script>

<template>
  <div class="preview-wrap" :class="{ actual: actualSize }">
    <canvas ref="canvas" class="preview" data-testid="preview-canvas" aria-label="Anteprima in bianco e nero" />
    <p v-if="rendering" class="muted">Preparazione anteprima…</p>
    <p v-if="renderError" class="error">Errore nell'anteprima: {{ renderError }}</p>
  </div>
  <div class="row meta">
    <small class="grow">{{ sizeText }}</small>
    <button type="button" @click="actualSize = !actualSize">{{ actualSize ? 'Adatta' : '1:1' }}</button>
  </div>
  <p class="muted note">
    Anteprima alla risoluzione reale (300 dpi), in bianco e nero come verrà stampata. La zona rossa
    non è raggiungibile dalla testina.
  </p>

  <p v-if="isEmpty" class="warn">L'etichetta è vuota.</p>
  <p v-if="mismatch" class="warn" data-testid="mismatch-warning">
    Il formato scelto ({{ store.doc.media.name }}) non corrisponde al rotolo inserito
    ({{ printer.detected?.media.name }}).
  </p>
  <p v-if="printer.state === 'disconnected'" class="warn">Collega la stampante per stampare.</p>
  <p v-for="p in printer.blockingProblems" :key="p.code" class="error">{{ p.title }}: {{ p.hint }}</p>

  <div class="field">
    Copie
    <div class="row">
      <button type="button" aria-label="Una copia in meno" :disabled="printer.copies <= 1" @click="step(-1)">−</button>
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
      <button type="button" aria-label="Una copia in più" :disabled="printer.copies >= MAX_COPIES" @click="step(1)">+</button>
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
    type="button"
    class="primary print"
    data-testid="print-button"
    :disabled="!canPrint"
    @click="doPrint"
  >
    {{ printer.state === 'printing' ? 'Stampa in corso…' : printer.copies > 1 ? `Stampa ${printer.copies} copie` : 'Stampa' }}
  </button>
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
</style>
