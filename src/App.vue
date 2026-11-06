<script setup lang="ts">
/**
 * Schema della pagina e pannelli. Le singole parti stanno nei loro moduli:
 * barra in basso (ActionBar), pulsanti di stampa (PrintButtons), stampa rapida,
 * rotolo letto, messaggio breve e avvio in sottofondo (composables/).
 * Vedi docs/2026-11-06-riordino-app-vue.md.
 */
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import ActionBar from '@/components/ActionBar.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import CopiesPicker from '@/components/CopiesPicker.vue';
import ErrorBanner from '@/components/ErrorBanner.vue';
import LabelEditor from '@/components/LabelEditor.vue';
import MediaPicker from '@/components/MediaPicker.vue';
import PrintSheet from '@/components/PrintSheet.vue';
import PrinterBar from '@/components/PrinterBar.vue';
import RecentSheet from '@/components/RecentSheet.vue';
import TextDock from '@/components/TextDock.vue';
import { useQuickPrint } from '@/composables/quick-print';
import { useRollMedia } from '@/composables/roll-media';
import { useBackgroundStartup } from '@/composables/startup';
import { useToast } from '@/composables/toast';
import type { LabelDocument } from '@/model/types';
import { checkEnvironment } from '@/printer/errors';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';

// Diagnostica USB: caricata solo quando serve.
const DiagnosticsPanel = defineAsyncComponent(() => import('@/components/DiagnosticsPanel.vue'));
const DiagnosticsShare = defineAsyncComponent(() => import('@/components/DiagnosticsShare.vue'));

// Il pannello di simulazione esiste solo nella build di sviluppo.
const DevPanel = import.meta.env.DEV ? defineAsyncComponent(() => import('@/components/DevPanel.vue')) : null;

type Sheet = 'none' | 'text' | 'media' | 'print' | 'copies' | 'recent' | 'diagnostics';

const store = useDocumentStore();
const printer = usePrinterStore();
const quick = useQuickPrint();
const toast = useToast();
// Avvia il calcolo dell'anteprima in sottofondo fin dall'apertura.
usePreviewStore();
useRollMedia();
useBackgroundStartup();

// Con «?diagnostica» nell'indirizzo si apre subito la diagnostica USB.
const sheet = ref<Sheet>(new URLSearchParams(location.search).has('diagnostica') ? 'diagnostics' : 'none');
/** Il pannello Testo è stato aperto da «+ Testo»: la tastiera compare subito. */
const focusText = ref(false);
const envError = checkEnvironment();

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

function onPrinted(copies = 1): void {
  sheet.value = 'none';
  // Lavoro finito: nessun testo selezionato, la barra mostra di nuovo «Recenti».
  store.select(null);
  const o = printer.lastOutcome;
  if (o?.stopped) toast.show(`Fermata: stampate ${o.sent} ${o.sent === 1 ? 'copia' : 'copie'} su ${o.total}`);
  else toast.show(copies > 1 ? `Stampate ${copies} copie ✓` : 'Stampata ✓');
}

// Un pannello aperto copre l'avviso: lo tolgo.
watch(sheet, (s) => {
  if (s !== 'none') toast.show(null);
});

function openRecent(doc: LabelDocument): void {
  store.replaceDocument(doc);
  sheet.value = 'none';
}

function reprintRecent(doc: LabelDocument): void {
  store.replaceDocument(doc);
  sheet.value = 'print';
}
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

    <TextDock
      v-if="textOpen && selectedText"
      :element="selectedText"
      :autofocus="focusText"
      :printing="quick.printing.value"
      @remove="removeSelected"
      @done="closeText"
      @print="quickPrint()"
      @copies="sheet = 'copies'"
    />

    <ActionBar
      v-else
      :selected="!!store.selectedId"
      :can-edit="!!selectedText"
      :printing="quick.printing.value"
      @add-text="addText"
      @recent="sheet = 'recent'"
      @edit="store.selectedId && openEdit(store.selectedId)"
      @remove="removeSelected"
      @preview="openPrint"
      @print="quickPrint()"
      @copies="sheet = 'copies'"
    />

    <div v-if="toast.text.value" class="toast" role="status" data-testid="toast">{{ toast.text.value }}</div>

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
