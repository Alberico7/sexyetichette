<script setup lang="ts">
/** Prova completa della LabelWriter 550 collegata: solo comandi di lettura. */
import { computed, ref, shallowRef } from 'vue';
import { APP_BUILD } from '@/app-info';
import { diagLog } from '@/diagnostics/log';
import { runPrinterCheck, type CheckStep } from '@/diagnostics/printer-check';
import { LW550_HEAD } from '@/printer/media';
import { resolveFontSize } from '@/render/scene';
import { useDiagnosticsStore } from '@/stores/diagnostics';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';

const emit = defineEmits<{ 'go-test': [] }>();
const printer = usePrinterStore();
const store = useDocumentStore();
const preview = usePreviewStore();
const diagnostics = useDiagnosticsStore();

const running = ref(false);
const progress = shallowRef<readonly CheckStep[]>([]);
const report = computed(() => diagnostics.printerReport);
const steps = computed(() => (running.value ? progress.value : (report.value?.steps ?? [])));
const connected = computed(() => printer.state === 'connected');

const ICONS = { ok: '✓', warn: '!', fail: '✗', info: 'i', skip: '–' } as const;

async function start(): Promise<void> {
  const probe = printer.port?.probe();
  if (!probe || running.value) return;
  running.value = true;
  progress.value = [];
  diagLog.add('app', 'Prova LabelWriter 550 avviata');
  try {
    const result = await runPrinterCheck(
      probe,
      {
        app: APP_BUILD,
        env: {
          userAgent: navigator.userAgent,
          secureContext: window.isSecureContext,
          webUsb: 'usb' in navigator,
          screen: `${window.innerWidth}×${window.innerHeight} CSS px, densità ${window.devicePixelRatio}`,
        },
        info: printer.info,
        doc: store.doc,
        head: LW550_HEAD,
        settings: { density: printer.density, copies: printer.copies },
        prepare: async () => await preview.ensure(),
        overflow: store.doc.elements.some((el) => el.type === 'text' && el.autoFit && resolveFontSize(el).overflow),
      },
      (s) => (progress.value = [...s]),
    );
    diagnostics.printerReport = result;
    diagLog.add('app', `Prova LabelWriter 550 conclusa: ${result.summary}`);
  } catch (err) {
    diagLog.add('error', 'Prova LabelWriter 550 interrotta', err instanceof Error ? err.message : String(err));
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <p class="intro">
    Controlla la stampante collegata con <strong>soli comandi di lettura</strong>: versione, stato e dati del rotolo,
    ciascuno ripetuto per scoprire risposte instabili. Prepara anche il lavoro di stampa dell’etichetta attuale e lo
    verifica <strong>senza inviarlo</strong>. Non stampa e non fa avanzare la carta.
  </p>

  <div v-if="!connected && !running" class="connect">
    <p>Collega prima la LabelWriter 550.</p>
    <button
      type="button"
      class="primary"
      data-testid="check-connect"
      :disabled="printer.state === 'connecting'"
      @click="printer.connect()"
    >
      {{ printer.state === 'connecting' ? 'Collegamento…' : 'Collega' }}
    </button>
  </div>

  <section
    v-if="report && !running"
    class="summary"
    :class="report.problems.some((p) => p.severity === 'grave') ? 'fail' : report.problems.length ? 'warn' : 'ok'"
    data-testid="check-summary"
    role="status"
  >
    <strong>{{ report.summary }}</strong>
    <ul v-if="report.problems.length">
      <li v-for="(p, i) in report.problems" :key="i" :class="p.severity">{{ p.message }}</li>
    </ul>
  </section>
  <button v-if="report && !running" type="button" data-testid="check-go-test" @click="emit('go-test')">
    Vai alla stampa di prova →
  </button>

  <ol v-if="steps.length" class="steps" data-testid="check-steps">
    <li v-for="s in steps" :key="s.id" :class="s.state">
      <span class="icon" aria-hidden="true">{{ ICONS[s.state] }}</span>
      <div class="body">
        <strong>{{ s.title }}</strong>
        <span
          >{{ s.message }}<small v-if="s.ms !== undefined"> · {{ s.ms }} ms</small></span
        >
        <details v-if="s.details.length">
          <summary>Dettagli</summary>
          <dl>
            <template v-for="(d, i) in s.details" :key="i">
              <dt>{{ d.label }}</dt>
              <dd>{{ d.value }}</dd>
            </template>
          </dl>
        </details>
      </div>
    </li>
  </ol>

  <div class="actions">
    <button type="button" class="primary" data-testid="check-start" :disabled="!connected || running" @click="start">
      {{ running ? 'Prova in corso…' : report ? 'Ripeti la prova' : 'Avvia la prova' }}
    </button>
  </div>
</template>

<style scoped>
.intro,
.connect p {
  margin: 0;
  font-size: 0.95rem;
}

.connect {
  display: grid;
  gap: 8px;
}

.summary {
  padding: 10px 12px;
  border-radius: var(--radius);
}

.summary ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.summary.ok {
  background: color-mix(in srgb, var(--ok) 15%, var(--surface));
}

.summary.warn {
  background: color-mix(in srgb, var(--warn) 15%, var(--surface));
}

.summary.fail {
  background: color-mix(in srgb, var(--danger) 12%, var(--surface));
}

.summary li.grave {
  font-weight: 600;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.steps li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: var(--surface-2);
}

.ok .icon {
  background: var(--ok);
  color: #fff;
}

.warn .icon {
  background: var(--warn);
  color: #fff;
}

.fail .icon {
  background: var(--danger);
  color: #fff;
}

.body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.body small {
  color: var(--muted);
}

dl {
  margin: 4px 0 0;
  display: grid;
  gap: 2px;
  font-size: 0.82rem;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0 0 4px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, monospace;
}

.actions {
  display: grid;
  gap: 8px;
}
</style>
