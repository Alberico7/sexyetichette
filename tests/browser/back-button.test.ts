/**
 * Tasto indietro che chiude i pannelli, con un piccolo componente di prova.
 * La cronologia è finta: quella vera, nel browser dei test, farebbe navigare anche
 * la pagina che li controlla. Come nel browser, «indietro» arriva in ritardo.
 * Vedi docs/2026-11-10-pwa.md e docs/2026-11-10-manutenibilita.md (punto 4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type App } from 'vue';
import { useBackClosesPanel } from '@/pwa/back-button';

/** Cronologia finta: una pila di stati; `back()` toglie l'ultimo e avvisa con «popstate» al giro dopo. */
let stack: unknown[] = [];
const marked = () => !!(stack.at(-1) as Record<string, unknown> | null)?.rubeculabelPanel;
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  stack = [null];
  vi.spyOn(History.prototype, 'state', 'get').mockImplementation(() => stack.at(-1) ?? null);
  vi.spyOn(History.prototype, 'pushState').mockImplementation((s: unknown) => void stack.push(s));
  vi.spyOn(History.prototype, 'back').mockImplementation(() => {
    setTimeout(() => {
      if (stack.length > 1) stack.pop();
      window.dispatchEvent(new PopStateEvent('popstate', { state: stack.at(-1) }));
    }, 0);
  });
});

let app: App | null = null;

function mount(initiallyOpen = false) {
  const open = ref(initiallyOpen);
  const close = vi.fn(() => {
    open.value = false;
  });
  app = createApp(
    defineComponent({
      setup() {
        useBackClosesPanel(open, close);
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  return { open, close };
}

afterEach(() => {
  app?.unmount();
  app = null;
  vi.restoreAllMocks();
});

describe('tasto indietro', () => {
  it('apertura: un passo in più nella cronologia', async () => {
    const { open } = mount();
    open.value = true;
    await nextTick();
    expect(stack).toHaveLength(2);
    expect(marked()).toBe(true);
  });

  it('«indietro» chiude il pannello', async () => {
    const { open, close } = mount();
    open.value = true;
    history.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(open.value).toBe(false);
    expect(stack).toHaveLength(1);
  });

  it('chiuso dall’app (Fine, ✕): il passo si toglie e close non viene richiamata', async () => {
    const { open, close } = mount();
    open.value = true;
    open.value = false;
    await settle();
    expect(stack).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('chiuso e subito riaperto (stampa rapida → anteprima): il pannello resta aperto', async () => {
    const { open, close } = mount();
    open.value = true;
    open.value = false; // l'app chiede «indietro», che arriverà in ritardo…
    open.value = true; // …ma intanto si apre l'anteprima
    await settle();
    expect(open.value).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(marked()).toBe(true);
    // E un «indietro» vero la chiude.
    history.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(open.value).toBe(false);
  });

  it('pannello già aperto all’avvio (?diagnostica): nessun passo, chiuderlo non torna indietro', async () => {
    const back = vi.spyOn(History.prototype, 'back');
    const { open } = mount(true);
    expect(stack).toHaveLength(1);
    open.value = false;
    await settle();
    expect(back).not.toHaveBeenCalled();
  });

  it('«indietro» senza pannelli aperti: niente da chiudere', async () => {
    const { close } = mount();
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    await settle();
    expect(close).not.toHaveBeenCalled();
  });
});
