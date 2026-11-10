/**
 * Tasto indietro di Android (e del browser): con un pannello aperto lo chiude,
 * invece di uscire dall'app. Ogni apertura aggiunge un passo alla cronologia;
 * chiudendo il pannello con «Fine» o ✕ il passo si toglie.
 * Vedi docs/2026-11-10-pwa.md.
 */
import { onMounted, onUnmounted, watch, type Ref } from 'vue';

const MARK = 'rubeculabelPanel';

export function useBackClosesPanel(isOpen: Ref<boolean>, close: () => void): void {
  let closingFromBack = false;
  /**
   * «Indietro» chiesti dall'app per togliere il passo di un pannello chiuso con Fine o ✕.
   * Il browser li esegue in ritardo: se nel frattempo si è aperto un altro pannello
   * (per esempio l'anteprima dopo la stampa rapida), non devono chiuderlo.
   */
  let ownBacks = 0;

  // «sync»: il cambio si vede subito, anche dentro `close()` chiamata da «indietro».
  watch(
    isOpen,
    (open) => {
      if (open) {
        history.pushState({ [MARK]: true }, '');
      } else if (!closingFromBack && (history.state as Record<string, unknown> | null)?.[MARK]) {
        // Chiuso dall'app: si toglie il passo, così «indietro» non resta «a vuoto».
        ownBacks++;
        history.back();
      }
    },
    { flush: 'sync' },
  );

  const onPop = () => {
    if (ownBacks > 0) {
      ownBacks--;
      return;
    }
    if (!isOpen.value) return;
    closingFromBack = true;
    try {
      close();
    } finally {
      closingFromBack = false;
    }
  };

  onMounted(() => window.addEventListener('popstate', onPop));
  onUnmounted(() => window.removeEventListener('popstate', onPop));
}
