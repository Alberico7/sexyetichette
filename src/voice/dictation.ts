/**
 * Dalle parole dette (come le scrive Vosk: minuscole, numeri in lettere) al testo
 * dell'etichetta: numeri in cifre, decimali con il separatore detto, simboli del
 * diametro, parole speciali, tutto in maiuscolo. Regole fisse, senza audio.
 * Vedi docs/2026-11-10-dettatura.md.
 */
import {
  DIAMETER_45_SIGN,
  DIAMETER_SIGN,
  REJECT_WORD,
  UNREPAIRABLE_TEXT,
  insertAtSelection,
  type TextEdit,
} from '@/model/text';

const UNITS: Record<string, number> = {
  zero: 0,
  uno: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  tredici: 13,
  quattordici: 14,
  quindici: 15,
  sedici: 16,
  diciassette: 17,
  diciotto: 18,
  diciannove: 19,
};

const DIGIT_NAMES = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];

const TENS: [string, number][] = [
  ['venti', 20],
  ['trenta', 30],
  ['quaranta', 40],
  ['cinquanta', 50],
  ['sessanta', 60],
  ['settanta', 70],
  ['ottanta', 80],
  ['novanta', 90],
];

/** Da 0 a 99, una parola sola («ventotto», «quarantatré»). */
function upTo99(w: string): number | null {
  if (w in UNITS) return UNITS[w]!;
  for (const [name, value] of TENS) {
    if (w === name) return value;
    if (w.startsWith(name)) {
      const unit = DIGIT_NAMES.indexOf(w.slice(name.length));
      if (unit > 0) return value + unit;
    }
    // Elisione davanti a «uno» e «otto»: ventuno, trentotto.
    const stem = name.slice(0, -1);
    if (w === stem + 'uno') return value + 1;
    if (w === stem + 'otto') return value + 8;
  }
  return null;
}

/** Da 0 a 999, una parola sola («centoventicinque», «duecento», «centotto»). */
function upTo999(w: string): number | null {
  const small = upTo99(w);
  if (small !== null) return small;
  const at = w.indexOf('cent');
  if (at < 0) return null;
  const head = w.slice(0, at);
  const hundreds = head === '' ? 1 : DIGIT_NAMES.indexOf(head);
  if (hundreds < 1 || (head !== '' && hundreds === 1)) return null;
  let rest = w.slice(at + 4);
  if (rest === 'otto') return hundreds * 100 + 8; // centotto
  if (!rest.startsWith('o')) return null;
  rest = rest.slice(1);
  if (rest === '') return hundreds * 100;
  const tail = upTo99(rest);
  return tail === null || tail === 0 ? null : hundreds * 100 + tail;
}

/**
 * Un numero intero da 0 a 9999 scritto in una sola parola italiana, o `null`.
 * «uno» sì, «un» e «una» no: sono quasi sempre articoli.
 */
export function parseItalianNumber(word: string): number | null {
  const w = word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (w === '') return null;
  let thousands = 0;
  let rest = w;
  if (w.startsWith('mille')) {
    thousands = 1;
    rest = w.slice(5);
  } else {
    const at = w.indexOf('mila');
    if (at > 0) {
      thousands = DIGIT_NAMES.indexOf(w.slice(0, at));
      if (thousands < 2) return null;
      rest = w.slice(at + 4);
    }
  }
  if (rest === '') return thousands ? thousands * 1000 : null;
  const low = upTo999(rest);
  if (low === null || (thousands && low === 0)) return null;
  return thousands * 1000 + low;
}

/** Pezzo del testo finale; `glue` = attaccato al pezzo precedente, senza spazio. */
interface Piece {
  text: string;
  glue?: boolean;
  /** Il pezzo seguente si attacca a questo (∅, /, -). */
  glueNext?: boolean;
  number?: boolean;
  /** Simbolo del diametro: il numero che segue prende due decimali. */
  diameter?: boolean;
  newline?: boolean;
}

/**
 * Il numero più lungo che parte da `i`: anche su più parole («cento venticinque»),
 * fino a quattro. Restituisce il valore e l'indice dopo il numero.
 */
function numberAt(tokens: readonly string[], i: number): { value: number; next: number } | null {
  for (let k = Math.min(tokens.length, i + 4); k > i; k--) {
    const value = parseItalianNumber(tokens.slice(i, k).join(''));
    if (value !== null) return { value, next: k };
  }
  return null;
}

/** Trasforma la frase riconosciuta nel testo da inserire nell'etichetta. */
export function dictationToText(spoken: string): string {
  const tokens = spoken.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const pieces: Piece[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    const next = tokens[i + 1];
    const prev = pieces.at(-1);
    if (t === 'a' && next === 'capo') {
      pieces.push({ text: '\n', newline: true });
      i += 2;
    } else if (t === 'non' && next === 'riparabile') {
      pieces.push({ text: UNREPAIRABLE_TEXT });
      i += 2;
    } else if (t === 'scarto') {
      pieces.push({ text: REJECT_WORD });
      i += 1;
    } else if (t === 'diametro') {
      const iso = next === 'iso';
      const after = i + (iso ? 2 : 1);
      pieces.push({
        text: iso ? DIAMETER_SIGN : DIAMETER_45_SIGN,
        glueNext: numberAt(tokens, after) !== null,
        diameter: true,
      });
      i = after;
    } else if (t === 'barra' || t === 'trattino') {
      pieces.push({ text: t === 'barra' ? '/' : '-', glue: true, glueNext: true });
      i += 1;
    } else if (t === 'per' && prev?.number && numberAt(tokens, i + 1)) {
      pieces.push({ text: '×', glue: true, glueNext: true });
      i += 1;
    } else {
      const num = numberAt(tokens, i);
      if (!num) {
        pieces.push({ text: t });
        i += 1;
        continue;
      }
      i = num.next;
      // Decimali: dopo «virgola» o «punto» ogni numero detto si scrive così com'è.
      let sep = tokens[i] === 'virgola' ? ',' : tokens[i] === 'punto' ? '.' : null;
      let decimals = '';
      if (sep) {
        let j = i + 1;
        for (; j < tokens.length; j++) {
          const d = parseItalianNumber(tokens[j]!);
          if (d === null) break;
          decimals += String(d);
        }
        // Dopo un diametro «virgola» o «punto» sceglie il separatore anche senza decimali (∅20,00).
        // Anche senza decimali dopo, «virgola» e «punto» restano il loro segno, attaccato
        // al numero (20, e 20.); dopo un diametro i decimali diventano 00 (∅20,00).
        i = j;
      }
      // Dopo «diametro» sempre almeno due decimali, col punto se non è detto altro: ∅8.00, ∅12.50.
      if (prev?.diameter) {
        sep ??= '.';
        decimals = decimals.padEnd(2, '0');
      }
      pieces.push({ text: String(num.value) + (sep ? sep + decimals : ''), number: true });
    }
  }

  let out = '';
  pieces.forEach((p, k) => {
    const before = pieces[k - 1];
    const glued = k === 0 || p.newline || before?.newline || p.glue || before?.glueNext;
    out += (glued ? '' : ' ') + p.text;
  });
  return out.toUpperCase();
}

/**
 * Inserisce il testo dettato al posto della selezione. Aggiunge uno spazio prima
 * se il testo precedente non finisce con uno spazio o un a capo.
 */
export function insertDictation(text: string, dictated: string, start: number | null, end: number | null): TextEdit {
  const s = Math.min(text.length, Math.max(0, start ?? text.length));
  const before = text.slice(0, s);
  const needsSpace = before !== '' && !/\s$/.test(before) && !dictated.startsWith('\n');
  return insertAtSelection(text, (needsSpace ? ' ' : '') + dictated, s, end ?? s);
}
