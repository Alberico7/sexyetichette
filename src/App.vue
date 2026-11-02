<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import ErrorBanner from '@/components/ErrorBanner.vue';
import LabelEditor from '@/components/LabelEditor.vue';
import MediaPicker from '@/components/MediaPicker.vue';
import PrintSheet from '@/components/PrintSheet.vue';
import PrinterBar from '@/components/PrinterBar.vue';
import TextProperties from '@/components/TextProperties.vue';
import { checkEnvironment } from '@/printer/errors';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';

// Il pannello di simulazione esiste solo nella build di sviluppo.
const DevPanel = import.meta.env.DEV ? defineAsyncComponent(() => import('@/components/DevPanel.vue')) : null;

type Sheet = 'none' | 'text' | 'media' | 'print';

const store = useDocumentStore();
const printer = usePrinterStore();
const sheet = ref<Sheet>('none');
const envError = checkEnvironment();
const toast = ref<string | null>(null);

const selectedText = computed(() => (store.selected?.type === 'text' ? store.selected : null));

function addText(): void {
  store.addText();
  sheet.value = 'text';
}

function openEdit(id: string): void {
  store.select(id);
  sheet.value = 'text';
}

function removeSelected(): void {
  if (store.selectedId) store.removeElement(store.selectedId);
  if (sheet.value === 'text') sheet.value = 'none';
}

function onPrinted(): void {
  sheet.value = 'none';
  toast.value = 'Etichetta inviata alla stampante';
  setTimeout(() => (toast.value = null), 3000);
}

// Se il rotolo viene rilevato e l'etichetta è ancora vuota, adotto il suo formato.
watch(
  () => printer.detected,
  (detected) => {
    if (detected && store.doc.elements.length === 0) store.setMedia(detected.media);
  },
);

onMounted(() => {
  void printer.tryReconnect();
});
</script>

<template>
  <div class="app">
    <PrinterBar />

    <div v-if="envError" class="env-error" role="alert">
      <strong>{{ envError.title }}</strong>
      <p>{{ envError.hint }}</p>
    </div>
    <ErrorBanner
      v-if="printer.error"
      :error="printer.error"
      :can-recover="printer.state === 'connected'"
      @dismiss="printer.clearError()"
      @recover="printer.recover()"
    />
    <component :is="DevPanel" v-if="DevPanel" />

    <main class="workspace">
      <button type="button" class="media-chip" data-testid="media-chip" @click="sheet = 'media'">
        {{ store.doc.media.name }} ▾
      </button>
      <LabelEditor @edit="openEdit" />
      <p v-if="store.doc.elements.length === 0" class="hint">Tocca «Testo» per aggiungere un testo all'etichetta.</p>
    </main>

    <nav class="actions" aria-label="Azioni">
      <button type="button" data-testid="add-text" @click="addText">＋ Testo</button>
      <button type="button" :disabled="!selectedText" data-testid="edit-selected" @click="sheet = 'text'">Modifica</button>
      <button type="button" :disabled="!store.selectedId" class="danger" @click="removeSelected">Elimina</button>
      <button type="button" class="primary" data-testid="open-print" @click="sheet = 'print'">Stampa…</button>
    </nav>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>

    <BottomSheet :open="sheet === 'text' && !!selectedText" title="Testo" @close="sheet = 'none'">
      <TextProperties v-if="selectedText" :element="selectedText" />
    </BottomSheet>
    <BottomSheet :open="sheet === 'media'" title="Formato etichetta" @close="sheet = 'none'">
      <MediaPicker />
    </BottomSheet>
    <BottomSheet :open="sheet === 'print'" title="Anteprima e stampa" @close="sheet = 'none'">
      <PrintSheet :active="sheet === 'print'" @printed="onPrinted" />
    </BottomSheet>
  </div>
</template>

<style scoped>
.app {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.media-chip {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  max-width: calc(100% - 24px);
  min-height: 40px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 999px;
  font-size: 0.9rem;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
}

.hint {
  position: absolute;
  bottom: 8px;
  left: 12px;
  right: 12px;
  margin: 0;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  pointer-events: none;
}

.actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.actions button {
  padding: 0 4px;
  min-height: 52px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.env-error {
  margin: 8px 12px 0;
  padding: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--danger);
}

.env-error p {
  margin: 4px 0 0;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(84px + var(--safe-bottom));
  transform: translateX(-50%);
  z-index: 60;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--text);
  color: var(--bg);
  max-width: calc(100% - 32px);
}
</style>
