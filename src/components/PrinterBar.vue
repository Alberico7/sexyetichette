<script setup lang="ts">
import { computed } from 'vue';
import { TEST_PHASE } from '@/config';
import { usePrinterStore } from '@/stores/printer';
import StatusLogo from './StatusLogo.vue';
import type { StatusTone } from './status-logo';
import { THEME_LABELS, cycleTheme, nextPreference, themePreference } from '@/theme';

const emit = defineEmits<{ diagnostics: [] }>();
const printer = usePrinterStore();

const indicator = computed((): { tone: StatusTone; text: string } => {
  switch (printer.state) {
    case 'connecting':
      return { tone: 'busy', text: 'Collegamento…' };
    case 'printing':
      return { tone: 'busy', text: 'Stampa in corso…' };
    case 'disconnected':
      return { tone: 'off', text: 'Stampante non collegata' };
    case 'connected': {
      const problem = printer.blockingProblems[0];
      if (problem) return { tone: 'error', text: problem.title };
      if (printer.status && !printer.status.ready) return { tone: 'warn', text: 'Non pronta' };
      if (printer.warnings[0]) return { tone: 'warn', text: printer.warnings[0].title };
      return { tone: 'ok', text: 'Pronta' };
    }
  }
  return { tone: 'off', text: '' };
});

const model = computed(() => printer.info?.model ?? '');

const themeIcon = computed(() => ({ auto: '◐', light: '☀', dark: '☾' })[themePreference.value]);
const themeLabel = computed(
  () =>
    `Tema: ${THEME_LABELS[themePreference.value]}. Tocca per passare a ${THEME_LABELS[nextPreference(themePreference.value)]}`,
);
</script>

<template>
  <header class="bar">
    <div class="status" role="status" aria-live="polite">
      <StatusLogo :tone="indicator.tone" />
      <div class="texts">
        <strong>{{ indicator.text }}</strong>
        <small v-if="model"
          >{{ model }}<template v-if="printer.info && !printer.info.verified"> · non verificata</template></small
        >
      </div>
    </div>
    <button
      type="button"
      class="theme"
      data-testid="theme-toggle"
      :data-theme-pref="themePreference"
      :aria-label="themeLabel"
      :title="themeLabel"
      @click="cycleTheme"
    >
      <span aria-hidden="true">{{ themeIcon }}</span>
    </button>
    <button
      v-if="TEST_PHASE"
      type="button"
      class="theme"
      data-testid="bar-diagnostics"
      aria-label="Diagnostica"
      title="Diagnostica"
      @click="emit('diagnostics')"
    >
      <span aria-hidden="true">🔧</span>
    </button>
    <button
      v-if="printer.state === 'disconnected' || printer.state === 'connecting'"
      type="button"
      class="primary"
      :disabled="printer.state === 'connecting'"
      @click="printer.connect()"
    >
      Collega
    </button>
    <button v-else type="button" :disabled="printer.state === 'printing'" @click="printer.disconnect()">
      Scollega
    </button>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  /* 6 px: senza il 🔧 (versione finale) «Stampante non collegata» ci sta intera a 412 px. */
  gap: 6px;
  padding: calc(8px + var(--safe-top)) 12px 8px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.theme {
  flex: none;
  width: var(--tap);
  padding: 0;
  font-size: 1.3rem;
}

.status {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.texts {
  display: grid;
  min-width: 0;
}

.texts strong,
.texts small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.texts small {
  color: var(--muted);
}
/* Orizzontale su telefono: barra più bassa per lasciare spazio all'etichetta (docs/2026-11-08-orizzontale.md). */
@media (orientation: landscape) and (max-height: 500px) {
  .bar {
    padding-top: calc(4px + var(--safe-top));
    padding-bottom: 4px;
  }

  .bar button {
    min-height: 44px;
  }
}
</style>
