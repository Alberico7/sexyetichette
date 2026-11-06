/**
 * Controllo «la stampante risponde?» per il polling di stato della libreria.
 *
 * Il polling della libreria (ogni 4 s) ignora gli errori: se non arriva nessuno
 * stato per 30 s segnaliamo noi «La stampante non risponde». Quando il telefono
 * spegne lo schermo o mette l'app in secondo piano, però, i timer della pagina
 * si fermano: al ritorno il tempo trascorso non è colpa della stampante. In quel
 * caso si chiede subito lo stato e si dà l'allarme solo se non risponde.
 * Vedi docs/2026-11-06-falso-allarme-non-risponde.md.
 */

/** Nessuno stato per questo tempo, con la pagina attiva: allarme. */
export const STATUS_TIMEOUT_MS = 30_000;
/** Ogni quanto gira il controllo. */
export const WATCHDOG_INTERVAL_MS = 5_000;
/** Fra due giri del controllo oltre questo tempo: la pagina era sospesa. */
export const PAUSE_THRESHOLD_MS = 15_000;

export interface WatchdogDeps {
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  /** La pagina è nascosta (schermo spento, app in secondo piano). */
  isHidden: () => boolean;
  /** Avvisa quando la pagina diventa nascosta o visibile; restituisce la funzione per smettere. */
  onVisibilityChange: (cb: () => void) => () => void;
  /** Chiede subito lo stato alla stampante: `true` se ha risposto. */
  requestStatus: () => Promise<boolean>;
  /** La stampante non risponde. */
  onTimeout: (detail: string) => void;
  /** Nota per il registro della diagnostica. */
  log: (message: string) => void;
}

export interface StatusWatchdog {
  /** È arrivato uno stato dalla stampante. */
  seen(): void;
  stop(): void;
}

export function startStatusWatchdog(deps: WatchdogDeps): StatusWatchdog {
  let lastOk = deps.now();
  let lastTick = lastOk;
  let hiddenAt: number | null = deps.isHidden() ? lastOk : null;
  let checking = false;
  let stopped = false;

  /** Dopo una pausa della pagina: stato subito, allarme solo se la stampante non risponde. */
  function resume(): void {
    lastOk = deps.now();
    if (checking) return;
    checking = true;
    deps
      .requestStatus()
      .then((ok) => {
        if (stopped) return;
        if (ok) lastOk = deps.now();
        else deps.onTimeout('Nessuna risposta alla richiesta di stato fatta al ritorno nell’app');
      })
      .catch(() => {
        if (!stopped) deps.onTimeout('Nessuna risposta alla richiesta di stato fatta al ritorno nell’app');
      })
      .finally(() => {
        checking = false;
      });
  }

  const tick = () => {
    const t = deps.now();
    const gap = t - lastTick;
    lastTick = t;
    // Pagina nascosta: nessuno guarda l'app, nessun allarme. Al ritorno ci pensa resume().
    if (deps.isHidden()) return;
    if (gap > PAUSE_THRESHOLD_MS) {
      deps.log(`Pagina sospesa per ${Math.round(gap / 1000)} s: stato richiesto al ritorno`);
      resume();
      return;
    }
    if (!checking && t - lastOk > STATUS_TIMEOUT_MS) {
      deps.onTimeout('Nessuno stato ricevuto da 30 secondi');
      lastOk = t;
    }
  };

  const handle = deps.setInterval(tick, WATCHDOG_INTERVAL_MS);
  const stopVisibility = deps.onVisibilityChange(() => {
    const t = deps.now();
    if (deps.isHidden()) {
      hiddenAt = t;
      return;
    }
    const away = hiddenAt === null ? 0 : t - hiddenAt;
    hiddenAt = null;
    lastTick = t;
    // Il controllo ha già visto la pausa e chiesto lo stato: niente doppioni.
    if (checking) return;
    if (away > PAUSE_THRESHOLD_MS)
      deps.log(`Pagina sospesa per ${Math.round(away / 1000)} s: stato richiesto al ritorno`);
    resume();
  });

  return {
    seen() {
      lastOk = deps.now();
    },
    stop() {
      stopped = true;
      deps.clearInterval(handle);
      stopVisibility();
    },
  };
}

/** Dipendenze vere del browser, tranne quelle legate alla stampante. */
export function browserWatchdogDeps(): Pick<
  WatchdogDeps,
  'now' | 'setInterval' | 'clearInterval' | 'isHidden' | 'onVisibilityChange'
> {
  return {
    now: () => Date.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    onVisibilityChange: (cb) => {
      if (typeof document === 'undefined') return () => {};
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
  };
}
