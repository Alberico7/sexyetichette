<script setup lang="ts">
import type { AppError } from '@/printer/errors';

const props = defineProps<{ error: AppError; canRecover: boolean }>();
const emit = defineEmits<{ dismiss: []; recover: []; diagnostics: [] }>();

/** Errori di collegamento per cui la diagnostica USB aiuta a capire dove si ferma. */
const CONNECTION_CODES = new Set(['no-device-selected', 'access-denied', 'device-unknown', 'webusb-unsupported', 'insecure-context', 'disconnected']);
const showDiagnostics = () => CONNECTION_CODES.has(props.error.code);
</script>

<template>
  <div class="banner" :class="{ warning: error.warning }" role="alert">
    <div class="content">
      <strong>{{ error.title }}</strong>
      <p>{{ error.hint }}</p>
      <details v-if="error.detail">
        <summary>Dettagli tecnici</summary>
        <code>{{ error.detail }}</code>
      </details>
    </div>
    <div class="actions">
      <button v-if="showDiagnostics()" type="button" data-testid="open-diagnostics" @click="emit('diagnostics')">
        Apri la diagnostica USB
      </button>
      <button v-if="error.recoverable && canRecover" type="button" @click="emit('recover')">
        Ripristina stampante
      </button>
      <button type="button" aria-label="Chiudi messaggio" @click="emit('dismiss')">OK</button>
    </div>
  </div>
</template>

<style scoped>
.banner {
  margin: 8px 12px 0;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  display: grid;
  gap: 8px;
}

.banner.warning {
  border-color: var(--warn);
  background: color-mix(in srgb, var(--warn) 10%, var(--surface));
}

.content p {
  margin: 4px 0 0;
  font-size: 0.95rem;
}

details {
  margin-top: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
