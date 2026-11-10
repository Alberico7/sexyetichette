/**
 * Stati del pulsante microfono, con il motore simulato (src/voice/simulated.ts).
 * Vedi docs/2026-11-10-dettatura.md e docs/2026-11-10-manutenibilita.md (punto 4).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, type App } from 'vue';
import { simHooks } from '@/sim';
import { voiceEngine } from '@/voice/engine';
import { SLOW_HINT, useDictation } from '@/voice/useDictation';

let app: App | null = null;

function mount() {
  const texts: string[] = [];
  let api!: ReturnType<typeof useDictation>;
  app = createApp(
    defineComponent({
      setup() {
        api = useDictation((t) => texts.push(t));
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  return { api, texts };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 20));
  expect(check()).toBe(true);
};

beforeAll(() => {
  // Motore simulato, con il modello già «scaricato».
  history.replaceState(history.state, '', '?sim');
  simHooks().voice = { downloaded: true };
});

afterEach(() => {
  app?.unmount();
  app = null;
  vi.restoreAllMocks();
  simHooks().voice = { downloaded: true };
});

describe('pulsante microfono', () => {
  it('frase normale: testo trasformato e consegnato', async () => {
    const { api, texts } = mount();
    simHooks().voice!.phrases = ['tubo diametro venti'];
    await api.press();
    expect(api.state.value).toBe('listening');
    await api.release();
    expect(texts).toEqual(['TUBO ∅20.00']);
    expect(api.state.value).toBe('idle');
  });

  it('lasciato durante la preparazione: niente ascolto, messaggio «Pronto»', async () => {
    const { api } = mount();
    const e = await voiceEngine();
    vi.spyOn(e, 'prepare').mockImplementation(() => new Promise((r) => setTimeout(r, 100)));
    const start = vi.spyOn(e, 'start');
    const pressed = api.press();
    await until(() => api.state.value === 'preparing');
    await api.release();
    await pressed;
    expect(start).not.toHaveBeenCalled();
    expect(api.state.value).toBe('idle');
    expect(api.message.value).toBe('Pronto: tieni premuto e parla.');
  });

  it('permesso del microfono negato: messaggio chiaro', async () => {
    const { api } = mount();
    const e = await voiceEngine();
    vi.spyOn(e, 'start').mockRejectedValue(new DOMException('negato', 'NotAllowedError'));
    await api.press();
    expect(api.state.value).toBe('idle');
    expect(api.message.value).toContain('Microfono non consentito');
  });

  it('frase vuota: «Non ho sentito niente», nessun testo', async () => {
    const { api, texts } = mount();
    simHooks().voice!.phrases = [''];
    await api.press();
    await api.release();
    expect(texts).toEqual([]);
    expect(api.message.value).toContain('Non ho sentito niente');
  });

  it('modello non ancora scaricato: chiede conferma, poi scarica', async () => {
    simHooks().voice = { downloaded: false };
    const { api } = mount();
    await api.press();
    expect(api.state.value).toBe('confirm');
    await api.confirmDownload();
    expect(api.state.value).toBe('idle');
    expect(api.message.value).toBe('Pronto: tieni premuto e parla.');
  });

  it('riconoscimento lento: avviso del JIT, una volta sola', async () => {
    simHooks().voice = { downloaded: true, delayMs: 1600 };
    const { api } = mount();
    simHooks().voice!.phrases = ['scarto', 'scarto'];
    await api.press();
    await api.release();
    expect(api.message.value).toBe(SLOW_HINT);
    api.message.value = '';
    await api.press();
    await api.release();
    expect(api.message.value).toBe('');
  });
});
