import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type { LabelDocument } from '@/model/types';
import { diagLog } from '@/diagnostics/log';
import { createPrinterPort } from '@/printer';
import { appError, unwrapError, type AppError } from '@/printer/errors';
import { runJob, runPrint } from '@/printer/print-flow';
import type {
  AppPrinterStatus,
  Density,
  DetectedMedia,
  MediaReadResult,
  PrintControl,
  PrintJob,
  PrintOutcome,
  PrinterInfo,
  PrinterPort,
} from '@/printer/types';
import type { PreparedLabel } from '@/render/export';
import { loadSettings, saveSettings } from '@/settings';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'printing';

/** Stampa da più copie interrotta a metà: il titolo dice quante etichette erano partite. */
function describePartial(e: AppError): AppError {
  if (!e.partial) return e;
  const { sent, total } = e.partial;
  return {
    ...e,
    title: `Stampa interrotta dopo ${sent} ${sent === 1 ? 'etichetta inviata' : 'etichette inviate'} su ${total}`,
    hint: `${e.title}. ${e.hint}`,
  };
}

export const usePrinterStore = defineStore('printer', () => {
  const port = shallowRef<PrinterPort | null>(null);
  const state = ref<ConnectionState>('disconnected');
  const info = ref<PrinterInfo | null>(null);
  const status = ref<AppPrinterStatus | null>(null);
  /** Ultimo esito della lettura del rotolo (NFC). */
  const mediaRead = shallowRef<MediaReadResult | null>(null);
  const detected = computed<DetectedMedia | null>(() => (mediaRead.value?.ok ? mediaRead.value.detected : null));
  /** `true` se la lettura NFC è stata tentata ed è fallita. */
  const mediaReadFailed = computed(() => mediaRead.value !== null && !mediaRead.value.ok);
  const error = ref<AppError | null>(null);
  // Ogni errore mostrato all'utente finisce nel registro, con il messaggio originale.
  watch(error, (e) => {
    if (e) diagLog.add('error', `${e.code}: ${e.title}`, e.detail);
  });
  watch(
    () => state.value,
    (s, before) => diagLog.add('app', `Stato del collegamento: ${before} → ${s}`),
  );
  const copies = ref(1);
  // Predefinita «Scura» (130%): sulla 550 vera la «Normale» risultava troppo chiara (2026-11-06).
  const density = ref<Density>(loadSettings().density ?? 'high');
  watch(density, (d) => saveSettings({ density: d }));
  const lastPrintAt = ref<number | null>(null);
  /** Stampa in corso da più copie: etichette inviate sul totale. */
  const progress = ref<{ sent: number; total: number } | null>(null);
  /** «Ferma» toccato: la stampa in corso non manda altre etichette. */
  const stopRequested = ref(false);
  /** Esito dell'ultima stampa riuscita (anche se fermata). */
  const lastOutcome = shallowRef<PrintOutcome | null>(null);
  let unsubscribeStatus: (() => void) | null = null;
  let unsubscribeDisconnect: (() => void) | null = null;

  const blockingProblems = computed(() => (status.value?.problems ?? []).filter((p) => !p.warning));
  const warnings = computed(() => (status.value?.problems ?? []).filter((p) => p.warning));

  // Un solo collegamento per tutta l'app: se il ricollegamento automatico all'avvio
  // e il tocco su «Collega» arrivano insieme, devono usare lo stesso oggetto.
  let portPromise: Promise<PrinterPort> | null = null;

  function ensurePort(): Promise<PrinterPort> {
    portPromise ??= createPrinterPort().then((p) => {
      port.value = p;
      // Stampante già autorizzata inserita ad app aperta: collegamento automatico.
      p.onDeviceAvailable(() => {
        if (state.value === 'disconnected') void tryReconnect();
      });
      return p;
    });
    return portPromise;
  }

  function clearError(): void {
    error.value = null;
  }

  function attach(p: PrinterPort, printerInfo: PrinterInfo): void {
    diagLog.add(
      'app',
      `Collegata: ${printerInfo.model} (${printerInfo.key}), ID 0x${printerInfo.vendorId.toString(16)}:0x${printerInfo.productId.toString(16)}`,
    );
    info.value = printerInfo;
    state.value = 'connected';
    unsubscribeStatus?.();
    unsubscribeDisconnect?.();
    unsubscribeStatus = p.onStatus(
      (s) => {
        status.value = s;
      },
      (err) => {
        if (state.value !== 'printing') error.value = err;
      },
    );
    unsubscribeDisconnect = p.onDisconnect(() => {
      reset();
      error.value = appError('disconnected');
    });
  }

  function reset(): void {
    unsubscribeStatus?.();
    unsubscribeDisconnect?.();
    unsubscribeStatus = null;
    unsubscribeDisconnect = null;
    state.value = 'disconnected';
    info.value = null;
    status.value = null;
    mediaRead.value = null;
  }

  async function afterConnect(p: PrinterPort): Promise<void> {
    try {
      status.value = await p.getStatus();
      const s = status.value;
      diagLog.add(
        'app',
        `Primo stato: ${s.ready ? 'pronta' : 'non pronta'}, rotolo ${s.mediaLoaded ? 'presente' : 'assente'}${s.problems.length ? `, ${s.problems.map((x) => x.code).join(', ')}` : ''}`,
      );
    } catch (err) {
      error.value = unwrapError(err);
    }
    await readMedia();
  }

  /** Da chiamare dentro il gestore di un tocco: apre il selettore USB. */
  async function connect(): Promise<boolean> {
    error.value = null;
    state.value = 'connecting';
    try {
      const p = await ensurePort();
      const printerInfo = await p.connect();
      attach(p, printerInfo);
      await afterConnect(p);
      return true;
    } catch (err) {
      reset();
      error.value = unwrapError(err);
      return false;
    }
  }

  /** Riapre in silenzio una stampante già autorizzata (all'avvio). */
  async function tryReconnect(): Promise<void> {
    try {
      const p = await ensurePort();
      diagLog.add('app', 'Collegamento automatico: ricerca di una stampante già autorizzata');
      // Non interferisce con un collegamento manuale già avviato o riuscito.
      if (state.value !== 'disconnected') return;
      const printerInfo = await p.reconnect();
      // Nel frattempo l'utente potrebbe aver già collegato a mano.
      if (!printerInfo || state.value !== 'disconnected') return;
      attach(p, printerInfo);
      error.value = null;
      await afterConnect(p);
    } catch (err) {
      diagLog.add('warn', 'Collegamento automatico non riuscito', unwrapError(err).detail ?? unwrapError(err).title);
      reset();
    }
  }

  async function disconnect(): Promise<void> {
    const p = port.value;
    reset();
    await p?.disconnect();
  }

  async function readMedia(): Promise<DetectedMedia | null> {
    const p = port.value;
    if (!p?.connected) return null;
    const result = await p.readMedia();
    mediaRead.value = result;
    return result.ok ? result.detected : null;
  }

  async function refreshStatus(): Promise<void> {
    const p = port.value;
    if (!p?.connected) return;
    try {
      status.value = await p.getStatus();
    } catch (err) {
      error.value = unwrapError(err);
    }
  }

  /**
   * Stampa il documento. `copiesOverride`: copie scelte altrove (stampa rapida),
   * altrimenti quelle del pannello di stampa.
   */
  async function print(
    doc: LabelDocument,
    prepare?: (doc: LabelDocument) => Promise<PreparedLabel>,
    copiesOverride?: number,
  ): Promise<boolean> {
    const n = copiesOverride ?? copies.value;
    const ok = await withPrinting(async (p, control) => {
      const { outcome } = await runPrint(p, doc, { copies: n, density: density.value }, prepare, control);
      return outcome;
    });
    // Le copie tornano a 1: evita di ristampare più copie per errore.
    if (ok) copies.value = 1;
    return ok;
  }

  /** Stampa un lavoro già pronto (etichetta di prova della diagnostica). */
  async function printJob(job: PrintJob): Promise<boolean> {
    return withPrinting((p, control) => runJob(p, job, control));
  }

  /** «Ferma»: dopo l'etichetta in corso non ne parte un'altra; il lavoro si chiude normalmente. */
  function requestStop(): void {
    if (state.value === 'printing' && progress.value && progress.value.total > 1) {
      stopRequested.value = true;
      diagLog.add('app', 'Ferma toccato: nessuna altra etichetta');
    }
  }

  async function withPrinting(run: (p: PrinterPort, control: PrintControl) => Promise<PrintOutcome>): Promise<boolean> {
    const p = port.value;
    error.value = null;
    if (!p?.connected) {
      error.value = appError('not-connected');
      return false;
    }
    state.value = 'printing';
    stopRequested.value = false;
    progress.value = null;
    const control: PrintControl = {
      shouldStop: () => stopRequested.value,
      onProgress: (sent, total) => (progress.value = { sent, total }),
    };
    try {
      lastOutcome.value = await run(p, control);
      lastPrintAt.value = Date.now();
      return true;
    } catch (err) {
      error.value = describePartial(unwrapError(err));
      return false;
    } finally {
      progress.value = null;
      stopRequested.value = false;
      if (p.connected) {
        state.value = 'connected';
        void refreshStatus();
      } else {
        reset();
      }
    }
  }

  async function recover(): Promise<void> {
    const p = port.value;
    if (!p?.connected) return;
    try {
      await p.recover();
      error.value = null;
      await refreshStatus();
    } catch (err) {
      error.value = unwrapError(err);
    }
  }

  return {
    port,
    state,
    info,
    status,
    detected,
    mediaRead,
    mediaReadFailed,
    error,
    copies,
    density,
    lastPrintAt,
    progress,
    stopRequested,
    lastOutcome,
    requestStop,
    blockingProblems,
    warnings,
    ensurePort,
    connect,
    tryReconnect,
    disconnect,
    readMedia,
    refreshStatus,
    print,
    printJob,
    recover,
    clearError,
  };
});
