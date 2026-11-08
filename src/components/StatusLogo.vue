<script setup lang="ts">
/**
 * Logo del pettirosso come indicatore di stato: grigio se la stampante non è
 * collegata, a colori con un anello verde/arancio/rosso/azzurro negli altri casi.
 * Vedi docs/2026-11-08-logo-stato.md.
 */
import { computed } from 'vue';
import { statusMark, type StatusTone } from './status-logo';

const props = defineProps<{ tone: StatusTone }>();
const mark = computed(() => statusMark(props.tone));
const logoUrl = `url("${import.meta.env.BASE_URL}icona-ritagliabile.svg")`;
</script>

<template>
  <span class="logo" :class="tone" :data-tone="tone" data-testid="status-logo" aria-hidden="true">
    <span class="img" :style="{ backgroundImage: logoUrl }" />
    <span v-if="tone !== 'off'" class="ring" />
    <span v-if="mark" class="badge" data-testid="status-mark">{{ mark }}</span>
  </span>
</template>

<style scoped>
.logo {
  --c: var(--muted);
  position: relative;
  flex: none;
  width: 40px;
  height: 40px;
}

.logo.busy {
  --c: var(--accent);
}

.logo.ok {
  --c: var(--ok);
}

.logo.warn {
  --c: var(--warn);
}

.logo.error {
  --c: var(--danger);
}

/* Il pettirosso intero dentro il cerchio (icona ritagliabile al 150 %). */
.img {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background-position: center;
  background-size: 150%;
  background-repeat: no-repeat;
}

.off .img {
  filter: grayscale(1);
  opacity: 0.5;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .off .img {
    opacity: 0.8;
  }
}

:root[data-theme='dark'] .off .img {
  opacity: 0.8;
}

.ring {
  position: absolute;
  inset: 0;
  border: 3px solid var(--c);
  border-radius: 50%;
}

.busy .ring {
  border-color: color-mix(in srgb, var(--c) 25%, transparent);
  border-top-color: var(--c);
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .busy .ring {
    animation: none;
    border-right-color: var(--c);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--c);
  color: var(--surface);
  font:
    700 11px/16px system-ui,
    sans-serif;
  text-align: center;
  box-shadow: 0 0 0 2px var(--surface);
}
/* Orizzontale su telefono: logo da 32 px nella barra più bassa (docs/2026-11-08-orizzontale.md). */
@media (max-height: 600px) {
  :root[data-screen='landscape'] .logo {
    width: 32px;
    height: 32px;
  }

  :root[data-screen='landscape'] .img {
    inset: 3px;
  }

  :root[data-screen='landscape'] .badge {
    width: 14px;
    height: 14px;
    font-size: 10px;
    line-height: 14px;
  }
}
</style>
