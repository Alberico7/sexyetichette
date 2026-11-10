/**
 * Stato del pulsante microfono nella casella del testo: conferma dello scaricamento,
 * preparazione, ascolto, riconoscimento, avvisi. Vedi docs/2026-11-10-dettatura.md.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { dictationToText } from './dictation';
import { voiceEngine, voiceModelDownloaded, type VoiceEngine } from './engine';

export type DictationState = 'idle' | 'confirm' | 'downloading' | 'preparing' | 'listening' | 'recognizing';

export const SLOW_HINT =
  'Riconoscimento lento. Su Vanadium attiva «JavaScript JIT» per questo sito, nelle impostazioni del sito.';

/** L'avviso di lentezza compare una volta sola per sessione. */
let slowWarned = false;

function errorText(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microfono non consentito: permettilo per questo sito nelle impostazioni del browser.';
  if (name === 'NotFoundError') return 'Nessun microfono trovato.';
  return `Dettatura non riuscita: ${e instanceof Error ? e.message : String(e)}`;
}

/** `onText` riceve il testo finito, già trasformato (numeri, simboli, maiuscole). */
export function useDictation(onText: (text: string) => void) {
  const state = ref<DictationState>('idle');
  const partial = ref('');
  const message = ref('');
  const progress = ref<number | null>(null);
  let pressing = false;
  let engine: VoiceEngine | null = null;

  const getEngine = async () => (engine ??= await voiceEngine());

  // Modello già nel telefono: si prepara subito, così è pronto alla prima pressione.
  onMounted(() => {
    void (async () => {
      try {
        if (await voiceModelDownloaded()) await (await getEngine()).prepare();
      } catch {
        // si riproverà alla pressione, mostrando l'errore
      }
    })();
  });

  onUnmounted(() => engine?.closeMic());

  async function press(): Promise<void> {
    if (state.value !== 'idle' && state.value !== 'confirm') return;
    pressing = true;
    message.value = '';
    try {
      if (!(await voiceModelDownloaded())) {
        state.value = 'confirm';
        return;
      }
      const e = await getEngine();
      state.value = 'preparing';
      await e.prepare();
      if (!pressing) {
        state.value = 'idle';
        message.value = 'Pronto: tieni premuto e parla.';
        return;
      }
      partial.value = '';
      await e.start((p) => (partial.value = p));
      if (!pressing) {
        // lasciato mentre si apriva il microfono (o si chiedeva il permesso)
        await e.stop();
        state.value = 'idle';
        return;
      }
      state.value = 'listening';
    } catch (err) {
      state.value = 'idle';
      message.value = errorText(err);
    }
  }

  async function release(): Promise<void> {
    pressing = false;
    if (state.value !== 'listening') return;
    state.value = 'recognizing';
    try {
      const result = await engine!.stop();
      const text = dictationToText(result.text);
      partial.value = '';
      if (text) onText(text);
      else message.value = 'Non ho sentito niente: tieni premuto mentre parli.';
      if (!slowWarned && result.ms > Math.max(1500, result.audioMs)) {
        slowWarned = true;
        message.value = SLOW_HINT;
      }
    } catch (err) {
      message.value = errorText(err);
    } finally {
      partial.value = '';
      state.value = 'idle';
    }
  }

  async function confirmDownload(): Promise<void> {
    state.value = 'downloading';
    try {
      const e = await getEngine();
      await e.prepare((text, fraction) => {
        message.value = text;
        progress.value = fraction ?? null;
      });
      message.value = 'Pronto: tieni premuto e parla.';
    } catch (err) {
      message.value = errorText(err);
    } finally {
      progress.value = null;
      state.value = 'idle';
    }
  }

  function cancelDownload(): void {
    state.value = 'idle';
  }

  return { state, partial, message, progress, press, release, confirmDownload, cancelDownload };
}
