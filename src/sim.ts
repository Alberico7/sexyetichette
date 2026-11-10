/**
 * Simulazione per lo sviluppo e i test e2e, con `?sim` nell'indirizzo: stampante,
 * dettatura e avviso di aggiornamento simulati. Vedi docs/2026-11-10-manutenibilita.md.
 *
 * Regola: ogni uso sta dentro un ramo scritto per esteso
 *
 *     if (import.meta.env.DEV || import.meta.env.MODE === 'test') { … }
 *
 * Solo così, in produzione, Vite elimina il ramo e con esso questo modulo. Una condizione
 * chiusa in una funzione non basta: il codice resterebbe nella build.
 * `scripts/check-no-simulator.mjs` cerca `__sim` nei file pubblicati.
 */

/** Tutto ciò che i test e2e possono leggere o pilotare, in un solo oggetto globale. */
export interface SimHooks {
  /** Dettatura simulata (src/voice/simulated.ts). */
  voice?: {
    /** Frasi da «riconoscere», una per pressione del microfono. */
    phrases?: string[];
    /** Il modello è già «scaricato». */
    downloaded?: boolean;
    /** Ritardo del riconoscimento in ms, per provare l'avviso di lentezza. */
    delayMs?: number;
  };
  /** Fa comparire «Nuova versione disponibile» (src/pwa/update.ts). */
  update?: () => void;
  /** La scena Konva dell'editor, per misurare l'etichetta nei test. */
  labelStage?: unknown;
}

/** C'è `?sim` nell'indirizzo. */
export function simRequested(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('sim');
}

/** L'oggetto `window.__sim`, creato al primo uso; i test possono riempirlo prima dell'avvio. */
export function simHooks(): SimHooks {
  const w = window as unknown as { __sim?: SimHooks };
  return (w.__sim ??= {});
}
