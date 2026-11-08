<script setup lang="ts">
/**
 * «Quante copie?»: tastierino numerico dentro l'app (senza la tastiera del
 * telefono) e «Stampa N copie». Vedi docs/2026-11-06-tastierino-copie.md.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { backspace, copiesOf, pressDigit } from '@/composables/copies-keypad';

const emit = defineEmits<{ print: [copies: number] }>();

const value = ref('');
const copies = computed(() => copiesOf(value.value));

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function digit(d: number): void {
  value.value = pressDigit(value.value, d);
}

function print(): void {
  if (copies.value) emit('print', copies.value);
}

/** Tastiera del computer: cifre, Backspace, Canc, Invio. */
function onKey(e: KeyboardEvent): void {
  if (/^[0-9]$/.test(e.key)) digit(Number(e.key));
  else if (e.key === 'Backspace') value.value = backspace(value.value);
  else if (e.key === 'Delete' || e.key === 'Escape') value.value = '';
  else if (e.key === 'Enter') print();
  else return;
  e.preventDefault();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <!-- In verticale il contenitore non conta (display: contents); in orizzontale: numero e Stampa a sinistra, tasti a destra. -->
  <div class="copies-picker">
    <div class="display" role="status" aria-live="polite" data-testid="copies-display">
      <strong>{{ value || '–' }}</strong>
      <span>{{ copies === 1 ? 'copia' : 'copie' }}</span>
    </div>

    <div class="keypad" role="group" aria-label="Tastierino numerico">
      <button
        v-for="k in KEYS"
        :key="k"
        type="button"
        :data-testid="`key-${k}`"
        :aria-label="`cifra ${k}`"
        @click="digit(k)"
      >
        {{ k }}
      </button>
      <button type="button" class="fn" data-testid="key-clear" aria-label="azzera" @click="value = ''">C</button>
      <button type="button" data-testid="key-0" aria-label="cifra 0" @click="digit(0)">0</button>
      <button
        type="button"
        class="fn"
        data-testid="key-back"
        aria-label="cancella l’ultima cifra"
        @click="value = backspace(value)"
      >
        ⌫
      </button>
    </div>

    <button type="button" class="primary go" data-testid="copies-print" :disabled="!copies" @click="print">
      {{ !copies ? 'Scrivi il numero di copie' : copies === 1 ? 'Stampa 1 copia' : `Stampa ${copies} copie` }}
    </button>
  </div>
</template>

<style scoped>
.display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  min-height: 56px;
}

.display strong {
  font-size: 2.4rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.display span {
  color: var(--muted);
  font-size: 1.1rem;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.keypad button {
  min-height: 56px;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.keypad .fn {
  color: var(--muted);
  font-size: 1.3rem;
}

.go {
  min-height: 56px;
  font-size: 1.1rem;
}
.copies-picker {
  display: contents;
}

/* Orizzontale su telefono (docs/2026-11-08-orizzontale.md). */
@media (orientation: landscape) and (max-height: 500px) {
  .copies-picker {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    grid-template-areas:
      'display keypad'
      'go keypad';
    grid-template-rows: 1fr auto;
    gap: 6px 16px;
  }

  .display {
    grid-area: display;
    align-self: center;
  }

  .keypad {
    grid-area: keypad;
    gap: 6px;
  }

  .keypad button {
    min-height: 48px;
  }

  .go {
    grid-area: go;
    min-height: 52px;
  }
}
</style>
