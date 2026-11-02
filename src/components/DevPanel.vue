<script setup lang="ts">
/** Pannello per la stampante simulata. Incluso solo nella build di sviluppo. */
import { computed } from 'vue';
import type { SimulatedConfig, SimulatedFault, SimulatedPrinterPort } from '@/printer/simulated';
import { usePrinterStore } from '@/stores/printer';

const printer = usePrinterStore();
const sim = computed(() =>
  printer.port?.kind === 'simulated' ? (printer.port as SimulatedPrinterPort) : null,
);

// L'adapter non è reattivo: ricalcolo il conteggio a ogni stampa conclusa.
const jobCount = computed(() => {
  void printer.lastPrintAt;
  void printer.error;
  return sim.value?.jobs.length ?? 0;
});

const faults:{ value: SimulatedFault; label: string }[] = [
  { value: 'none', label: 'Nessun guasto' },
  { value: 'no-media', label: 'Rotolo assente' },
  { value: 'counterfeit', label: 'Rotolo non originale' },
  { value: 'cover-open', label: 'Coperchio aperto' },
  { value: 'busy', label: 'Stampante occupata' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'disconnect-on-print', label: 'Scollegamento in stampa' },
  { value: 'nfc-unreadable', label: 'NFC illeggibile' },
];

function set<K extends keyof SimulatedConfig>(key: K, value: SimulatedConfig[K]): void {
  sim.value?.configure({ [key]: value } as Partial<SimulatedConfig>);
  void printer.refreshStatus();
}
</script>

<template>
  <details v-if="sim" class="dev" data-testid="dev-panel">
    <summary>Simulazione (solo sviluppo) · lavori ricevuti: {{ jobCount }}</summary>
    <div class="grid">
      <label class="field">
        Guasto
        <select :value="sim.config.fault" @change="set('fault', ($event.target as HTMLSelectElement).value as SimulatedFault)">
          <option v-for="f in faults" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </label>
      <label class="field">
        Selettore USB
        <select
          :value="sim.config.picker"
          @change="set('picker', ($event.target as HTMLSelectElement).value as SimulatedConfig['picker'])"
        >
          <option value="ok">Stampante scelta</option>
          <option value="cancel">Chiuso senza scelta</option>
          <option value="denied">Accesso negato</option>
          <option value="unknown-device">Dispositivo sconosciuto</option>
        </select>
      </label>
      <label class="field">
        Modello
        <select
          :value="sim.config.model"
          @change="set('model', ($event.target as HTMLSelectElement).value as SimulatedConfig['model'])"
        >
          <option value="LW_550">550</option>
          <option value="LW_550_TURBO">550 Turbo</option>
        </select>
      </label>
      <label class="field">
        SKU rotolo
        <input type="text" :value="sim.config.rollSku" @change="set('rollSku', ($event.target as HTMLInputElement).value)" />
      </label>
      <button type="button" @click="sim.unplug()">Scollega il cavo</button>
    </div>
  </details>
</template>

<style scoped>
.dev {
  margin: 8px 12px 0;
  padding: 8px 12px;
  border: 1px dashed var(--warn);
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
</style>
