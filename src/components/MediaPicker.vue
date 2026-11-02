<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ContentDirection, MediaFormat } from '@/model/types';
import { CATALOG, customMedia, sameMediaSize } from '@/printer/media';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';

const store = useDocumentStore();
const printer = usePrinterStore();
const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return CATALOG;
  return CATALOG.filter(
    (m) => m.name.toLowerCase().includes(q) || m.skus?.some((s) => s.toLowerCase().includes(q)),
  );
});

const customWidth = ref(57);
const customLength = ref<number | null>(32);

function choose(media: MediaFormat): void {
  store.setMedia(media);
}

function chooseCustom(): void {
  const w = Number(customWidth.value);
  const l = customLength.value ? Number(customLength.value) : undefined;
  if (!(w >= 5 && w <= 57)) return;
  choose(customMedia(w, l));
}

const mismatch = computed(
  () => printer.detected && !sameMediaSize(printer.detected.media, store.doc.media),
);

function setDirection(d: ContentDirection): void {
  store.setDirection(d);
}

async function reread(): Promise<void> {
  const found = await printer.readMedia();
  if (found) choose(found.media);
}
</script>

<template>
  <div class="detected" data-testid="media-detected">
    <template v-if="printer.detected">
      <div>
        <strong>Rotolo rilevato:</strong> {{ printer.detected.media.name }}
        <small v-if="printer.detected.sku"> (codice {{ printer.detected.sku }})</small>
      </div>
      <p v-if="mismatch" class="warn">
        Il formato scelto è diverso dal rotolo inserito: la stampante userà comunque le misure del rotolo.
      </p>
      <button v-if="mismatch" type="button" class="primary" @click="choose(printer.detected.media)">
        Usa il rotolo rilevato
      </button>
    </template>
    <template v-else-if="printer.state === 'connected' && printer.mediaReadFailed">
      <p class="warn">Non è stato possibile leggere il rotolo: scegli il formato dall'elenco.</p>
    </template>
    <template v-else-if="printer.state === 'disconnected'">
      <p class="muted">Collega la stampante per rilevare il rotolo automaticamente, oppure scegli il formato qui sotto.</p>
    </template>
    <button v-if="printer.state === 'connected'" type="button" @click="reread">Rileggi il rotolo</button>
  </div>

  <div class="field">
    Verso del contenuto
    <div class="segmented" role="group" aria-label="Verso del contenuto">
      <button type="button" :aria-pressed="store.doc.direction === 'along'" @click="setDirection('along')">
        Lungo il rotolo
      </button>
      <button type="button" :aria-pressed="store.doc.direction === 'across'" @click="setDirection('across')">
        Attraverso il rotolo
      </button>
    </div>
  </div>

  <label v-if="store.doc.media.lengthMm === undefined" class="field">
    Lunghezza dell'etichetta continua (mm)
    <input
      type="number"
      inputmode="decimal"
      min="10"
      max="500"
      :value="store.doc.continuousLengthMm"
      @change="store.setContinuousLength(Number(($event.target as HTMLInputElement).value))"
    />
  </label>

  <label class="field">
    Cerca formato o codice
    <input v-model="query" type="text" inputmode="search" placeholder="es. 30252, 89×28, indirizzo" />
  </label>

  <ul class="list" role="listbox" aria-label="Formati">
    <li v-for="m in filtered" :key="m.id">
      <button
        type="button"
        role="option"
        :aria-selected="m.id === store.doc.media.id"
        :class="{ current: m.id === store.doc.media.id }"
        @click="choose(m)"
      >
        <span class="name">{{ m.name }}</span>
        <small v-if="m.skus?.length">{{ m.skus.join(', ') }}</small>
      </button>
    </li>
  </ul>

  <fieldset class="custom">
    <legend>Formato personalizzato</legend>
    <div class="row">
      <label class="field grow">
        Larghezza (mm)
        <input v-model.number="customWidth" type="number" inputmode="decimal" min="5" max="57" />
      </label>
      <label class="field grow">
        Lunghezza (mm, vuoto = continuo)
        <input v-model.number="customLength" type="number" inputmode="decimal" min="5" max="500" />
      </label>
    </div>
    <button type="button" @click="chooseCustom">Usa formato personalizzato</button>
  </fieldset>
</template>

<style scoped>
.detected {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.detected p {
  margin: 0;
}

.warn {
  color: var(--warn);
}

.muted {
  color: var(--muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.list button {
  width: 100%;
  text-align: left;
  display: grid;
  padding: 8px 12px;
}

.list button.current {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.list small {
  color: var(--muted);
}

.custom {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  display: grid;
  gap: 10px;
}
</style>
