import { describe, expect, it } from 'vitest';
import {
  checkBrowser,
  reportToText,
  runDiagnostics,
  type Environment,
  type UsbLike,
} from '@/printer/usb-diagnostics';

interface FakeOptions {
  vendorId?: number;
  productId?: number;
  interfaceClass?: number;
  openError?: Error;
  claimError?: Error;
  configured?: boolean;
  noInterfaces?: boolean;
}

function domError(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

/** Dispositivo finto che registra ogni metodo chiamato. */
function fakeDevice(o: FakeOptions = {}) {
  const calls: string[] = [];
  const iface = {
    interfaceNumber: 0,
    alternate: { interfaceClass: o.interfaceClass ?? 7 },
    alternates: [{ interfaceClass: o.interfaceClass ?? 7 }],
  };
  const config = { configurationValue: 1, interfaces: o.noInterfaces ? [] : [iface] };
  const state = { opened: false, configuration: o.configured === false ? null : config };
  const device = {
    vendorId: o.vendorId ?? 0x03f0,
    productId: o.productId ?? 0x1234,
    productName: 'DeskJet 2700',
    manufacturerName: 'HP',
    serialNumber: 'CN12345678',
    usbVersionMajor: 2,
    usbVersionMinor: 0,
    configurations: [config],
    get opened() {
      return state.opened;
    },
    get configuration() {
      return state.configuration;
    },
    async open() {
      if (o.openError) throw o.openError;
      state.opened = true;
    },
    async close() {
      state.opened = false;
    },
    async selectConfiguration() {
      state.configuration = config;
    },
    async claimInterface() {
      if (o.claimError) throw o.claimError;
    },
    async releaseInterface() {},
    async forget() {},
  };
  // Registra tutte le chiamate, comprese quelle che non dovrebbero mai avvenire.
  const proxy = new Proxy(device, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          calls.push(String(prop));
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      if (typeof prop === 'string' && /transfer|reset/i.test(prop)) {
        return (..._args: unknown[]) => {
          calls.push(prop);
          return Promise.resolve();
        };
      }
      return value;
    },
  });
  return { device: proxy as unknown as USBDevice, calls };
}

function env(usb: UsbLike | null, secure = true): Environment {
  return { secureContext: secure, userAgent: 'Test/1.0', usb };
}

function usbWith(device: USBDevice | Error, authorized: USBDevice[] = []): UsbLike {
  return {
    getDevices: async () => authorized,
    requestDevice: async (opts) => {
      // Selettore senza filtri: qualsiasi dispositivo.
      expect(opts.filters).toEqual([]);
      if (device instanceof Error) throw device;
      return device;
    },
  };
}

const FORBIDDEN = ['transferOut', 'controlTransferOut', 'isochronousTransferOut', 'reset'];

describe('diagnostica USB', () => {
  it('stampante di casa: tutto riuscito, nessun dato inviato', async () => {
    const { device, calls } = fakeDevice();
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.outcome).toBe('ok');
    expect(report.summary).toMatch(/collegamento USB funziona/);
    expect(report.device?.interfaces[0]?.className).toBe('stampante');
    expect(report.device?.vendorId).toBe('0x03f0');
    expect(calls).toEqual(['open', 'claimInterface', 'releaseInterface', 'close']);
    for (const f of FORBIDDEN) expect(calls).not.toContain(f);
    expect(report.steps.map((s) => s.state)).toEqual(['ok', 'info', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });

  it('dispositivo senza configurazione attiva: la seleziona', async () => {
    const { device, calls } = fakeDevice({ configured: false });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.outcome).toBe('ok');
    expect(calls).toContain('selectConfiguration');
  });

  it('selettore chiuso: suggerimento su cavo e porta USB-C', async () => {
    const report = await runDiagnostics(env(usbWith(domError('NotFoundError', 'No device selected.'))));
    expect(report.outcome).toBe('no-device');
    expect(report.summary).toMatch(/USB-C/);
    expect(report.usbDevice).toBeUndefined();
  });

  it('apertura fallita', async () => {
    const { device, calls } = fakeDevice({ openError: domError('SecurityError', 'Access denied.') });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.outcome).toBe('open-failed');
    expect(report.steps.find((s) => s.id === 'open')?.detail).toMatch(/SecurityError/);
    expect(calls).toEqual(['open']);
  });

  it('presa di controllo fallita (interfaccia occupata): il dispositivo viene chiuso', async () => {
    const { device, calls } = fakeDevice({ claimError: domError('NetworkError', 'Unable to claim interface.') });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.outcome).toBe('claim-failed');
    expect(calls.at(-1)).toBe('close');
  });

  it('dispositivo senza interfaccia stampante: prova la prima interfaccia e lo dice', async () => {
    const { device } = fakeDevice({ interfaceClass: 0xff });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.outcome).toBe('ok');
    expect(report.steps.find((s) => s.id === 'claim')?.message).toMatch(/nessuna interfaccia stampante/);
  });

  it('dispositivo senza interfacce', async () => {
    const { device } = fakeDevice({ noInterfaces: true });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.steps.find((s) => s.id === 'claim')?.state).toBe('skip');
  });

  it.each([
    [0x0028, /LabelWriter 550 \(verificata\)/],
    [0x0029, /550 Turbo \(non verificata\)/],
    [0x0020, /modello non supportato/],
  ])('riconosce le LabelWriter (PID %s)', async (pid, expected) => {
    const { device } = fakeDevice({ vendorId: 0x0922, productId: pid });
    const report = await runDiagnostics(env(usbWith(device)));
    expect(report.device?.labelWriter).toMatch(expected);
  });

  it('browser senza WebUSB o pagina non sicura', async () => {
    expect((await runDiagnostics(env(null))).outcome).toBe('not-supported');
    const insecure = await checkBrowser(env(usbWith(fakeDevice().device), false));
    expect(insecure[0]?.state).toBe('fail');
    expect(insecure[0]?.message).toMatch(/HTTPS/);
  });

  it('testo da copiare: passaggi, dispositivo e numero di serie troncato', async () => {
    const { device } = fakeDevice();
    const text = reportToText(await runDiagnostics(env(usbWith(device))), new Date('2026-11-02T22:00:00Z'));
    expect(text).toContain('Diagnostica USB – 2026-11-02T22:00:00.000Z');
    expect(text).toContain('✓ Apertura');
    expect(text).toContain('HP – DeskJet 2700');
    expect(text).toContain('serie …5678');
    expect(text).not.toContain('CN12345678');
    expect(text).toContain('interfaccia 0: stampante');
  });
});
