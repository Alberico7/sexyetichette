<script setup lang="ts">
/** «Stampa» (stampa subito) e «×1» (sceglie le copie), affiancati. Vedi docs/2026-11-06-stampa-rapida.md. */
defineProps<{
  /** Prefisso dei data-testid: «open» → open-print / open-copies; «text» → text-print / text-copies. */
  testid: string;
  printing: boolean;
}>();
const emit = defineEmits<{ print: []; copies: [] }>();
</script>

<template>
  <div class="print-pair">
    <button type="button" class="primary" :data-testid="`${testid}-print`" :disabled="printing" @click="emit('print')">
      {{ printing ? 'Stampa…' : 'Stampa' }}
    </button>
    <button
      type="button"
      class="copies"
      :data-testid="`${testid}-copies`"
      aria-label="Stampa più copie"
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

.copies {
  font-weight: 600;
}
</style>
