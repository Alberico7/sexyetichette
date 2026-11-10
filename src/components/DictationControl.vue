<script setup lang="ts">
/**
 * Dettatura nel pannello del testo: il pulsante microfono (tieni premuto e parla),
 * la conferma dello scaricamento, il testo provvisorio, i messaggi e l'avanzamento.
 * Emette `text` con il testo finito (numeri, simboli, maiuscole); l'inserimento al
 * cursore lo fa TextProperties. Vedi docs/2026-11-10-dettatura.md.
 *
 * Più elementi alla radice: TextProperties li dispone in griglia, il microfono accanto
 * alla casella e il resto sotto, a tutta larghezza.
 */
import { useDictation } from '@/voice/useDictation';

const emit = defineEmits<{ text: [text: string] }>();
const { state, partial, message, progress, press, release, confirmDownload, cancelDownload } = useDictation((t) =>
  emit('text', t),
);
</script>

<template>
  <!--
    Tieni premuto per dettare. «touchstart.prevent» evita il click finale del tocco: il pannello
    cresce verso l'alto e il click cadrebbe su «Annulla» della conferma comparsa sotto il dito.
  -->
  <button
    type="button"
    class="mic"
    :class="state"
    data-testid="dictate"
    aria-label="Tieni premuto per dettare"
    :aria-pressed="state === 'listening'"
    @pointerdown.prevent="press()"
    @pointerup="release()"
    @pointercancel="release()"
    @contextmenu.prevent
    @touchstart.prevent
  >
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>

  <div v-if="state === 'confirm'" class="dictation-confirm wide" role="dialog" data-testid="dictation-confirm">
    <p>Scaricare il riconoscimento vocale? Circa 50 MB, una volta sola. L'audio resta nel telefono.</p>
    <div class="row">
      <button type="button" class="primary grow" data-testid="dictation-download" @click="confirmDownload()">
        Scarica
      </button>
      <button type="button" class="grow" data-testid="dictation-cancel" @click="cancelDownload()">Annulla</button>
    </div>
  </div>
  <p
    v-else-if="partial || message || state === 'preparing'"
    class="dictation-status wide"
    :class="{ partial: !!partial }"
    role="status"
    data-testid="dictation-status"
  >
    {{ partial || message || (state === 'preparing' ? 'Preparazione del riconoscimento…' : '') }}
  </p>
  <progress v-if="progress !== null" class="dictation-progress wide" max="1" :value="progress" />
</template>

<style scoped>
.mic {
  flex: none;
  width: var(--tap);
  padding: 0;
  display: grid;
  place-items: center;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}

.mic.listening {
  background: var(--danger);
  border-color: var(--danger);
  color: var(--surface);
}

.mic.preparing,
.mic.recognizing,
.mic.downloading {
  color: var(--muted);
}

/* Sotto la casella e il microfono, a tutta larghezza della griglia di TextProperties. */
.wide {
  grid-column: 1 / -1;
}

.dictation-status {
  margin: 0;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.dictation-status.partial {
  color: var(--muted);
  font-style: italic;
}

.dictation-progress {
  width: 100%;
}

.dictation-confirm {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.dictation-confirm p {
  margin: 0;
}

/* Orizzontale con la tastiera aperta: resta solo la casella (docs/2026-11-08-orizzontale-tastiera.md). */
@media (max-height: 260px) {
  :root[data-screen='landscape'] .mic,
  :root[data-screen='landscape'] .dictation-status,
  :root[data-screen='landscape'] .dictation-progress {
    display: none;
  }
}
</style>
