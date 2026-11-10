<script setup lang="ts">
/**
 * I quattro pulsanti dei simboli nel pannello del testo: ⌀ ISO, ∅ 45°, AFKEUR, N.R.
 * Ogni tocco emette il testo da inserire; l'inserimento al cursore lo fa TextProperties.
 * «pointerdown.prevent» lascia la casella attiva (la tastiera non si chiude).
 * Vedi docs/2026-11-09-diametro-45.md, docs/2026-11-03-pulsante-afkeur.md,
 * docs/2026-11-04-pulsante-non-riparabile.md.
 */
import { DIAMETER_45_SIGN, DIAMETER_SIGN, REJECT_WORD, UNREPAIRABLE_TEXT } from '@/model/text';

const emit = defineEmits<{ insert: [text: string] }>();
</script>

<template>
  <div class="row symbols">
    <button
      type="button"
      data-testid="insert-diameter"
      aria-label="Inserisci il simbolo del diametro"
      @pointerdown.prevent
      @click="emit('insert', DIAMETER_SIGN)"
    >
      <span class="symbol" aria-hidden="true">{{ DIAMETER_SIGN }}</span> ISO
    </button>
    <button
      type="button"
      data-testid="insert-diameter-45"
      aria-label="Inserisci il simbolo del diametro con la barra a 45°"
      @pointerdown.prevent
      @click="emit('insert', DIAMETER_45_SIGN)"
    >
      <span class="symbol" aria-hidden="true">{{ DIAMETER_45_SIGN }}</span> 45°
    </button>
    <button
      type="button"
      data-testid="insert-reject"
      :aria-label="`Inserisci la parola ${REJECT_WORD}`"
      @pointerdown.prevent
      @click="emit('insert', REJECT_WORD)"
    >
      {{ REJECT_WORD }}
    </button>
    <button
      type="button"
      class="short"
      data-testid="insert-unrepairable"
      aria-label="Inserisci NON RIPARABILE su due righe"
      @pointerdown.prevent
      @click="emit('insert', UNREPAIRABLE_TEXT)"
    >
      N.R.
    </button>
  </div>
</template>

<style scoped>
.symbols {
  margin-top: -6px;
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

/* Lo stesso simbolo usato in stampa: il mini-font è il primo carattere dell'interfaccia (base.css). */
.symbol {
  font-size: 1.2rem;
  font-weight: 600;
}

/* Orizzontale con la tastiera aperta: resta solo la casella (docs/2026-11-08-orizzontale-tastiera.md). */
@media (max-height: 260px) {
  :root[data-screen='landscape'] .symbols {
    display: none;
  }
}
</style>
