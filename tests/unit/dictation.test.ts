import { describe, expect, it } from 'vitest';
import { dictationToText, insertDictation, parseItalianNumber } from '@/voice/dictation';

describe('numeri italiani in una parola (docs/2026-11-10-dettatura.md)', () => {
  it.each([
    ['zero', 0],
    ['uno', 1],
    ['nove', 9],
    ['dieci', 10],
    ['diciassette', 17],
    ['diciannove', 19],
    ['venti', 20],
    ['ventuno', 21],
    ['ventidue', 22],
    ['ventitre', 23],
    ['ventitré', 23],
    ['ventotto', 28],
    ['trentuno', 31],
    ['quarantotto', 48],
    ['cinquanta', 50],
    ['settantacinque', 75],
    ['novantanove', 99],
    ['cento', 100],
    ['centouno', 101],
    ['centotto', 108],
    ['centoventicinque', 125],
    ['duecento', 200],
    ['trecentoquarantadue', 342],
    ['novecentonovantanove', 999],
    ['mille', 1000],
    ['milleduecento', 1200],
    ['milleottocentoventuno', 1821],
    ['duemila', 2000],
    ['duemilaventi', 2020],
    ['novemilanovecentonovantanove', 9999],
  ])('%s → %i', (w, n) => {
    expect(parseItalianNumber(w)).toBe(n);
  });

  it.each([
    '',
    'un',
    'una',
    'tubo',
    'unocento',
    'centozero',
    'milazero',
    'unomila',
    'ventizero',
    'diecimila',
    'venti tre',
  ])('«%s» non è un numero', (w) => {
    expect(parseItalianNumber(w)).toBeNull();
  });

  it('ogni numero da 0 a 9999 scritto come lo scrive Vosk torna indietro', () => {
    const units = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
    const teens = [
      'dieci',
      'undici',
      'dodici',
      'tredici',
      'quattordici',
      'quindici',
      'sedici',
      'diciassette',
      'diciotto',
      'diciannove',
    ];
    const tens = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
    const say99 = (n: number): string => {
      if (n < 10) return units[n]!;
      if (n < 20) return teens[n - 10]!;
      const t = tens[Math.floor(n / 10)]!;
      const u = n % 10;
      return u === 1 || u === 8 ? t.slice(0, -1) + units[u] : t + units[u];
    };
    const say999 = (n: number): string => {
      const h = Math.floor(n / 100);
      const r = n % 100;
      const head = h === 0 ? '' : h === 1 ? 'cento' : units[h] + 'cento';
      const tail = say99(r);
      return h && tail === 'otto' ? head.slice(0, -1) + tail : head + tail;
    };
    const say = (n: number): string => {
      if (n === 0) return 'zero';
      const k = Math.floor(n / 1000);
      return (k === 0 ? '' : k === 1 ? 'mille' : units[k] + 'mila') + say999(n % 1000);
    };
    for (let n = 0; n <= 9999; n++) expect(parseItalianNumber(say(n)), say(n)).toBe(n);
  });
});

describe('dalle parole al testo dell’etichetta (docs/2026-11-10-dettatura.md)', () => {
  it.each([
    ['tubo diametro iso venti virgola cinquanta', 'TUBO ⌀20,50'],
    ['flangia diametro dodici punto settantacinque', 'FLANGIA ∅12.75'],
    ['albero diametro otto virgola zero cinque', 'ALBERO ∅8,05'],
    ['pompa non riparabile', 'POMPA NON\nRIPARABILE'],
    ['valvola tre quarti di pollice', 'VALVOLA 3 QUARTI DI POLLICE'],
    ['scarto', 'AFKEUR'],
    ['codice centoventicinque barra quattro', 'CODICE 125/4'],
    ['venti per trenta', '20×30'],
    ['tre trattino quattro', '3-4'],
    ['tubo a capo diametro venti', 'TUBO\n∅20.00'],
    ['cento venticinque', '125'],
    ['diametro mille duecento', '∅1200.00'],
    ['venti virgola zero zero', '20,00'],
    ['venti millimetri', '20 MILLIMETRI'],
  ])('«%s» → «%s»', (spoken, text) => {
    expect(dictationToText(spoken)).toBe(text);
  });

  it('dopo «diametro» il numero prende due decimali, col punto se non è detto altro', () => {
    expect(dictationToText('diametro otto')).toBe('∅8.00');
    expect(dictationToText('diametro iso venti')).toBe('⌀20.00');
    expect(dictationToText('diametro dodici punto cinque')).toBe('∅12.50');
    expect(dictationToText('diametro dodici virgola cinque')).toBe('∅12,50');
    expect(dictationToText('diametro iso venti virgola cinquanta')).toBe('⌀20,50');
    expect(dictationToText('diametro otto virgola zero cinque')).toBe('∅8,05');
    // Più di due decimali: restano come detti.
    expect(dictationToText('diametro otto punto zero zero cinque')).toBe('∅8.005');
    // «virgola» o «punto» senza numeri dopo: sceglie il separatore, decimali 00.
    expect(dictationToText('diametro venti virgola')).toBe('∅20,00');
    expect(dictationToText('diametro iso venti punto')).toBe('⌀20.00');
    expect(dictationToText('diametro venti virgola tubo')).toBe('∅20,00 TUBO');
  });

  it('senza «diametro» i numeri restano come detti', () => {
    expect(dictationToText('venti')).toBe('20');
    expect(dictationToText('dodici punto cinque')).toBe('12.5');
    expect(dictationToText('tubo venti diametro trenta')).toBe('TUBO 20 ∅30.00');
  });

  it('«diametro» senza numero dopo: il simbolo resta staccato', () => {
    expect(dictationToText('diametro tubo')).toBe('∅ TUBO');
    expect(dictationToText('diametro iso')).toBe('⌀');
  });

  it('«per» e «punto» fuori dai numeri restano parole', () => {
    expect(dictationToText('per pompa')).toBe('PER POMPA');
    expect(dictationToText('pompa per venti')).toBe('POMPA PER 20');
    expect(dictationToText('punto di prelievo')).toBe('PUNTO DI PRELIEVO');
    // «virgola» dopo un numero, senza decimali: la virgola, attaccata al numero.
    expect(dictationToText('venti virgola')).toBe('20,');
    expect(dictationToText('venti virgola tubo')).toBe('20, TUBO');
    // Anche «punto»: il punto, attaccato al numero.
    expect(dictationToText('venti punto')).toBe('20.');
    expect(dictationToText('venti punto tubo')).toBe('20. TUBO');
  });

  it('«un» e «una» restano articoli; spazi in più e testo vuoto', () => {
    expect(dictationToText('un tubo e una valvola')).toBe('UN TUBO E UNA VALVOLA');
    expect(dictationToText('  tubo   venti  ')).toBe('TUBO 20');
    expect(dictationToText('')).toBe('');
  });
});

describe('inserimento del testo dettato', () => {
  it('nella casella vuota, senza spazio', () => {
    expect(insertDictation('', 'TUBO ∅20', null, null)).toEqual({ text: 'TUBO ∅20', cursor: 8 });
  });

  it('dopo una parola aggiunge uno spazio; dopo uno spazio o un a capo no', () => {
    expect(insertDictation('POMPA', '∅20', 5, 5)).toEqual({ text: 'POMPA ∅20', cursor: 9 });
    expect(insertDictation('POMPA ', '∅20', 6, 6)).toEqual({ text: 'POMPA ∅20', cursor: 9 });
    expect(insertDictation('POMPA\n', '∅20', 6, 6)).toEqual({ text: 'POMPA\n∅20', cursor: 9 });
  });

  it('al posto della selezione e a metà testo', () => {
    expect(insertDictation('TUBO XX FINE', '∅20', 5, 7)).toEqual({ text: 'TUBO ∅20 FINE', cursor: 8 });
  });

  it('un a capo dettato non si fa precedere da uno spazio', () => {
    expect(insertDictation('TUBO', '\nPOMPA', 4, 4)).toEqual({ text: 'TUBO\nPOMPA', cursor: 10 });
  });
});
