<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { HorizontalAlign, TextElement, VerticalAlign } from '@/model/types';
import { useDocumentStore } from '@/stores/document';
import {
  DIAMETER_45_SIGN,
  DIAMETER_SIGN,
  REJECT_WORD,
  UNREPAIRABLE_TEXT,
  insertAtSelection,
  replaceHeartCode,
  type TextEdit,
} from '@/model/text';
import { insertDictation } from '@/voice/dictation';
import { useDictation } from '@/voice/useDictation';
import { resolveFontSize } from '@/render/scene';
import { landscapePhone, screenShape } from '@/screen-shape';
import { FONT_OPTIONS } from '@/model/fonts';

const props = defineProps<{ element: TextElement; autofocus?: boolean }>();
const store = useDocumentStore();

const FONTS = FONT_OPTIONS;

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

/** Dimensione effettiva (calcolata se l'adattamento automatico è attivo). */
const fitted = computed(() => resolveFontSize(props.element));

function toggleAutoFit(): void {
  if (props.element.autoFit) {
    // Riparte dalla dimensione calcolata, così il testo non cambia di colpo.
    update({ autoFit: false, fontSizePt: fitted.value.sizePt });
  } else {
    update({ autoFit: true });
  }
}

/** Dimensione mostrata: quella calcolata se l'adattamento è attivo, altrimenti quella scelta. */
const size = computed(() => (props.element.autoFit ? fitted.value.sizePt : props.element.fontSizePt));

const MIN_PT = 4;
const MAX_PT = 200;

/**
 * Una dimensione scritta a mano spegne l'adattamento automatico.
 * Valori non validi (vuoto, fuori da 4–200) vengono ignorati: così anche
 * le cifre intermedie mentre si scrive (es. «1» prima di «18») non cambiano nulla.
 */
function onSizeInput(event: Event): void {
  const v = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(v) || v < MIN_PT || v > MAX_PT) return;
  update({ autoFit: false, fontSizePt: v });
}

/** All'uscita dal campo, un valore non valido torna a quello effettivo. */
function onSizeBlur(event: Event): void {
  (event.target as HTMLInputElement).value = String(size.value);
}

const textarea = ref<HTMLTextAreaElement | null>(null);

/** Inserisce un simbolo dove si trova il cursore (o al posto del testo selezionato); in verticale rimette il cursore nella casella. */
function insertSymbol(symbol: string): Promise<void> {
  return insertAtCursor((text, start, end) => insertAtSelection(text, symbol, start, end));
}

/** Inserimento al cursore comune a simboli e dettatura. */
async function insertAtCursor(
  make: (text: string, start: number | null, end: number | null) => TextEdit,
): Promise<void> {
  const el = textarea.value;
  const edit = make(props.element.text, el?.selectionStart ?? null, el?.selectionEnd ?? null);
  // In orizzontale la tastiera coprirebbe quasi tutto: si inserisce senza riaprirla.
  // Su Android, chiusa la tastiera con «giù», la casella resta attiva e cambiarne il testo
  // può riaprirla: prima la si disattiva. Vedi docs/2026-11-08-orizzontale-tastiera.md.
  const landscape = screenShape() === 'landscape';
  if (landscape) el?.blur();
  update({ text: edit.text });
  await nextTick();
  if (!el) return;
  if (!landscape) el.focus();
  // Il cursore va comunque dopo il simbolo (resta anche con la casella non attiva).
  el.setSelectionRange(edit.cursor, edit.cursor);
}

/** Testo scritto nella casella; i codici nascosti «#<3*» e «#<3-» diventano ♥ e ♡ (docs/2026-11-08-cuore-nascosto.md, docs/2026-11-09-cuore-vuoto.md). */
async function onTextInput(event: Event): Promise<void> {
  const el = event.target as HTMLTextAreaElement;
  const edit = replaceHeartCode(el.value, el.selectionStart);
  if (!edit) {
    update({ text: el.value });
    return;
  }
  update({ text: edit.text });
  el.value = edit.text;
  await nextTick();
  el.setSelectionRange(edit.cursor, edit.cursor);
}

// Dettatura: il testo riconosciuto va dove si trova il cursore (docs/2026-11-10-dettatura.md).
const dictation = useDictation((text) => void insertAtCursor((t, start, end) => insertDictation(t, text, start, end)));

// Testo nuovo: la tastiera compare subito, senza un tocco in più sulla casella.
// Non in orizzontale sul telefono: la tastiera coprirebbe quasi tutto; si apre toccando
// la casella (docs/2026-11-08-orizzontale-tastiera.md).
onMounted(() => {
  if (props.autofocus && textarea.value && !landscapePhone()) {
    textarea.value.focus();
    const end = textarea.value.value.length;
    textarea.value.setSelectionRange(end, end);
  }
});

function rotate90(): void {
  update({ rotation: (Math.round(props.element.rotation / 90) * 90 + 90) % 360 });
}
</script>

<template>
  <div class="text-row">
    <label class="field">
      <span class="visually-hidden">Testo</span>
      <textarea
        ref="textarea"
        :value="element.text"
        rows="2"
        placeholder="Scrivi il testo"
        enterkeyhint="enter"
        data-testid="text-input"
        @input="onTextInput"
      />
    </label>
    <!--
      Tieni premuto per dettare. «touchstart.prevent» evita il click finale del tocco: il pannello
      cresce verso l'alto e il click cadrebbe su «Annulla» della conferma comparsa sotto il dito.
    -->
    <button
      type="button"
      class="mic"
      :class="dictation.state.value"
      data-testid="dictate"
      aria-label="Tieni premuto per dettare"
      :aria-pressed="dictation.state.value === 'listening'"
      @pointerdown.prevent="dictation.press()"
      @pointerup="dictation.release()"
      @pointercancel="dictation.release()"
      @contextmenu.prevent
      @touchstart.prevent
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path
          d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <div
    v-if="dictation.state.value === 'confirm'"
    class="dictation-confirm"
    role="dialog"
    data-testid="dictation-confirm"
  >
    <p>Scaricare il riconoscimento vocale? Circa 50 MB, una volta sola. L'audio resta nel telefono.</p>
    <div class="row">
      <button type="button" class="primary grow" data-testid="dictation-download" @click="dictation.confirmDownload()">
        Scarica
      </button>
      <button type="button" class="grow" data-testid="dictation-cancel" @click="dictation.cancelDownload()">
        Annulla
      </button>
    </div>
  </div>
  <p
    v-else-if="dictation.partial.value || dictation.message.value || dictation.state.value === 'preparing'"
    class="dictation-status"
    :class="{ partial: !!dictation.partial.value }"
    role="status"
    data-testid="dictation-status"
  >
    {{
      dictation.partial.value ||
      dictation.message.value ||
      (dictation.state.value === 'preparing' ? 'Preparazione del riconoscimento…' : '')
    }}
  </p>
  <progress
    v-if="dictation.progress.value !== null"
    class="dictation-progress"
    max="1"
    :value="dictation.progress.value"
  />

  <div class="row symbols">
    <button
      type="button"
      data-testid="insert-diameter"
      aria-label="Inserisci il simbolo del diametro"
      @pointerdown.prevent
      @click="insertSymbol(DIAMETER_SIGN)"
    >
      <span class="symbol iso" aria-hidden="true">{{ DIAMETER_SIGN }}</span> ISO
    </button>
    <button
      type="button"
      data-testid="insert-diameter-45"
      aria-label="Inserisci il simbolo del diametro con la barra a 45°"
      @pointerdown.prevent
      @click="insertSymbol(DIAMETER_45_SIGN)"
    >
      <span class="symbol iso" aria-hidden="true">{{ DIAMETER_45_SIGN }}</span> 45°
    </button>
    <button
      type="button"
      data-testid="insert-reject"
      :aria-label="`Inserisci la parola ${REJECT_WORD}`"
      @pointerdown.prevent
      @click="insertSymbol(REJECT_WORD)"
    >
      {{ REJECT_WORD }}
    </button>
    <button
      type="button"
      class="short"
      data-testid="insert-unrepairable"
      aria-label="Inserisci NON RIPARABILE su due righe"
      @pointerdown.prevent
      @click="insertSymbol(UNREPAIRABLE_TEXT)"
    >
      N.R.
    </button>
  </div>

  <button type="button" class="toggle" data-testid="auto-fit" :aria-pressed="!!element.autoFit" @click="toggleAutoFit">
    <span class="check" aria-hidden="true">{{ element.autoFit ? '✓' : '' }}</span>
    Adatta automaticamente
    <small>riempie il riquadro, a capo solo con Invio</small>
  </button>
  <p v-if="element.autoFit && fitted.overflow" class="overflow" role="status" data-testid="fit-overflow">
    Il testo non entra nel riquadro: allarga il riquadro o accorcia il testo.
  </p>

  <details class="more" data-testid="more-options">
    <summary>Altre opzioni</summary>
    <div class="more-body">
      <div class="row">
        <label class="field grow">
          Carattere
          <select
            :value="element.fontFamily"
            @change="update({ fontFamily: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="f in FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </label>
        <label class="field size">
          {{ element.autoFit ? 'Dimensione (auto)' : 'Dimensione (pt)' }}
          <input
            :value="size"
            type="number"
            inputmode="decimal"
            :min="MIN_PT"
            :max="MAX_PT"
            step="1"
            data-testid="font-size"
            @input="onSizeInput"
            @blur="onSizeBlur"
          />
        </label>
      </div>

      <div class="row">
        <div class="segmented grow style" role="group" aria-label="Stile">
          <button
            type="button"
            data-testid="bold"
            aria-label="Grassetto"
            title="Grassetto"
            :aria-pressed="element.bold"
            @click="update({ bold: !element.bold })"
          >
            <b aria-hidden="true">G</b>
          </button>
          <button
            type="button"
            data-testid="italic"
            aria-label="Corsivo"
            title="Corsivo"
            :aria-pressed="element.italic"
            @click="update({ italic: !element.italic })"
          >
            <i aria-hidden="true">C</i>
          </button>
          <button
            type="button"
            data-testid="underline"
            aria-label="Sottolineato"
            title="Sottolineato"
            :aria-pressed="!!element.underline"
            @click="update({ underline: !element.underline })"
          >
            <u aria-hidden="true">S</u>
          </button>
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
    </div>
  </details>
</template>

<style scoped>
/* Stile: solo le lettere G, C, S, grandi, come nei programmi di scrittura. */
.style button {
  font-size: 1.35rem;
  font-family: Georgia, 'Times New Roman', serif;
}

.style b {
  font-weight: 800;
}

.style i {
  font-style: italic;
}

.style u {
  text-underline-offset: 3px;
  text-decoration-thickness: 2px;
}

.more {
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.more summary {
  min-height: var(--tap);
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  font-weight: 600;
}

.more summary::after {
  content: '▾';
  margin-left: auto;
  color: var(--muted);
}

.more[open] summary::after {
  content: '▴';
}

.more summary::-webkit-details-marker {
  display: none;
}

.more-body {
  display: grid;
  gap: 14px;
  padding: 4px 12px 12px;
}

.symbols {
  margin-top: -6px;
}

.symbol {
  font-size: 1.2rem;
  font-weight: 600;
}

/* Lo stesso simbolo usato in stampa: il mini-font è il primo carattere dell'interfaccia (base.css). */

.size {
  width: 130px;
  flex: none;
}

.toggle {
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  text-align: left;
  column-gap: 8px;
  padding: 8px 12px;
}

.toggle .check {
  grid-row: span 2;
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

.toggle small {
  color: var(--muted);
}

.overflow {
  margin: -6px 0 0;
  color: var(--warn);
}

.symbols {
  flex-wrap: wrap;
}

.symbols button {
  flex: 1 1 0;
  min-width: 0;
}

/* «N.R.» è corto: lascia più spazio agli altri. */
.symbols button.short {
  flex: 0.6 1 0;
}
/* Casella del testo con il microfono a destra (docs/2026-11-10-dettatura.md). */
.text-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.text-row .field {
  flex: 1 1 auto;
  min-width: 0;
}

.mic {
  flex: none;
  width: var(--tap);
  padding: 0;
  display: grid;
  place-items: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}

.mic.listening {
  background: var(--danger);
  border-color: var(--danger);
  color: var(--surface);
}

.mic.preparing,
.mic.recognizing,
.mic.downloading {
  color: var(--muted);
}

.dictation-status {
  margin: -6px 0 0;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.dictation-status.partial {
  color: var(--muted);
  font-style: italic;
}

.dictation-progress {
  width: 100%;
}

.dictation-confirm {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.dictation-confirm p {
  margin: 0;
}
/* Orizzontale con la tastiera aperta: resta solo la casella, alta quanto lo spazio (docs/2026-11-08-orizzontale-tastiera.md). */
@media (max-height: 260px) {
  :root[data-screen='landscape'] .mic,
  :root[data-screen='landscape'] .dictation-status,
  :root[data-screen='landscape'] .dictation-progress,
  :root[data-screen='landscape'] .symbols,
  :root[data-screen='landscape'] .toggle,
  :root[data-screen='landscape'] .overflow,
  :root[data-screen='landscape'] .more {
    display: none;
  }

  :root[data-screen='landscape'] .text-row,
  :root[data-screen='landscape'] .field {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }

  :root[data-screen='landscape'] .field textarea {
    flex: 1 1 auto;
    min-height: 40px;
    resize: none;
  }
}
</style>
