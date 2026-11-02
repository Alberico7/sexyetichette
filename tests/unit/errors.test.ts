import { describe, expect, it } from 'vitest';
import {
  DeviceIdentificationRequiredError,
} from '@thermal-label/labelwriter-web';
import {
  MediaNotSpecifiedError,
  TransportClosedError,
  TransportTimeoutError,
} from '@thermal-label/contracts';
import { AppErrorException, fromStatusError, toAppError, unwrapError } from '@/printer/errors';

const dom = (name: string, message = 'x') => new DOMException(message, name);

describe('errori del browser', () => {
  it('selettore chiuso senza scelta → suggerimento GrapheneOS', () => {
    const e = toAppError(dom('NotFoundError', 'No device selected.'));
    expect(e.code).toBe('no-device-selected');
    expect(e.hint).toMatch(/GrapheneOS/);
    expect(e.hint).toMatch(/USB-C/);
  });

  it('accesso negato / interfaccia occupata', () => {
    expect(toAppError(dom('SecurityError')).code).toBe('access-denied');
    expect(toAppError(dom('NetworkError', 'Unable to claim interface.')).code).toBe('access-denied');
  });
});

describe('errori della libreria (classi)', () => {
  it('timeout, scollegamento, formato non impostato', () => {
    expect(toAppError(new TransportTimeoutError('usb', 15000)).code).toBe('timeout');
    expect(toAppError(new TransportClosedError('usb')).code).toBe('disconnected');
    expect(toAppError(new MediaNotSpecifiedError()).code).toBe('media-not-set');
  });

  it('dispositivo non riconosciuto', () => {
    const err = new DeviceIdentificationRequiredError([], async () => ({}));
    expect(toAppError(err).code).toBe('device-unknown');
  });
});

describe('errori della libreria (riconosciuti dal testo, v0.6.4)', () => {
  it('lock occupato', () => {
    const msg =
      'Print lock on LW_550 is held by another host. Wait for the active job to finish, then retry.';
    expect(toAppError(new Error(msg)).code).toBe('busy');
  });

  it.each([
    ['Printer cover is open', 'cover_open', 'cover-open'],
    ['No label roll loaded', 'no_media', 'no-media'],
    ['Loaded label roll failed Dymo NFC authentication', 'counterfeit_media', 'invalid-media'],
    ['Label is jammed in the printer', 'paper_jam', 'paper-jam'],
    ['Print head is overheated', 'overheated', 'overheated'],
  ])('stampante con errore: %s', (message, code, expected) => {
    const e = toAppError(new Error(`Cannot print on LW_550: ${message} (${code})`));
    expect(e.code).toBe(expected);
    expect(e.detail).toContain(message);
  });

  it('dispositivo non supportato', () => {
    expect(toAppError(new Error('Unsupported USB device: VID=0x1234 PID=0x1')).code).toBe('device-unknown');
  });

  it('errore qualunque → generico, con dettagli', () => {
    const e = toAppError(new Error('boh'));
    expect(e.code).toBe('unknown');
    expect(e.detail).toContain('boh');
  });
});

describe('stato della stampante', () => {
  it('rotolo quasi finito è solo un avviso', () => {
    expect(fromStatusError({ code: 'low_media', message: 'Label roll is low' }).warning).toBe(true);
  });
  it('codice sconosciuto → errore della stampante', () => {
    expect(fromStatusError({ code: 'strano', message: '?' }).code).toBe('printer-error');
  });
  it('tutti i messaggi sono in italiano e non vuoti', () => {
    for (const code of ['no_media', 'counterfeit_media', 'cover_open', 'paper_jam', 'not_ready']) {
      const e = fromStatusError({ code, message: 'x' });
      expect(e.title.length).toBeGreaterThan(3);
      expect(e.hint.length).toBeGreaterThan(10);
    }
  });
});

describe('unwrapError', () => {
  it('estrae l’errore dell’app', () => {
    const inner = toAppError(dom('NotFoundError'));
    expect(unwrapError(new AppErrorException(inner))).toBe(inner);
  });
});
