import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type { LabelDocument } from '@/model/types';
import { createPrinterPort } from '@/printer';
import { appError, unwrapError, type AppError } from '@/printer/errors';
import { runPrint } from '@/printer/print-flow';
import type { AppPrinterStatus, Density, DetectedMedia, PrinterInfo, PrinterPort } from '@/printer/types';
import type { PreparedLabel } from '@/render/export';
import { loadSettings, saveSettings } from '@/settings';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'printing';

export const usePrinterStore = defineStore('printer', () => {
  const port = shallowRef<PrinterPort | null>(null);
  const state = ref<ConnectionState>('disconnected');
  const info = ref<PrinterInfo | null>(null);
  const status = ref<AppPrinterStatus | null>(null);
  const detected = ref<DetectedMedia | null>(null);
  /** `true` se la lettura NFC è stata tentata ed è fallita. */
  const mediaReadFailed = ref(false);
  const error = ref<AppError | null>(null);
  const copies = ref(1);
  const density = ref<Density>(loadSettings().density ?? 'normal');
  watch(density, (d) => saveSettings({ density: d }));
  const lastPrintAt = ref<number | null>(null);
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
    detected.value = null;
    mediaReadFailed.value = false;
  }

  async function afterConnect(p: PrinterPort): Promise<void> {
    try {
      status.value = await p.getStatus();
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
      // Non interferisce con un collegamento manuale già avviato o riuscito.
      if (state.value !== 'disconnected') return;
      const printerInfo = await p.reconnect();
      // Nel frattempo l'utente potrebbe aver già collegato a mano.
      if (!printerInfo || state.value !== 'disconnected') return;
      attach(p, printerInfo);
      error.value = null;
      await afterConnect(p);
    } catch {
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
    detected.value = result;
    mediaReadFailed.value = result === null;
    return result;
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

  async function print(
    doc: LabelDocument,
    prepare?: (doc: LabelDocument) => Promise<PreparedLabel>,
  ): Promise<boolean> {
    const p = port.value;
    error.value = null;
    if (!p?.connected) {
      error.value = appError('not-connected');
      return false;
    }
    state.value = 'printing';
    try {
      await runPrint(p, doc, { copies: copies.value, density: density.value }, prepare);
      lastPrintAt.value = Date.now();
      // Le copie tornano a 1: evita di ristampare più copie per errore.
      copies.value = 1;
      return true;
    } catch (err) {
      error.value = unwrapError(err);
      return false;
    } finally {
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
    mediaReadFailed,
    error,
    copies,
    density,
    lastPrintAt,
    blockingProblems,
    warnings,
    ensurePort,
    connect,
    tryReconnect,
    disconnect,
    readMedia,
    refreshStatus,
    print,
    recover,
    clearError,
  };
});
