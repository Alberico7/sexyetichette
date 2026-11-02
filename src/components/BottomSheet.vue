<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKey);
    else window.removeEventListener('keydown', onKey);
  },
  { immediate: true },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="backdrop" @click.self="emit('close')">
      <section class="sheet" role="dialog" aria-modal="true" :aria-label="title">
        <header class="sheet-header">
          <h2>{{ title }}</h2>
          <button class="close" type="button" aria-label="Chiudi" @click="emit('close')">✕</button>
        </header>
        <div class="sheet-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="sheet-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 560px;
  max-height: 88dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -8px 24px rgb(0 0 0 / 0.2);
  padding-bottom: var(--safe-bottom);
}

.sheet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid var(--border);
}

.sheet-header h2 {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
}

.close {
  width: var(--tap);
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 1.2rem;
}

.sheet-body {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: grid;
  gap: 14px;
}

.sheet-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
}
</style>
