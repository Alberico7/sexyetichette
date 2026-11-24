<script setup lang="ts">
/**
 * Barra in basso dell'editor: «＋ Testo», poi il codice a barre e «Recenti» (icone) oppure,
 * con un elemento selezionato, «Modifica · Elimina»; 👁 (anteprima) e «Stampa ×1».
 * Con un elemento selezionato il pulsante del codice non c'è: non ci sarebbe spazio per le scritte.
 * Il pulsante del codice a barre: docs/2026-11-24-codici-a-barre.md (scelta c dell'utente).
 */
import PrintButtons from '@/components/PrintButtons.vue';

defineProps<{
  /** C'è un elemento selezionato: mostra Modifica ed Elimina al posto di Recenti. */
  selected: boolean;
  /** C'è un elemento modificabile selezionato (Modifica attivo). */
  canEdit: boolean;
  printing: boolean;
}>();
const emit = defineEmits<{
  addText: [];
  addBarcode: [];
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
    <button
      v-if="!selected"
      type="button"
      class="icon-btn"
      data-testid="add-barcode"
      aria-label="Aggiungi un codice a barre"
      title="Codice a barre"
      @click="emit('addBarcode')"
    >
      <svg viewBox="0 0 28 22" width="28" height="22" aria-hidden="true">
        <path
          d="M2 2v14M5 2v14M7 2v14M11 2v14M13 2v14M16 2v14M20 2v14M22 2v14M26 2v14"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path d="M5 2v14M16 2v14M22 2v14" stroke="currentColor" stroke-width="2.6" />
        <path d="M2 20h24" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2" />
      </svg>
    </button>
    <button
      v-if="!selected"
      type="button"
      class="icon-btn"
      data-testid="open-recent"
      aria-label="Recenti"
      title="Recenti"
      @click="emit('recent')"
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5M12 7.5V12l3 2"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
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
  /* ＋ Testo · Modifica · Elimina · 👁 · Stampa (con un elemento selezionato) */
  grid-template-columns: repeat(3, minmax(0, 1fr)) 44px minmax(0, 1.55fr);
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

/* Niente selezionato: ＋ Testo · codice · Recenti · 👁 · Stampa */
.actions.three {
  grid-template-columns: minmax(0, 1fr) 52px 52px 52px minmax(0, 1.6fr);
}

.icon-btn {
  display: grid;
  place-items: center;
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
