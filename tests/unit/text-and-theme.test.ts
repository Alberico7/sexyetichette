import { describe, expect, it } from 'vitest';
import { DIAMETER_SYMBOL, REJECT_WORD, insertAtSelection } from '@/model/text';
import { isThemePreference, nextPreference, resolveTheme } from '@/theme';

describe('simbolo del diametro', () => {
  it('è la O barrata (U+00D8)', () => {
    expect(DIAMETER_SYMBOL).toBe('Ø');
    expect(DIAMETER_SYMBOL.codePointAt(0)).toBe(0xd8);
  });

  it('inserisce nella posizione del cursore', () => {
    expect(insertAtSelection('8 mm', 'Ø', 0)).toEqual({ text: 'Ø8 mm', cursor: 1 });
    expect(insertAtSelection('Tubo 20', 'Ø', 5)).toEqual({ text: 'Tubo Ø20', cursor: 6 });
    expect(insertAtSelection('Tubo', 'Ø')).toEqual({ text: 'TuboØ', cursor: 5 });
  });

  it('sostituisce il testo selezionato', () => {
    expect(insertAtSelection('Tubo D20', 'Ø', 5, 6)).toEqual({ text: 'Tubo Ø20', cursor: 6 });
  });

  it('limita posizioni fuori intervallo e gestisce il testo vuoto', () => {
    expect(insertAtSelection('ab', 'Ø', 10)).toEqual({ text: 'abØ', cursor: 3 });
    expect(insertAtSelection('ab', 'Ø', -3)).toEqual({ text: 'Øab', cursor: 1 });
    expect(insertAtSelection('ab', 'Ø', 2, 1)).toEqual({ text: 'abØ', cursor: 3 });
    expect(insertAtSelection('', 'Ø', null, null)).toEqual({ text: 'Ø', cursor: 1 });
  });
});

describe('parola AFKEUR', () => {
  it('inserita così com’è nel testo vuoto, a metà testo e al posto di una selezione', () => {
    expect(REJECT_WORD).toBe('AFKEUR');
    expect(insertAtSelection('', REJECT_WORD, null, null)).toEqual({ text: 'AFKEUR', cursor: 6 });
    expect(insertAtSelection('Tubo 20 mm', REJECT_WORD, 8)).toEqual({ text: 'Tubo 20 AFKEURmm', cursor: 14 });
    expect(insertAtSelection('Tubo 20 OK', REJECT_WORD, 8, 10)).toEqual({ text: 'Tubo 20 AFKEUR', cursor: 14 });
  });
});

describe('tema', () => {
  it('cicla automatico → chiaro → scuro → automatico', () => {
    expect(nextPreference('auto')).toBe('light');
    expect(nextPreference('light')).toBe('dark');
    expect(nextPreference('dark')).toBe('auto');
  });

  it('automatico segue il sistema, le scelte esplicite no', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('valida i valori salvati', () => {
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('blu')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
