<script setup lang="ts">
/** Pagina «Diagnostica»: collegamento USB, prova della 550, stampa di prova e condivisione. */
import { ref } from 'vue';
import PrinterCheck from '@/components/PrinterCheck.vue';
import ShareActions from '@/components/ShareActions.vue';
import TestPrint from '@/components/TestPrint.vue';
import UsbDiagnostics from '@/components/UsbDiagnostics.vue';
import { diagLog } from '@/diagnostics/log';
import { useDiagnosticsStore } from '@/stores/diagnostics';
import { usePrinterStore } from '@/stores/printer';

type Tab = 'usb' | '550' | 'test';

const printer = usePrinterStore();
const diagnostics = useDiagnosticsStore();
const tab = ref<Tab>(printer.state === 'connected' ? '550' : 'usb');

const TABS: { id: Tab; label: string }[] = [
  { id: 'usb', label: 'USB' },
  { id: '550', label: 'LabelWriter 550' },
  { id: 'test', label: 'Stampa di prova' },
];

const fullText = () => diagnostics.fullText();
const title = () => diagnostics.shareTitle();
</script>

<template>
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

  <UsbDiagnostics v-if="tab === 'usb'" />
  <PrinterCheck v-else-if="tab === '550'" />
  <TestPrint v-else />

  <section class="all" aria-label="Condividi tutta la diagnostica">
    <h3>Tutti i risultati</h3>
    <p>
      Riepilogo, prove, risposte sulla stampa di prova e registro degli eventi ({{ diagLog.entries.length }}) in un
      unico testo, senza dati personali.
    </p>
    <ShareActions :title="title()" :text="fullText" copy-label="Copia tutto" testid="diag-all" />
  </section>
</template>

<style scoped>
.tabs button {
  font-size: 0.88rem;
  padding: 0 4px;
}

.all {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.all h3 {
  margin: 0;
  font-size: 1rem;
}

.all p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
