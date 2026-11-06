/** Tastierino «Quante copie?». Vedi docs/2026-11-06-tastierino-copie.md. */
import { describe, expect, it } from 'vitest';
import { backspace, copiesOf, pressDigit } from '@/composables/copies-keypad';

const type = (...digits: number[]) => digits.reduce((v, d) => pressDigit(v, d), '');

describe('tastierino delle copie', () => {
  it('2 poi 4 → 24', () => {
    expect(type(2, 4)).toBe('24');
    expect(copiesOf(type(2, 4))).toBe(24);
  });
  it('al massimo 99: un terzo tasto è ignorato', () => {
    expect(type(9, 9, 5)).toBe('99');
  });
  it('zero iniziale ignorato, zero dopo una cifra accettato', () => {
    expect(type(0, 0, 7)).toBe('7');
    expect(type(1, 0)).toBe('10');
  });
  it('⌫ toglie l’ultima cifra; vuoto → nessuna stampa', () => {
    expect(backspace('24')).toBe('2');
    expect(backspace('')).toBe('');
    expect(copiesOf('')).toBeNull();
    expect(copiesOf('1')).toBe(1);
  });
});
