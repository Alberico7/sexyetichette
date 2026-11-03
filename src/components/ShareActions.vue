<script setup lang="ts">
/** Pulsanti «Copia» e «Condividi» per un testo di diagnostica. */
import { ref } from 'vue';
import { canShare, copyText, shareText } from '@/share';

const props = withDefaults(
  defineProps<{
    /** Titolo per il menu di condivisione. */
    title: string;
    /** Testo da copiare o condividere, calcolato al momento del tocco. */
    text: () => string;
    copyLabel?: string;
    testid?: string;
  }>(),
  { copyLabel: 'Copia', testid: 'share' },
);

const supported = canShare();
const note = ref<string | null>(null);

async function copy(): Promise<void> {
  note.value = (await copyText(props.text())) ? 'Copiato negli appunti.' : 'Copia non riuscita: seleziona e copia il testo a mano.';
}

async function share(): Promise<void> {
  const outcome = await shareText(props.title, props.text());
  note.value = outcome === 'failed' ? 'Condivisione non riuscita: usa «Copia».' : null;
}
</script>

<template>
  <div class="share">
    <div class="row">
      <button type="button" class="grow" :data-testid="`${testid}-copy`" @click="copy">{{ copyLabel }}</button>
      <button v-if="supported" type="button" class="grow" :data-testid="`${testid}-share`" @click="share">Condividi</button>
    </div>
    <p v-if="note" class="note" role="status">{{ note }}</p>
  </div>
</template>

<style scoped>
.share {
  display: grid;
  gap: 6px;
}

.note {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
