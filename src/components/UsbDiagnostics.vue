<script setup lang="ts">
/**
 * Pannello «Diagnostica USB»: verifica con qualsiasi dispositivo che il browser
 * possa vederlo, aprirlo e prenderne il controllo. Non invia dati.
 */
import { computed, onMounted, ref } from 'vue';
import ShareActions from '@/components/ShareActions.vue';
import { diagLog } from '@/diagnostics/log';
import {
  checkBrowser,
  endpointText,
  reportToText,
  runDiagnostics,
  type DiagnosticStep,
  type Environment,
} from '@/printer/usb-diagnostics';
import { useDiagnosticsStore } from '@/stores/diagnostics';

const env: Environment = {
  secureContext: window.isSecureContext,
  userAgent: navigator.userAgent,
  usb: 'usb' in navigator && navigator.usb ? navigator.usb : null,
};

const diagnostics = useDiagnosticsStore();
const preSteps = ref<DiagnosticStep[]>([]);
const report = computed(() => diagnostics.usbReport);
const running = ref(false);
const note = ref<string | null>(null);

onMounted(async () => {
  preSteps.value = await checkBrowser(env);
});

const ICONS = { ok: '✓', fail: '✗', skip: '–', info: 'i' } as const;

async function start(): Promise<void> {
  running.value = true;
  note.value = null;
  try {
    // Nuova lettura dei passaggi preliminari: il selettore deve partire subito dal tocco.
    const pre = preSteps.value.map((s) => ({ ...s }));
    const result = await runDiagnostics(env, pre);
    diagnostics.usbReport = result;
    diagLog.add(
      'app',
      `Diagnostica USB: ${result.outcome}`,
      result.device ? `${result.device.vendorId}:${result.device.productId}` : undefined,
    );
  } finally {
    running.value = false;
  }
}

const reportText = () => (report.value ? reportToText(report.value) : '');

async function forget(): Promise<void> {
  const device = report.value?.usbDevice;
  if (!device) return;
  try {
    if ('forget' in device && typeof device.forget === 'function') {
      await device.forget();
      note.value = 'Autorizzazione revocata: il sito non può più usare questo dispositivo.';
    } else {
      note.value = 'Questo browser non permette di revocare l’autorizzazione da qui: usa le impostazioni del sito.';
    }
  } catch (err) {
    note.value = `Revoca non riuscita: ${err instanceof Error ? err.message : String(err)}`;
  }
}

const steps = () => report.value?.steps ?? preSteps.value;
</script>

<template>
  <p class="intro">
    Verifica con <strong>qualsiasi dispositivo USB</strong> (anche una stampante di casa) che il telefono, il cavo e il
    browser permettano di comunicare con una stampante. <strong>Non viene inviato nessun dato</strong>: il dispositivo
    non stampa e non cambia stato.
  </p>

  <p
    v-if="report"
    class="summary"
    :class="report.outcome === 'ok' ? 'ok' : 'fail'"
    role="status"
    data-testid="diag-summary"
  >
    {{ report.summary }}
  </p>

  <ol class="steps" data-testid="diag-steps">
    <li v-for="s in steps()" :key="s.id" :class="s.state">
      <span class="icon" aria-hidden="true">{{ ICONS[s.state] }}</span>
      <div class="body">
        <strong>{{ s.title }}</strong>
        <span>{{ s.message }}</span>
        <details v-if="s.detail">
          <summary>Dettagli</summary>
          <code>{{ s.detail }}</code>
        </details>
      </div>
    </li>
  </ol>

  <section v-if="report?.device" class="device" data-testid="diag-device">
    <h3>Dispositivo</h3>
    <p>
      {{ report.device.manufacturerName }} – {{ report.device.productName }}<br />
      <small
        >ID {{ report.device.vendorId }}:{{ report.device.productId }} · USB {{ report.device.usbVersion }} · versione
        {{ report.device.deviceVersion }}</small
      >
    </p>
    <p v-if="report.device.labelWriter" class="lw">{{ report.device.labelWriter }}</p>
    <ul>
      <li v-for="i in report.device.interfaces" :key="i.number">
        Interfaccia {{ i.number }}: {{ i.className }}
        <small v-if="i.endpoints.length"> · {{ i.endpoints.map(endpointText).join(', ') }}</small>
      </li>
    </ul>
  </section>

  <p v-if="note" class="note" role="status">{{ note }}</p>

  <div class="actions">
    <button type="button" class="primary" data-testid="diag-start" :disabled="running || !env.usb" @click="start">
      {{ running ? 'Prova in corso…' : report ? 'Prova un altro dispositivo' : 'Scegli un dispositivo' }}
    </button>
    <template v-if="report">
      <ShareActions
        title="Etichettatrice – diagnostica USB"
        :text="reportText"
        copy-label="Copia risultati"
        testid="diag"
      />
      <button v-if="report.usbDevice" type="button" data-testid="diag-forget" @click="forget">
        Dimentica questo dispositivo
      </button>
    </template>
  </div>
</template>

<style scoped>
.intro {
  margin: 0;
  font-size: 0.95rem;
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

.fail .icon {
  background: var(--danger);
  color: #fff;
}

.body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
  color: var(--muted);
}

.device {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}

.device h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.device p,
.device ul {
  margin: 0 0 4px;
}

.device small {
  color: var(--muted);
}

.lw {
  font-weight: 600;
  color: var(--accent);
}

.summary {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  font-weight: 600;
}

.summary.ok {
  background: color-mix(in srgb, var(--ok) 15%, var(--surface));
}

.summary.fail {
  background: color-mix(in srgb, var(--warn) 15%, var(--surface));
}

.note {
  margin: 0;
  color: var(--muted);
}

.actions {
  display: grid;
  gap: 8px;
}
</style>
