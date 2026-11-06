<script setup lang="ts">
/** «Quante copie?»: numeri rapidi che stampano subito, oppure −/+ e «Stampa N copie». */
import { ref } from 'vue';
import { MAX_COPIES, clampCopies } from '@/printer/print-flow';

const emit = defineEmits<{ print: [copies: number] }>();

const QUICK = [2, 3, 4, 5, 10];
const n = ref(2);

function step(delta: number): void {
  n.value = clampCopies(n.value + delta);
}
</script>

<template>
  <div class="quick" role="group" aria-label="Copie, stampa subito">
    <button v-for="q in QUICK" :key="q" type="button" :data-testid="`copies-${q}`" @click="emit('print', q)">
      {{ q }}
    </button>
  </div>
  <div class="row stepper">
    <button type="button" aria-label="Una copia in meno" :disabled="n <= 1" @click="step(-1)">−</button>
    <input
      v-model.number="n"
      class="count"
      type="number"
      inputmode="numeric"
      min="1"
      :max="MAX_COPIES"
      aria-label="Numero di copie"
      data-testid="copies-count"
      @change="n = clampCopies(n)"
    />
    <button type="button" aria-label="Una copia in più" :disabled="n >= MAX_COPIES" @click="step(1)">+</button>
  </div>
  <button type="button" class="primary" data-testid="copies-print" @click="emit('print', clampCopies(n))">
    {{ clampCopies(n) === 1 ? 'Stampa 1 copia' : `Stampa ${clampCopies(n)} copie` }}
  </button>
</template>

<style scoped>
.quick {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.quick button {
  min-height: 56px;
  font-size: 1.2rem;
  font-weight: 600;
}

.stepper {
  justify-content: center;
}

.stepper button {
  width: var(--tap);
  padding: 0;
  font-size: 1.3rem;
}

.count {
  width: 5em;
  text-align: center;
}
</style>
