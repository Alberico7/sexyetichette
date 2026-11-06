/**
 * Logica del tastierino «Quante copie?»: al massimo 2 cifre (1–99), niente zero iniziale.
 * Vedi docs/2026-11-06-tastierino-copie.md.
 */
import { MAX_COPIES } from '@/printer/print-flow';

/** Aggiunge una cifra; ignorata se il numero supererebbe il massimo o inizierebbe con 0. */
export function pressDigit(current: string, digit: number): string {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return current;
  if (current === '' && digit === 0) return current;
  const next = `${current}${digit}`;
  return Number(next) > MAX_COPIES ? current : next;
}

export function backspace(current: string): string {
  return current.slice(0, -1);
}

/** Numero di copie composto, oppure `null` se vuoto. */
export function copiesOf(current: string): number | null {
  const n = Number(current);
  return current !== '' && n >= 1 && n <= MAX_COPIES ? n : null;
}
