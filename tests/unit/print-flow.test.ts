import { describe, expect, it } from 'vitest';
import { bitmapsEqual } from '@/printer/raster';
import { AppErrorException, unwrapError } from '@/printer/errors';
import { clampCopies, runPrint } from '@/printer/print-flow';
import { SimulatedPrinterPort, validateJob } from '@/printer/simulated';
import { addressDoc, fakePrepare } from './helpers';

async function connected(config: ConstructorParameters<typeof SimulatedPrinterPort>[0] = {}) {
  const port = new SimulatedPrinterPort({ delayMs: 1, ...config });
  await port.connect();
  return port;
}

async function printError(port: SimulatedPrinterPort, copies = 1) {
  try {
    await runPrint(port, addressDoc(), { copies, density: 'normal' }, fakePrepare);
  } catch (err) {
    return unwrapError(err);
  }
  throw new Error('la stampa doveva fallire');
}

describe('flusso di stampa con la stampante simulata', () => {
  it('stampa riuscita: un lavoro con immagine nell’orientamento della testina', async () => {
    const port = await connected();
    const doc = addressDoc();
    const job = await runPrint(port, doc, { copies: 3, density: 'high' }, fakePrepare);
    expect(port.jobs).toHaveLength(1);
    expect(job.copies).toBe(3);
    expect(job.density).toBe('high');
    // 28 mm attraverso la testina, 89 mm − 6 mm lungo il rotolo.
    expect([job.image.width, job.image.height]).toEqual([331, 980]);
    expect(job.labelLengthDots).toBe(1051);
    expect(() => validateJob(job)).not.toThrow();
  });

  it('il dithering del driver non altera l’immagine inviata', async () => {
    const port = await connected();
    const prepared = await fakePrepare(addressDoc());
    await runPrint(port, addressDoc(), { copies: 1, density: 'normal' }, async () => prepared);
    expect(bitmapsEqual(port.jobs[0]!.driverBitmap, prepared.wireBitmap)).toBe(true);
  });

  it('copie limitate tra 1 e 99', () => {
    expect(clampCopies(0)).toBe(1);
    expect(clampCopies(150)).toBe(99);
    expect(clampCopies(Number.NaN)).toBe(1);
    expect(clampCopies(2.6)).toBe(3);
  });

  it.each([
    ['no-media', 'no-media'],
    ['counterfeit', 'invalid-media'],
    ['cover-open', 'cover-open'],
    ['busy', 'busy'],
    ['timeout', 'timeout'],
  ] as const)('guasto %s → errore %s, nessun lavoro inviato', async (fault, code) => {
    const port = await connected({ fault });
    const err = await printError(port);
    expect(err.code).toBe(code);
    expect(port.jobs).toHaveLength(0);
  });

  it('lock occupato rilevato dal driver (dopo il controllo preventivo)', async () => {
    const port = await connected();
    // Il controllo di stato passa, poi il lock risulta occupato.
    port.getStatus = async () => ({ ready: true, mediaLoaded: true, problems: [], details: [] });
    port.configure({ fault: 'busy' });
    const err = await printError(port);
    expect(err.code).toBe('busy');
    expect(err.recoverable).toBe(true);
    await port.recover();
    expect(port.config.fault).toBe('none');
  });

  it('scollegamento durante la stampa', async () => {
    const port = await connected({ fault: 'disconnect-on-print' });
    port.getStatus = async () => ({ ready: true, mediaLoaded: true, problems: [], details: [] });
    let notified = false;
    port.onDisconnect(() => (notified = true));
    const err = await printError(port, 2);
    expect(err.code).toBe('disconnected');
    expect(port.connected).toBe(false);
    expect(notified).toBe(true);
  });

  it('stampa senza collegamento', async () => {
    const port = new SimulatedPrinterPort();
    const err = await printError(port);
    expect(err.code).toBe('not-connected');
  });
});

describe('collegamento simulato', () => {
  it.each([
    ['cancel', 'no-device-selected'],
    ['denied', 'access-denied'],
    ['unknown-device', 'device-unknown'],
  ] as const)('selettore %s → %s', async (picker, code) => {
    const port = new SimulatedPrinterPort({ picker, delayMs: 1 });
    await expect(port.connect()).rejects.toBeInstanceOf(AppErrorException);
    await port.connect().catch((e) => expect(unwrapError(e).code).toBe(code));
    expect(port.connected).toBe(false);
  });

  it('la 550 Turbo risulta non verificata', async () => {
    const port = new SimulatedPrinterPort({ model: 'LW_550_TURBO', delayMs: 1 });
    const info = await port.connect();
    expect(info.verified).toBe(false);
    expect(info.productId).toBe(0x0029);
  });

  it('lettura NFC: rotolo nel catalogo, oppure la causa se illeggibile', async () => {
    const port = await connected({ rollSku: '30252' });
    const ok = await port.readMedia();
    expect(ok.ok && ok.detected.media.id).toBe('address-standard');
    port.configure({ fault: 'nfc-unreadable' });
    const bad = await port.readMedia();
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.reason).toBe('bad-magic');
    expect(bad.attempts).toBe(2);
  });

  it.each([
    ['nfc-timeout', 'timeout'],
    ['nfc-short', 'short'],
  ] as const)('lettura NFC con guasto %s: causa %s', async (fault, reason) => {
    const port = await connected({ fault });
    const r = await port.readMedia();
    expect(!r.ok && r.reason).toBe(reason);
  });

  it('lettura NFC instabile: il secondo tentativo riesce', async () => {
    const port = await connected({ fault: 'nfc-flaky' });
    const r = await port.readMedia();
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });
});
