<script setup lang="ts">
/**
 * Pannello del codice a barre (Code 128): contenuto, con la dettatura come per i testi,
 * testo sotto il codice, rotazione di 90° e avvisi. Vedi docs/2026-11-24-codici-a-barre.md.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import type { BarcodeElement } from '@/model/types';
import { keyboardSensitive } from '@/model/barcode';
import { insertAtSelection } from '@/model/text';
import { barcodeRotation, barcodeStatus } from '@/render/scene';
import { landscapePhone } from '@/screen-shape';
import { useDocumentStore } from '@/stores/document';
import DictationControl from '@/components/DictationControl.vue';

const props = defineProps<{ element: BarcodeElement; autofocus?: boolean }>();
const store = useDocumentStore();
const input = ref<HTMLInputElement | null>(null);

function update(patch: Partial<Omit<BarcodeElement, 'id' | 'type'>>): void {
  store.updateElement(props.element.id, patch);
}

const status = computed(() => barcodeStatus(props.element));
const mm = (v: number) => v.toFixed(0);

/**
 * Testo dettato: al cursore, attaccato a quello già scritto. In un codice articolo uno spazio
 * automatico sarebbe sbagliato («ART-» + «dodici» → «ART-12»), e un a capo non ha senso.
 */
async function insertDictated(text: string): Promise<void> {
  const el = input.value;
  const clean = text.replace(/\s*\n\s*/g, ' ');
  const edit = insertAtSelection(props.element.value, clean, el?.selectionStart ?? null, el?.selectionEnd ?? null);
  update({ value: edit.text });
  await nextTick();
  el?.setSelectionRange(edit.cursor, edit.cursor);
}

function rotate90(): void {
  update({ rotation: barcodeRotation(props.element.rotation + 90) });
}

// Codice nuovo: la tastiera compare subito, ma non in orizzontale sul telefono (come per i testi).
onMounted(() => {
  if (props.autofocus && input.value && !landscapePhone()) input.value.focus();
});
</script>

<template>
  <div class="text-row">
    <label class="field">
      Contenuto del codice (Code 128)
      <input
        ref="input"
        type="text"
        :value="element.value"
        placeholder="Es. ART-12345"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        enterkeyhint="done"
        data-testid="barcode-input"
        @input="update({ value: ($event.target as HTMLInputElement).value })"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </label>
    <DictationControl @text="insertDictated" />
  </div>

  <p v-if="status.error && element.value !== ''" class="error" role="alert" data-testid="barcode-error">
    {{ status.error }}
  </p>
  <p v-else-if="status.wideForReader" class="warn" role="status" data-testid="barcode-wide">
    Il codice è largo {{ mm(status.widthMm) }} mm: più della finestra del lettore dell'officina (90 mm). Si legge con il
    telefono, ma per il Datalogic Touch 90 accorcia il contenuto.
  </p>
  <p v-if="!status.error && keyboardSensitive(element.value)" class="note" data-testid="barcode-keyboard">
    Il lettore scrive come una tastiera: segni diversi da lettere, cifre, spazio e punto possono uscire diversi a
    seconda della tastiera configurata. Provalo una volta con il lettore.
  </p>

  <div class="row">
    <button
      type="button"
      class="toggle grow"
      data-testid="barcode-show-text"
      :aria-pressed="element.showText"
      @click="update({ showText: !element.showText })"
    >
      <span class="check" aria-hidden="true">{{ element.showText ? '✓' : '' }}</span>
      Testo sotto il codice
    </button>
    <button type="button" class="rotate" data-testid="barcode-rotate" @click="rotate90">Ruota 90°</button>
  </div>
</template>

<style scoped>
/* Casella con il microfono a destra; sotto, a tutta larghezza, la dettatura (come nel pannello del testo). */
.text-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}

.text-row input {
  font-size: 1.2rem;
  letter-spacing: 0.02em;
}

.error,
.warn,
.note {
  margin: -4px 0 0;
}

.error {
  color: var(--danger);
}

.warn {
  color: var(--warn);
}

.note {
  color: var(--muted);
  font-size: 0.9rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 8px 12px;
}

.toggle .check {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-weight: 700;
}

.toggle[aria-pressed='true'] .check {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.rotate {
  flex: none;
}

/* Orizzontale con la tastiera aperta: resta solo la casella (docs/2026-11-08-orizzontale-tastiera.md). */
@media (max-height: 260px) {
  :root[data-screen='landscape'] .row,
  :root[data-screen='landscape'] .note,
  :root[data-screen='landscape'] .warn {
    display: none;
  }
}
</style>
