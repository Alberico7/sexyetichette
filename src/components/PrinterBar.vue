<script setup lang="ts">
import { computed } from 'vue';
import { TEST_PHASE } from '@/config';
import { usePrinterStore } from '@/stores/printer';
import { THEME_LABELS, cycleTheme, nextPreference, themePreference } from '@/theme';

const emit = defineEmits<{ diagnostics: [] }>();
const printer = usePrinterStore();

const indicator = computed(() => {
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
      <span class="dot" :class="indicator.tone" aria-hidden="true" />
      <div class="texts">
        <strong>{{ indicator.text }}</strong>
        <small v-if="model">{{ model }}<template v-if="printer.info && !printer.info.verified"> · non verificata</template></small>
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
  gap: 8px;
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
  gap: 10px;
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

.dot {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--muted);
}

.dot.ok {
  background: var(--ok);
}

.dot.warn {
  background: var(--warn);
}

.dot.error {
  background: var(--danger);
}

.dot.busy {
  background: var(--accent);
  animation: pulse 1s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    opacity: 0.3;
  }
}
</style>
