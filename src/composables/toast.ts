/** Messaggio breve in basso (per esempio «Stampata ✓»), che sparisce da solo. */
import { ref, type Ref } from 'vue';

/** Durata del messaggio. */
export const TOAST_MS = 3000;

export interface Toast {
  text: Ref<string | null>;
  /** Mostra un messaggio (sostituisce il precedente); `null` lo toglie subito. */
  show(text: string | null): void;
}

export function useToast(ms = TOAST_MS): Toast {
  const text = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  function show(next: string | null): void {
    if (timer) clearTimeout(timer);
    timer = null;
    text.value = next;
    if (next) timer = setTimeout(() => (text.value = null), ms);
  }
  return { text, show };
}
