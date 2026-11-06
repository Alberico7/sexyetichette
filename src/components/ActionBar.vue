<script setup lang="ts">
/**
 * Barra in basso dell'editor: «＋ Testo», «Recenti» oppure «Modifica · Elimina»,
 * 👁 (anteprima) e «Stampa ×1».
 */
import PrintButtons from '@/components/PrintButtons.vue';

defineProps<{
  /** C'è un elemento selezionato: mostra Modifica ed Elimina al posto di Recenti. */
  selected: boolean;
  /** L'elemento selezionato è un testo (Modifica attivo). */
  canEdit: boolean;
  printing: boolean;
}>();
const emit = defineEmits<{
  addText: [];
  recent: [];
  edit: [];
  remove: [];
  preview: [];
  print: [];
  copies: [];
}>();
</script>

<template>
  <nav class="actions" :class="{ three: !selected }" aria-label="Azioni">
    <button type="button" data-testid="add-text" @click="emit('addText')">＋ Testo</button>
    <button v-if="!selected" type="button" data-testid="open-recent" @click="emit('recent')">Recenti</button>
    <template v-else>
      <button type="button" :disabled="!canEdit" data-testid="edit-selected" @click="emit('edit')">Modifica</button>
      <button type="button" class="danger" @click="emit('remove')">Elimina</button>
    </template>
    <button
      type="button"
      class="preview-btn"
      data-testid="open-preview"
      aria-label="Anteprima"
      title="Anteprima"
      @click="emit('preview')"
    >
      <span aria-hidden="true">👁</span>
    </button>
    <PrintButtons testid="open" :printing="printing" @print="emit('print')" @copies="emit('copies')" />
  </nav>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 44px minmax(0, 1.55fr);
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.actions.three {
  grid-template-columns: repeat(2, minmax(0, 1fr)) 52px minmax(0, 1.6fr);
}

.preview-btn {
  font-size: 1.2rem;
}

.actions:not(.three) :deep(button) {
  font-size: 0.95rem;
}

.actions :deep(button) {
  padding: 0 4px;
  min-height: 52px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
