<script setup lang="ts">
/** Elenco delle etichette stampate di recente: apri, ristampa, togli. */
import { ref } from 'vue';
import type { LabelDocument } from '@/model/types';
import { formatWhen, recentSummary, type RecentLabel } from '@/storage/label-store';
import { useRecentStore } from '@/stores/recent';

const emit = defineEmits<{ open: [doc: LabelDocument]; reprint: [doc: LabelDocument] }>();
const recent = useRecentStore();
const confirmClear = ref(false);

/** Copia del documento: l'elenco non cambia se poi modifichi l'etichetta aperta. */
const copyOf = (r: RecentLabel) => JSON.parse(JSON.stringify(r.doc)) as LabelDocument;

function clearAll(): void {
  recent.clear();
  confirmClear.value = false;
}
</script>

<template>
  <p v-if="recent.items.length === 0" class="muted" data-testid="recent-empty">
    Qui compaiono le ultime etichette stampate, da riaprire o ristampare con un tocco.
  </p>
  <ul v-else class="list" data-testid="recent-list">
    <li v-for="r in recent.items" :key="r.id" class="item" data-testid="recent-item">
      <button
        type="button"
        class="open"
        :aria-label="`Apri: ${recentSummary(r.doc)}`"
        data-testid="recent-open"
        @click="emit('open', copyOf(r))"
      >
        <img v-if="r.thumbnail" class="thumb" :src="r.thumbnail" alt="" />
        <span v-else class="thumb empty" aria-hidden="true" />
        <span class="text">
          <span class="summary">{{ recentSummary(r.doc) }}</span>
          <small class="meta">{{ r.doc.media.name }} · {{ formatWhen(r.printedAt) }}</small>
        </span>
      </button>
      <div class="actions">
        <button type="button" class="primary" data-testid="recent-reprint" @click="emit('reprint', copyOf(r))">
          Ristampa
        </button>
        <button
          type="button"
          class="remove"
          :aria-label="`Togli dall'elenco: ${recentSummary(r.doc)}`"
          data-testid="recent-remove"
          @click="recent.remove(r.id)"
        >
          ✕
        </button>
      </div>
    </li>
  </ul>

  <div v-if="recent.items.length > 0" class="clear">
    <template v-if="confirmClear">
      <p>Togliere tutte le etichette dall'elenco?</p>
      <div class="row">
        <button type="button" class="grow" @click="confirmClear = false">No</button>
        <button type="button" class="danger grow" data-testid="recent-clear-confirm" @click="clearAll">Sì, svuota</button>
      </div>
    </template>
    <button v-else type="button" class="danger" data-testid="recent-clear" @click="confirmClear = true">
      Svuota l'elenco
    </button>
  </div>
</template>

<style scoped>
.muted {
  color: var(--muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.item {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-width: 0;
}

.open {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  min-width: 0;
  width: 100%;
  padding: 4px;
  background: transparent;
  border: 0;
}

.thumb {
  flex: 0 0 auto;
  width: 96px;
  height: 56px;
  object-fit: contain;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.thumb.empty {
  display: block;
}

.text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.meta {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 52px;
  gap: 6px;
}

.actions button {
  min-height: 48px;
}

.clear {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.clear p {
  margin: 0;
}
</style>
