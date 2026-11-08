<script setup lang="ts">
/** Pannello Testo agganciato in basso: l'etichetta resta visibile sopra mentre si scrive. */
import PrintButtons from '@/components/PrintButtons.vue';
import TextProperties from '@/components/TextProperties.vue';
import type { TextElement } from '@/model/types';

defineProps<{
  element: TextElement;
  /** Aperto da «+ Testo»: la tastiera compare subito. */
  autofocus: boolean;
  printing: boolean;
}>();
const emit = defineEmits<{ remove: []; done: []; print: []; copies: [] }>();
</script>

<template>
  <section class="dock" aria-label="Testo" data-testid="text-panel">
    <div class="dock-body">
      <TextProperties :key="element.id" :element="element" :autofocus="autofocus" />
    </div>
    <div class="dock-actions">
      <button type="button" class="danger" aria-label="Elimina il testo" @click="emit('remove')">Elimina</button>
      <button type="button" data-testid="text-done" @click="emit('done')">Fine</button>
      <PrintButtons testid="text" :printing="printing" @print="emit('print')" @copies="emit('copies')" />
    </div>
  </section>
</template>

<style scoped>
.dock {
  flex: 0 1 auto;
  max-height: 58dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 16px rgb(0 0 0 / 0.1);
}

.dock-body {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 12px 4px;
  display: grid;
  gap: 12px;
}

.dock-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1.9fr;
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
}

.dock-actions :deep(button) {
  padding: 0 4px;
  min-height: 52px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Orizzontale su telefono: colonna a destra, etichetta visibile a sinistra (docs/2026-11-08-orizzontale.md). */
@media (max-height: 500px) {
  :root[data-screen='landscape'] .dock {
    flex: none;
    width: min(460px, 52vw);
    max-height: none;
    border-top: 0;
    border-left: 1px solid var(--border);
    border-radius: 16px 0 0 0;
    box-shadow: -4px 0 16px rgb(0 0 0 / 0.1);
  }

  :root[data-screen='landscape'] .dock-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 8px 8px 4px;
    gap: 8px;
  }

  :root[data-screen='landscape'] .dock-actions :deep(button) {
    min-height: 48px;
  }
}
/*
 * Orizzontale con la tastiera aperta: solo la casella del testo, per vedere cosa si scrive.
 * Fine e Stampa tornano chiudendo la tastiera (docs/2026-11-08-orizzontale-tastiera.md).
 */
@media (max-height: 260px) {
  :root[data-screen='landscape'] .dock-body {
    display: flex;
    flex-direction: column;
    padding: 6px;
  }

  :root[data-screen='landscape'] .dock-actions {
    display: none;
  }
}
</style>
