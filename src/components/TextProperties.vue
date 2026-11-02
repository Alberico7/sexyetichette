<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { HorizontalAlign, TextElement, VerticalAlign } from '@/model/types';
import { useDocumentStore } from '@/stores/document';
import { DIAMETER_SYMBOL, insertAtSelection } from '@/model/text';

const props = defineProps<{ element: TextElement }>();
const store = useDocumentStore();

const FONTS = [
  { value: 'sans-serif', label: 'Senza grazie' },
  { value: 'serif', label: 'Con grazie' },
  { value: 'monospace', label: 'Monospaziato' },
  { value: 'system-ui', label: 'Di sistema' },
];

function update(patch: Partial<TextElement>): void {
  store.updateElement(props.element.id, patch);
}

const aligns: { value: HorizontalAlign; label: string }[] = [
  { value: 'left', label: 'Sinistra' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Destra' },
];
const vAligns: { value: VerticalAlign; label: string }[] = [
  { value: 'top', label: 'Alto' },
  { value: 'middle', label: 'Centro' },
  { value: 'bottom', label: 'Basso' },
];

const size = computed({
  get: () => props.element.fontSizePt,
  set: (v: number) => {
    if (Number.isFinite(v) && v > 0) update({ fontSizePt: Math.min(200, Math.max(4, v)) });
  },
});

const textarea = ref<HTMLTextAreaElement | null>(null);

/** Inserisce un simbolo dove si trova il cursore (o al posto del testo selezionato). */
async function insertSymbol(symbol: string): Promise<void> {
  const el = textarea.value;
  const edit = insertAtSelection(props.element.text, symbol, el?.selectionStart ?? null, el?.selectionEnd ?? null);
  update({ text: edit.text });
  await nextTick();
  if (el) {
    el.focus();
    el.setSelectionRange(edit.cursor, edit.cursor);
  }
}

function rotate90(): void {
  update({ rotation: (Math.round(props.element.rotation / 90) * 90 + 90) % 360 });
}
</script>

<template>
  <label class="field">
    Testo
    <textarea
      ref="textarea"
      :value="element.text"
      rows="3"
      data-testid="text-input"
      @input="update({ text: ($event.target as HTMLTextAreaElement).value })"
    />
  </label>

  <div class="row symbols">
    <button
      type="button"
      data-testid="insert-diameter"
      aria-label="Inserisci il simbolo del diametro"
      @pointerdown.prevent
      @click="insertSymbol(DIAMETER_SYMBOL)"
    >
      <span class="symbol" aria-hidden="true">{{ DIAMETER_SYMBOL }}</span> Diametro
    </button>
  </div>

  <div class="row">
    <label class="field grow">
      Carattere
      <select :value="element.fontFamily" @change="update({ fontFamily: ($event.target as HTMLSelectElement).value })">
        <option v-for="f in FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </label>
    <label class="field size">
      Dimensione (pt)
      <input v-model.number="size" type="number" inputmode="decimal" min="4" max="200" step="1" />
    </label>
  </div>

  <div class="row">
    <div class="segmented grow" role="group" aria-label="Stile">
      <button type="button" :aria-pressed="element.bold" @click="update({ bold: !element.bold })"><b>G</b> Grassetto</button>
      <button type="button" :aria-pressed="element.italic" @click="update({ italic: !element.italic })"><i>C</i> Corsivo</button>
    </div>
  </div>

  <div class="field">
    Allineamento orizzontale
    <div class="segmented" role="group" aria-label="Allineamento orizzontale">
      <button
        v-for="a in aligns"
        :key="a.value"
        type="button"
        :aria-pressed="element.align === a.value"
        @click="update({ align: a.value })"
      >
        {{ a.label }}
      </button>
    </div>
  </div>

  <div class="field">
    Allineamento verticale
    <div class="segmented" role="group" aria-label="Allineamento verticale">
      <button
        v-for="a in vAligns"
        :key="a.value"
        type="button"
        :aria-pressed="element.verticalAlign === a.value"
        @click="update({ verticalAlign: a.value })"
      >
        {{ a.label }}
      </button>
    </div>
  </div>

  <div class="row">
    <button type="button" class="grow" :aria-pressed="element.invert" @click="update({ invert: !element.invert })">
      {{ element.invert ? 'Bianco su nero ✓' : 'Bianco su nero' }}
    </button>
    <button type="button" class="grow" @click="rotate90">Ruota 90°</button>
  </div>
</template>

<style scoped>
.symbols {
  margin-top: -6px;
}

.symbol {
  font-size: 1.2rem;
  font-weight: 600;
}

.size {
  width: 120px;
  flex: none;
}
</style>
