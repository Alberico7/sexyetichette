<script setup lang="ts">
/** Piede fisso della diagnostica: copia o condividi tutti i risultati, da ogni scheda. */
import ShareActions from '@/components/ShareActions.vue';
import { diagLog } from '@/diagnostics/log';
import { useDiagnosticsStore } from '@/stores/diagnostics';

const diagnostics = useDiagnosticsStore();
const fullText = () => diagnostics.fullText();
</script>

<template>
  <section class="all" aria-label="Condividi tutta la diagnostica">
    <small>Tutti i risultati, ultime stampe e registro ({{ diagLog.entries.length }} eventi), senza dati personali.</small>
    <ShareActions :title="diagnostics.shareTitle()" :text="fullText" copy-label="Copia tutto" testid="diag-all" />
  </section>
</template>

<style scoped>
.all {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
}

.all small {
  color: var(--muted);
}
</style>
