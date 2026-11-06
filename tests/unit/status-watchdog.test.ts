/**
 * Niente falso allarme «La stampante non risponde» dopo lo schermo spento.
 * Vedi docs/2026-11-06-falso-allarme-non-risponde.md.
 */
import { describe, expect, it } from 'vitest';
import { WATCHDOG_INTERVAL_MS, startStatusWatchdog } from '@/printer/status-watchdog';

/** Orologio, timer e visibilità finti; la stampante risponde secondo `answers`. */
function setup(answers: { ok: boolean } = { ok: true }) {
  let now = 0;
  let tickFn: (() => void) | null = null;
  let hidden = false;
  let visibilityCb: (() => void) | null = null;
  const timeouts: string[] = [];
  const logs: string[] = [];
  let requests = 0;
  const watchdog = startStatusWatchdog({
    now: () => now,
    setInterval: (fn) => {
      tickFn = fn;
      return 1;
    },
    clearInterval: () => (tickFn = null),
    isHidden: () => hidden,
    onVisibilityChange: (cb) => {
      visibilityCb = cb;
      return () => (visibilityCb = null);
    },
    requestStatus: async () => {
      requests++;
      return answers.ok;
    },
    onTimeout: (d) => timeouts.push(d),
    log: (m) => logs.push(m),
  });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return {
    watchdog,
    timeouts,
    logs,
    get requests() {
      return requests;
    },
    /** Il tempo scorre con i timer attivi: un giro del controllo ogni 5 s. */
    async run(ms: number, statusEvery: number | null = 4000) {
      let sinceStatus = 0;
      for (let t = 0; t < ms; t += WATCHDOG_INTERVAL_MS) {
        now += WATCHDOG_INTERVAL_MS;
        sinceStatus += WATCHDOG_INTERVAL_MS;
        if (statusEvery !== null && sinceStatus >= statusEvery) {
          watchdog.seen();
          sinceStatus = 0;
        }
        tickFn?.();
        await flush();
      }
    },
    /** La pagina è sospesa: il tempo passa ma i timer non girano. */
    freeze(ms: number) {
      now += ms;
    },
    async tick() {
      tickFn?.();
      await flush();
    },
    async setHidden(h: boolean, notify = true) {
      hidden = h;
      if (notify) visibilityCb?.();
      await flush();
    },
    async notifyVisibility() {
      visibilityCb?.();
      await flush();
    },
  };
}

describe('controllo della stampante che non risponde', () => {
  it('risposte regolari: nessun allarme', async () => {
    const w = setup();
    await w.run(120_000);
    expect(w.timeouts).toEqual([]);
  });

  it('nessuna risposta per 30 s con i timer attivi: allarme, come oggi', async () => {
    const w = setup();
    await w.run(40_000, null);
    expect(w.timeouts).toEqual(['Nessuno stato ricevuto da 30 secondi']);
  });

  it('timer fermi per 86 s (registro del 2026-11-06): nessun allarme, stato chiesto subito, nota nel registro', async () => {
    const w = setup();
    await w.run(20_000);
    w.freeze(86_000);
    await w.tick();
    expect(w.timeouts).toEqual([]);
    expect(w.requests).toBe(1);
    expect(w.logs).toEqual(['Pagina sospesa per 86 s: stato richiesto al ritorno']);
    // Poi tutto riprende normalmente.
    await w.run(60_000);
    expect(w.timeouts).toEqual([]);
  });

  it('dopo la pausa la stampante non risponde: allarme', async () => {
    const answers = { ok: true };
    const w = setup(answers);
    answers.ok = false;
    w.freeze(32_000);
    await w.tick();
    expect(w.timeouts).toEqual(['Nessuna risposta alla richiesta di stato fatta al ritorno nell’app']);
  });

  it('pagina nascosta per 2 minuti: nessun allarme; al ritorno, stato chiesto una volta', async () => {
    const w = setup();
    await w.setHidden(true);
    // Il telefono non sospende del tutto: il controllo gira ma senza stati.
    await w.run(120_000, null);
    expect(w.timeouts).toEqual([]);
    await w.setHidden(false);
    expect(w.requests).toBe(1);
    expect(w.logs).toEqual(['Pagina sospesa per 120 s: stato richiesto al ritorno']);
    await w.tick();
    expect(w.timeouts).toEqual([]);
  });

  it('ritorno visto sia dal controllo sia dalla visibilità: una sola richiesta e una sola nota', async () => {
    const w = setup();
    await w.setHidden(true);
    w.freeze(60_000);
    // Il controllo gira prima dell'evento di visibilità (la pagina è già visibile).
    await w.setHidden(false, false);
    const checking = w.tick();
    await w.notifyVisibility();
    await checking;
    expect(w.requests).toBe(1);
    expect(w.logs).toHaveLength(1);
  });

  it('stop: nessun controllo dopo lo scollegamento', async () => {
    const w = setup();
    w.watchdog.stop();
    await w.run(60_000, null);
    expect(w.timeouts).toEqual([]);
  });
});
