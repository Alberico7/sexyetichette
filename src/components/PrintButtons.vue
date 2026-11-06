<script setup lang="ts">
/**
 * «Stampa» (stampa subito) e «×1» (sceglie le copie), affiancati.
 * Durante una stampa da più copie «Stampa» diventa «Ferma». Vedi
 * docs/2026-11-06-stampa-rapida.md e docs/2026-11-06-copie-multiple-550.md.
 */
import { computed } from 'vue';
import { usePrinterStore } from '@/stores/printer';

defineProps<{
  /** Prefisso dei data-testid: «open» → open-print / open-copies / open-stop; «text» → text-…. */
  testid: string;
  printing: boolean;
}>();
const emit = defineEmits<{ print: []; copies: [] }>();

const printer = usePrinterStore();
/** Stampa da più copie in corso: si può fermare. */
const multi = computed(() =>
  printer.state === 'printing' && printer.progress && printer.progress.total > 1 ? printer.progress : null,
);
</script>

<template>
  <div class="print-pair" :class="{ stopping: multi }">
    <button
      v-if="multi"
      type="button"
      class="danger"
      :data-testid="`${testid}-stop`"
      :disabled="printer.stopRequested"
      @click="printer.requestStop()"
    >
      {{ printer.stopRequested ? 'Fermo…' : `Ferma ${multi.sent}/${multi.total}` }}
    </button>
    <button
      v-else
      type="button"
      class="primary"
      :data-testid="`${testid}-print`"
      :disabled="printing"
      @click="emit('print')"
    >
      {{ printing ? 'Stampa…' : 'Stampa' }}
    </button>
    <button
      v-if="!multi"
      type="button"
      class="copies"
      :data-testid="`${testid}-copies`"
      aria-label="Stampa più copie"
      :disabled="printing"
      @click="emit('copies')"
    >
      ×1
    </button>
  </div>
</template>

<style scoped>
.print-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 4px;
  min-width: 0;
}

.print-pair.stopping {
  grid-template-columns: minmax(0, 1fr);
}

.copies {
  font-weight: 600;
}
</style>
