<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import BottomSheet from '@/components/BottomSheet.vue';
import CopiesPicker from '@/components/CopiesPicker.vue';
import ErrorBanner from '@/components/ErrorBanner.vue';
import LabelEditor from '@/components/LabelEditor.vue';
import MediaPicker from '@/components/MediaPicker.vue';
import PrintSheet from '@/components/PrintSheet.vue';
import PrinterBar from '@/components/PrinterBar.vue';
import RecentSheet from '@/components/RecentSheet.vue';
import TextProperties from '@/components/TextProperties.vue';
import type { LabelDocument } from '@/model/types';
import { useQuickPrint } from '@/composables/quick-print';
import { checkEnvironment } from '@/printer/errors';
import { DEFAULT_FONT } from '@/model/fonts';
import { requestFont } from '@/render/web-fonts';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';

// Diagnostica USB: caricata solo quando serve.
const DiagnosticsPanel = defineAsyncComponent(() => import('@/components/DiagnosticsPanel.vue'));
const DiagnosticsShare = defineAsyncComponent(() => import('@/components/DiagnosticsShare.vue'));

// Il pannello di simulazione esiste solo nella build di sviluppo.
const DevPanel = import.meta.env.DEV ? defineAsyncComponent(() => import('@/components/DevPanel.vue')) : null;

type Sheet = 'none' | 'text' | 'media' | 'print' | 'copies' | 'recent' | 'diagnostics';

/** Durata dell'avviso dopo la stampa. */
const TOAST_MS = 3000;

const store = useDocumentStore();
const printer = usePrinterStore();
const quick = useQuickPrint();
// Avvia il calcolo dell'anteprima in sottofondo fin dall'apertura.
usePreviewStore();
// Con «?diagnostica» nell'indirizzo si apre subito la diagnostica USB.
const sheet = ref<Sheet>(new URLSearchParams(location.search).has('diagnostica') ? 'diagnostics' : 'none');
/** Il pannello Testo è stato aperto da «+ Testo»: la tastiera compare subito. */
const focusText = ref(false);
const envError = checkEnvironment();
const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

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

/**
 * Stampa rapida: stampa subito, senza anteprima. Se c'è un avviso da vedere
 * (stampante non pronta, etichetta vuota…) apre l'anteprima con le copie scelte.
 */
async function quickPrint(copies = 1): Promise<void> {
  if (sheet.value === 'text') store.removeIfEmpty(store.selectedId);
  if (sheet.value === 'text' || sheet.value === 'copies') sheet.value = 'none';
  const result = await quick.print(copies);
  if (result === 'preview') {
    printer.copies = copies;
    sheet.value = 'print';
  } else if (result === 'printed') {
    onPrinted(copies);
  }
}

function removeSelected(): void {
  if (store.selectedId) store.removeElement(store.selectedId);
  if (sheet.value === 'text') sheet.value = 'none';
}

function showToast(text: string | null): void {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  toast.value = text;
  if (text) toastTimer = setTimeout(() => (toast.value = null), TOAST_MS);
}

function onPrinted(copies = 1): void {
  sheet.value = 'none';
  // Lavoro finito: nessun testo selezionato, la barra mostra di nuovo «Recenti».
  store.select(null);
  showToast(copies > 1 ? `Stampate ${copies} copie ✓` : 'Stampata ✓');
}

// Un pannello aperto copre l'avviso: lo tolgo.
watch(sheet, (s) => {
  if (s !== 'none') showToast(null);
});

function openRecent(doc: LabelDocument): void {
  store.replaceDocument(doc);
  sheet.value = 'none';
}

function reprintRecent(doc: LabelDocument): void {
  store.replaceDocument(doc);
  sheet.value = 'print';
}

// Se il rotolo viene rilevato e l'etichetta è ancora vuota, adotto il suo formato.
watch(
  () => printer.detected,
  (detected) => {
    if (detected && store.doc.elements.length === 0) store.setMedia(detected.media);
  },
);

// Stesso formato del rotolo ma con la misura arrotondata del catalogo (es. 25 invece di 25,4 mm):
// prendo la misura vera del chip. Verso e testi (in mm dal bordo) restano come sono.
watch(
  () => [printer.detected, store.doc.media.id, store.doc.media.widthMm, store.doc.media.lengthMm] as const,
  ([detected]) => {
    const roll = detected?.media;
    const cur = store.doc.media;
    if (!roll || roll.id !== cur.id) return;
    if (roll.widthMm !== cur.widthMm || roll.lengthMm !== cur.lengthMm || roll.lengthDots !== cur.lengthDots) {
      store.setMedia(roll, store.doc.direction);
    }
  },
  { immediate: true },
);

onMounted(() => {
  // Il driver della stampante si carica dopo il primo disegno dell'interfaccia.
  // Il carattere dei nuovi testi arriva in sottofondo, così è pronto al primo «+ Testo».
  const start = () => {
    void printer.tryReconnect();
    requestFont(DEFAULT_FONT);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1000 });
  else setTimeout(start, 0);
});
</script>

<template>
  <div class="app">
    <PrinterBar @diagnostics="sheet = 'diagnostics'" />

    <div v-if="envError" class="env-error" role="alert">
      <strong>{{ envError.title }}</strong>
      <p>{{ envError.hint }}</p>
      <button type="button" data-testid="open-diagnostics" @click="sheet = 'diagnostics'">
        Apri la diagnostica USB
      </button>
    </div>
    <ErrorBanner
      v-if="printer.error"
      :error="printer.error"
      :can-recover="printer.state === 'connected'"
      @dismiss="printer.clearError()"
      @recover="printer.recover()"
      @diagnostics="sheet = 'diagnostics'"
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
        <div class="print-pair">
          <button
            type="button"
            class="primary"
            data-testid="text-print"
            :disabled="quick.printing.value"
            @click="quickPrint()"
          >
            {{ quick.printing.value ? 'Stampa…' : 'Stampa' }}
          </button>
          <button
            type="button"
            class="copies"
            data-testid="text-copies"
            aria-label="Stampa più copie"
            @click="sheet = 'copies'"
          >
            ×1
          </button>
        </div>
      </div>
    </section>

    <nav v-else class="actions" :class="{ three: !store.selectedId }" aria-label="Azioni">
      <button type="button" data-testid="add-text" @click="addText">＋ Testo</button>
      <button v-if="!store.selectedId" type="button" data-testid="open-recent" @click="sheet = 'recent'">
        Recenti
      </button>
      <template v-if="store.selectedId">
        <button type="button" :disabled="!selectedText" data-testid="edit-selected" @click="openEdit(store.selectedId)">
          Modifica
        </button>
        <button type="button" class="danger" @click="removeSelected">Elimina</button>
      </template>
      <button
        type="button"
        class="preview-btn"
        data-testid="open-preview"
        aria-label="Anteprima"
        title="Anteprima"
        @click="openPrint"
      >
        <span aria-hidden="true">👁</span>
      </button>
      <div class="print-pair">
        <button
          type="button"
          class="primary"
          data-testid="open-print"
          :disabled="quick.printing.value"
          @click="quickPrint()"
        >
          {{ quick.printing.value ? 'Stampa…' : 'Stampa' }}
        </button>
        <button
          type="button"
          class="copies"
          data-testid="open-copies"
          aria-label="Stampa più copie"
          @click="sheet = 'copies'"
        >
          ×1
        </button>
      </div>
    </nav>

    <div v-if="toast" class="toast" role="status" data-testid="toast">{{ toast }}</div>

    <BottomSheet :open="sheet === 'media'" title="Formato etichetta" @close="sheet = 'none'">
      <MediaPicker @diagnostics="sheet = 'diagnostics'" />
    </BottomSheet>
    <BottomSheet :open="sheet === 'copies'" title="Quante copie?" @close="sheet = 'none'">
      <CopiesPicker v-if="sheet === 'copies'" @print="quickPrint" />
    </BottomSheet>

    <BottomSheet :open="sheet === 'print'" title="Anteprima e stampa" @close="sheet = 'none'">
      <PrintSheet :active="sheet === 'print'" @printed="onPrinted" />
    </BottomSheet>
    <BottomSheet :open="sheet === 'recent'" title="Recenti" @close="sheet = 'none'">
      <RecentSheet @open="openRecent" @reprint="reprintRecent" />
    </BottomSheet>
    <BottomSheet :open="sheet === 'diagnostics'" title="Diagnostica" @close="sheet = 'none'">
      <DiagnosticsPanel v-if="sheet === 'diagnostics'" />
      <template #footer>
        <DiagnosticsShare v-if="sheet === 'diagnostics'" />
      </template>
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
  grid-template-columns: 1fr 1fr 1.9fr;
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 44px minmax(0, 1.55fr);
  gap: 6px;
  padding: 8px 8px calc(8px + var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.actions.three {
  grid-template-columns: repeat(2, minmax(0, 1fr)) 52px minmax(0, 1.6fr);
}

/* «Stampa» e «×1» affiancati: stampa subito, oppure sceglie le copie. */
.print-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 4px;
  min-width: 0;
}

.print-pair .copies {
  font-weight: 600;
}

.preview-btn {
  font-size: 1.2rem;
}

.actions:not(.three) button {
  font-size: 0.95rem;
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
