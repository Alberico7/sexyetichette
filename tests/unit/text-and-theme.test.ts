import { describe, expect, it } from 'vitest';
import {
  DIAMETER_SYMBOL,
  EMPTY_HEART,
  EMPTY_HEART_CODE,
  HEART,
  HEART_CODE,
  REJECT_WORD,
  UNREPAIRABLE_TEXT,
  insertAtSelection,
  replaceHeartCode,
  usesSymbolFont,
} from '@/model/text';
import { statusMark } from '@/components/status-logo';
import { screenShape } from '@/screen-shape';
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

describe('NON RIPARABILE', () => {
  it('su due righe, nel testo vuoto, dopo un testo e al posto di una selezione', () => {
    expect(UNREPAIRABLE_TEXT).toBe('NON\nRIPARABILE');
    expect(UNREPAIRABLE_TEXT.split('\n')).toHaveLength(2);
    expect(insertAtSelection('', UNREPAIRABLE_TEXT, null, null)).toEqual({ text: 'NON\nRIPARABILE', cursor: 14 });
    expect(insertAtSelection('Pompa\n', UNREPAIRABLE_TEXT)).toEqual({ text: 'Pompa\nNON\nRIPARABILE', cursor: 20 });
    expect(insertAtSelection('OK', UNREPAIRABLE_TEXT, 0, 2)).toEqual({ text: 'NON\nRIPARABILE', cursor: 14 });
  });
});

describe('cuore nascosto «#<3*» → ♥ (docs/2026-11-08-cuore-nascosto.md)', () => {
  it('sostituisce il codice e mette il cursore dopo il cuore', () => {
    expect(replaceHeartCode('Ti #<3*', 7)).toEqual({ text: 'Ti ♥', cursor: 4 });
    expect(replaceHeartCode('#<3* casa', 4)).toEqual({ text: '♥ casa', cursor: 1 });
  });

  it('più codici, anche incollati, con il cursore in fondo o in mezzo', () => {
    expect(replaceHeartCode('#<3* e #<3*')).toEqual({ text: '♥ e ♥', cursor: 5 });
    expect(replaceHeartCode('#<3* x #<3*', 5)).toEqual({ text: '♥ x ♥', cursor: 2 });
  });

  it('cursore in mezzo al codice: il codice diventa comunque ♥', () => {
    expect(replaceHeartCode('a#<3*b', 2)?.text).toBe('a♥b');
  });

  it('«<3», «#<3» senza asterisco e testo senza codice restano invariati', () => {
    expect(replaceHeartCode('<3 mm', 5)).toBeNull();
    expect(replaceHeartCode('#<3', 3)).toBeNull();
    expect(replaceHeartCode('#<3 mm', 6)).toBeNull();
    expect(replaceHeartCode('<3*', 3)).toBeNull();
    expect(replaceHeartCode('Tubo 20', 7)).toBeNull();
  });

  it('il cuore è il simbolo pieno, non l’emoji colorata', () => {
    expect(HEART.codePointAt(0)).toBe(0x2665);
    expect(HEART_CODE).toBe('#<3*');
  });
});

describe('cuore vuoto «#<3-» → ♡ (docs/2026-11-09-cuore-vuoto.md)', () => {
  it('sostituisce il codice e mette il cursore dopo il cuore', () => {
    expect(replaceHeartCode('Ti #<3-', 7)).toEqual({ text: 'Ti ♡', cursor: 4 });
    expect(replaceHeartCode('#<3- casa', 4)).toEqual({ text: '♡ casa', cursor: 1 });
  });

  it('tutti e due i codici nello stesso testo, anche incollati', () => {
    expect(replaceHeartCode('#<3* e #<3-')).toEqual({ text: '♥ e ♡', cursor: 5 });
    expect(replaceHeartCode('#<3- x #<3*', 5)).toEqual({ text: '♡ x ♥', cursor: 2 });
    expect(replaceHeartCode('a#<3-b', 2)?.text).toBe('a♡b');
  });

  it('«#<3» da solo e un trattino normale restano invariati', () => {
    expect(replaceHeartCode('#<3', 3)).toBeNull();
    expect(replaceHeartCode('<3-', 3)).toBeNull();
    expect(replaceHeartCode('20-30', 5)).toBeNull();
  });

  it('è il cuore bianco U+2661', () => {
    expect(EMPTY_HEART.codePointAt(0)).toBe(0x2661);
    expect(EMPTY_HEART_CODE).toBe('#<3-');
  });
});

describe('mini-font dei simboli', () => {
  it('serve per ⌀, ∅, ♥ e ♡, non per il testo normale', () => {
    expect(usesSymbolFont('Tubo ⌀20')).toBe(true);
    expect(usesSymbolFont('Ti ♥')).toBe(true);
    expect(usesSymbolFont('Tubo ∅20')).toBe(true);
    expect(usesSymbolFont('Ti ♡')).toBe(true);
    expect(usesSymbolFont('Tubo Ø20 <3')).toBe(false);
  });
});

describe('logo di stato (docs/2026-11-08-logo-stato.md)', () => {
  it('segno ✓ / ! / ✕ per pronta, avviso, errore; niente per non collegata e in corso', () => {
    expect(statusMark('ok')).toBe('✓');
    expect(statusMark('warn')).toBe('!');
    expect(statusMark('error')).toBe('✕');
    expect(statusMark('off')).toBe('');
    expect(statusMark('busy')).toBe('');
  });
});

describe('forma dello schermo (docs/2026-11-08-orizzontale-tastiera.md)', () => {
  it('segue lo schermo, non lo spazio visibile', () => {
    expect(screenShape({ width: 915, height: 412 })).toBe('landscape');
    expect(screenShape({ width: 412, height: 915 })).toBe('portrait');
    expect(screenShape({ width: 360, height: 360 })).toBe('portrait');
  });
});
