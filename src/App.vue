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
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';

// Il pannello di simulazione esiste solo nella build di sviluppo.
const DevPanel = import.meta.env.DEV ? defineAsyncComponent(() => import('@/components/DevPanel.vue')) : null;

type Sheet = 'none' | 'text' | 'media' | 'print';

const store = useDocumentStore();
const printer = usePrinterStore();
// Avvia il calcolo dell'anteprima in sottofondo fin dall'apertura.
usePreviewStore();
const sheet = ref<Sheet>('none');
/** Il pannello Testo è stato aperto da «+ Testo»: la tastiera compare subito. */
const focusText = ref(false);
const envError = checkEnvironment();
const toast = ref<string | null>(null);

const selectedText = computed(() => (store.selected?.type === 'text' ? store.selected : null));
const textOpen = computed(() => sheet.value === 'text' && !!selectedText.value);

function addText(): void {
  if (textOpen.value) store.removeIfEmpty(store.selectedId);
  store.addText();
  focusText.value = true;
  sheet.value = 'text';
}

function openEdit(id: string): void {
  store.select(id);
  focusText.value = false;
  sheet.value = 'text';
}

/** Chiude il pannello Testo; un testo rimasto vuoto viene eliminato. */
function closeText(): void {
  store.removeIfEmpty(store.selectedId);
  sheet.value = 'none';
}

function openPrint(): void {
  if (sheet.value === 'text') store.removeIfEmpty(store.selectedId);
  sheet.value = 'print';
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
  // Il driver della stampante si carica dopo il primo disegno dell'interfaccia.
  const start = () => void printer.tryReconnect();
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1000 });
  else setTimeout(start, 0);
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
      <button v-if="!textOpen" type="button" class="media-chip" data-testid="media-chip" @click="sheet = 'media'">
        {{ store.doc.media.name }} ▾
      </button>
      <LabelEditor @edit="openEdit" />
      <p v-if="store.doc.elements.length === 0" class="hint">Tocca «+ Testo» per scrivere sull'etichetta.</p>
    </main>

    <!-- Pannello Testo agganciato: l'etichetta resta visibile sopra mentre si scrive. -->
    <section v-if="textOpen && selectedText" class="dock" aria-label="Testo" data-testid="text-panel">
      <div class="dock-body">
        <TextProperties :key="selectedText.id" :element="selectedText" :autofocus="focusText" />
      </div>
      <div class="dock-actions">
        <button type="button" class="danger" aria-label="Elimina il testo" @click="removeSelected">Elimina</button>
        <button type="button" data-testid="text-done" @click="closeText">Fine</button>
        <button type="button" class="primary" data-testid="text-print" @click="openPrint">Stampa</button>
      </div>
    </section>

    <nav v-else class="actions" :class="{ two: !store.selectedId }" aria-label="Azioni">
      <button type="button" data-testid="add-text" @click="addText">＋ Testo</button>
      <template v-if="store.selectedId">
        <button type="button" :disabled="!selectedText" data-testid="edit-selected" @click="openEdit(store.selectedId)">
          Modifica
        </button>
        <button type="button" class="danger" @click="removeSelected">Elimina</button>
      </template>
      <button type="button" class="primary" data-testid="open-print" @click="openPrint">Stampa</button>
    </nav>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>

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
  min-height: 96px;
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

.dock {
  flex: 0 1 auto;
  max-height: 58dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 16px rgb(0 0 0 / 0.12);
}

.dock-body {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 12px 4px;
  display: grid;
  gap: 12px;
}

.dock-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
}

.actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.actions.two {
  grid-template-columns: 1fr 1fr;
}

.actions button,
.dock-actions button {
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
