<script setup lang="ts">
/** Pagina «Diagnostica»: prova della 550, stampa di prova e collegamento USB. */
import { nextTick, ref, watch } from 'vue';
import PrinterCheck from '@/components/PrinterCheck.vue';
import TestPrint from '@/components/TestPrint.vue';
import UsbDiagnostics from '@/components/UsbDiagnostics.vue';
import { usePrinterStore } from '@/stores/printer';

type Tab = '550' | 'test' | 'usb';

const TABS: { id: Tab; label: string }[] = [
  { id: '550', label: 'Prova 550' },
  { id: 'test', label: 'Stampa di prova' },
  { id: 'usb', label: 'USB' },
];
const TAB_KEY = 'etichettatrice.diagnostica.scheda';

const printer = usePrinterStore();

/** Ultima scheda usata (solo comodità: se il browser non salva, si usa quella predefinita). */
function savedTab(): Tab | null {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.id === v) ? (v as Tab) : null;
  } catch {
    return null;
  }
}

const tab = ref<Tab>(savedTab() ?? (printer.state === 'connected' ? '550' : 'usb'));
const top = ref<HTMLElement | null>(null);

watch(tab, async (t) => {
  try {
    localStorage.setItem(TAB_KEY, t);
  } catch {
    // Archivio del browser non disponibile: pazienza.
  }
  // Ogni scheda parte dall'inizio, anche se la precedente era scorsa in basso.
  await nextTick();
  top.value?.scrollIntoView({ block: 'start' });
});
</script>

<template>
  <div ref="top" class="tabs-bar">
    <div class="tabs segmented" role="tablist" aria-label="Sezioni della diagnostica">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :aria-pressed="tab === t.id"
        :data-testid="`diag-tab-${t.id}`"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
  </div>

  <PrinterCheck v-if="tab === '550'" @go-test="tab = 'test'" />
  <TestPrint v-else-if="tab === 'test'" />
  <UsbDiagnostics v-else />
</template>

<style scoped>
/* Le schede restano in alto mentre si scorrono i risultati. */
.tabs-bar {
  position: sticky;
  top: -16px;
  z-index: 2;
  margin: -16px -16px 0;
  padding: 12px 16px 8px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.tabs button {
  font-size: 0.88rem;
  padding: 0 4px;
}
</style>
