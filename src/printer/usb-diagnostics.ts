/**
 * Diagnostica USB: verifica con qualsiasi dispositivo (es. una stampante di casa)
 * che telefono, cavo, impostazioni e browser permettano di aprire un dispositivo
 * USB e di prenderne il controllo.
 *
 * NON invia dati: usa solo open, selectConfiguration (se serve), claimInterface,
 * releaseInterface, close e forget. Mai transferOut, controlTransferOut,
 * isochronousTransferOut o reset (verificato dai test).
 */
import { LW550_PRODUCT_ID, LW550_TURBO_PRODUCT_ID, LW550_VENDOR_ID } from './media';

export type StepState = 'ok' | 'fail' | 'skip' | 'info';

export interface DiagnosticStep {
  id: 'browser' | 'authorized' | 'picker' | 'open' | 'configuration' | 'claim' | 'close';
  title: string;
  state: StepState;
  message: string;
  detail?: string;
}

export interface InterfaceInfo {
  number: number;
  classCode: number;
  className: string;
}

export interface DeviceInfo {
  productName: string;
  manufacturerName: string;
  vendorId: string;
  productId: string;
  usbVersion: string;
  serialTail?: string;
  interfaces: InterfaceInfo[];
  /** Descrizione se è una LabelWriter. */
  labelWriter?: string;
}

export type Outcome = 'ok' | 'not-supported' | 'no-device' | 'open-failed' | 'claim-failed' | 'error';

export interface DiagnosticReport {
  steps: DiagnosticStep[];
  device?: DeviceInfo;
  outcome: Outcome;
  summary: string;
  /** Il dispositivo scelto, per «Dimentica questo dispositivo». */
  usbDevice?: USBDevice;
}

/** Parte di `navigator.usb` usata dalla diagnostica (sostituibile nei test). */
export interface UsbLike {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

export interface Environment {
  secureContext: boolean;
  userAgent: string;
  usb: UsbLike | null;
}

const CLASS_NAMES: Record<number, string> = {
  0x01: 'audio',
  0x02: 'comunicazione',
  0x03: 'HID (tastiera, mouse…)',
  0x05: 'fisica',
  0x06: 'immagini (fotocamera, scanner)',
  0x07: 'stampante',
  0x08: 'memoria di massa',
  0x09: 'hub',
  0x0a: 'dati',
  0x0b: 'smart card',
  0x0e: 'video',
  0x10: 'audio/video',
  0xdc: 'diagnostica',
  0xe0: 'wireless',
  0xef: 'varie',
  0xfe: 'specifica dell’applicazione',
  0xff: 'specifica del produttore',
};

export const PRINTER_CLASS = 0x07;

const hex4 = (n: number) => `0x${n.toString(16).padStart(4, '0')}`;

export function className(code: number): string {
  return CLASS_NAMES[code] ?? `classe 0x${code.toString(16).padStart(2, '0')}`;
}

function describeError(err: unknown): string {
  if (err instanceof Error || (typeof DOMException !== 'undefined' && err instanceof DOMException)) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

function errorName(err: unknown): string {
  return typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
}

export function labelWriterName(vendorId: number, productId: number): string | undefined {
  if (vendorId !== LW550_VENDOR_ID) return undefined;
  if (productId === LW550_PRODUCT_ID) return 'LabelWriter 550 (verificata)';
  if (productId === LW550_TURBO_PRODUCT_ID) return 'LabelWriter 550 Turbo (non verificata)';
  return 'Dispositivo del produttore delle LabelWriter (modello non supportato da questa app)';
}

/** Interfacce della configurazione attiva (o della prima, se nessuna è attiva). */
function interfacesOf(device: USBDevice): InterfaceInfo[] {
  const config = device.configuration ?? device.configurations[0];
  if (!config) return [];
  return config.interfaces.map((itf) => {
    const alt = itf.alternate ?? itf.alternates[0];
    const code = alt?.interfaceClass ?? 0;
    return { number: itf.interfaceNumber, classCode: code, className: className(code) };
  });
}

export function describeDevice(device: USBDevice): DeviceInfo {
  const info: DeviceInfo = {
    productName: device.productName || '(nome non disponibile)',
    manufacturerName: device.manufacturerName || '(produttore non disponibile)',
    vendorId: hex4(device.vendorId),
    productId: hex4(device.productId),
    usbVersion: `${device.usbVersionMajor}.${device.usbVersionMinor}`,
    interfaces: interfacesOf(device),
  };
  if (device.serialNumber) info.serialTail = `…${device.serialNumber.slice(-4)}`;
  const lw = labelWriterName(device.vendorId, device.productId);
  if (lw) info.labelWriter = lw;
  return info;
}

/** Controlli che non richiedono un tocco: browser e dispositivi già autorizzati. */
export async function checkBrowser(env: Environment): Promise<DiagnosticStep[]> {
  const steps: DiagnosticStep[] = [];
  if (!env.secureContext) {
    steps.push({
      id: 'browser',
      title: 'Browser',
      state: 'fail',
      message: 'La pagina non è sicura: WebUSB funziona solo su HTTPS o su localhost.',
      detail: env.userAgent,
    });
    return steps;
  }
  if (!env.usb) {
    steps.push({
      id: 'browser',
      title: 'Browser',
      state: 'fail',
      message: 'Questo browser non supporta WebUSB. Usa Vanadium, Chrome o Edge.',
      detail: env.userAgent,
    });
    return steps;
  }
  steps.push({ id: 'browser', title: 'Browser', state: 'ok', message: 'WebUSB disponibile.', detail: env.userAgent });
  try {
    const devices = await env.usb.getDevices();
    steps.push({
      id: 'authorized',
      title: 'Dispositivi già autorizzati',
      state: 'info',
      message:
        devices.length === 0
          ? 'Nessun dispositivo autorizzato finora per questo sito.'
          : `${devices.length} dispositivo/i già autorizzato/i: ${devices.map((d) => d.productName || hex4(d.productId)).join(', ')}.`,
    });
  } catch (err) {
    steps.push({ id: 'authorized', title: 'Dispositivi già autorizzati', state: 'fail', message: 'Impossibile leggere l’elenco.', detail: describeError(err) });
  }
  return steps;
}

const SUMMARIES: Record<Outcome, string> = {
  ok: 'Il telefono vede il dispositivo e il browser può comunicarci: il collegamento USB funziona.',
  'not-supported': 'Il browser o la pagina non permettono di usare WebUSB.',
  'no-device':
    'Nessun dispositivo scelto. Se il selettore era vuoto: controlla cavo o adattatore, collega con il telefono sbloccato e verifica in GrapheneOS l’impostazione della porta USB-C.',
  'open-failed':
    'Il browser vede il dispositivo ma non riesce ad aprirlo: Android potrebbe aver negato il permesso, oppure un’altra app lo sta usando.',
  'claim-failed':
    'Il browser apre il dispositivo ma non riesce a prenderne il controllo: probabilmente il sistema o un’altra app lo sta usando (su Windows succede spesso con le stampanti).',
  error: 'La prova si è interrotta per un errore imprevisto: vedi i dettagli.',
};

/**
 * Prova completa. Da chiamare dentro il gestore di un tocco (apre il selettore).
 * `pre` sono i passaggi già calcolati da `checkBrowser`.
 */
export async function runDiagnostics(env: Environment, pre?: DiagnosticStep[]): Promise<DiagnosticReport> {
  const steps = pre ?? (await checkBrowser(env));
  let chosen: USBDevice | undefined;
  const finish = (outcome: Outcome, device?: DeviceInfo): DiagnosticReport => {
    const report: DiagnosticReport = { steps, outcome, summary: SUMMARIES[outcome] };
    if (device) report.device = device;
    if (chosen) report.usbDevice = chosen;
    return report;
  };
  if (!env.usb || steps.some((s) => s.id === 'browser' && s.state === 'fail')) return finish('not-supported');

  let device: USBDevice;
  try {
    device = await env.usb.requestDevice({ filters: [] });
  } catch (err) {
    const cancelled = errorName(err) === 'NotFoundError';
    steps.push({
      id: 'picker',
      title: 'Selettore',
      state: 'fail',
      message: cancelled ? 'Selettore chiuso senza scegliere un dispositivo.' : 'Il selettore non si è aperto.',
      detail: describeError(err),
    });
    return finish(cancelled ? 'no-device' : 'error');
  }

  chosen = device;
  const info = describeDevice(device);
  steps.push({
    id: 'picker',
    title: 'Selettore',
    state: 'ok',
    message: `Scelto: ${info.manufacturerName} ${info.productName} (${info.vendorId}:${info.productId}).`,
  });

  const wasOpen = device.opened;
  try {
    if (!wasOpen) await device.open();
    steps.push({ id: 'open', title: 'Apertura', state: 'ok', message: 'Dispositivo aperto.' });
  } catch (err) {
    steps.push({ id: 'open', title: 'Apertura', state: 'fail', message: 'Impossibile aprire il dispositivo.', detail: describeError(err) });
    return finish('open-failed', info);
  }

  try {
    if (device.configuration === null) {
      const first = device.configurations[0];
      if (first) await device.selectConfiguration(first.configurationValue);
      steps.push({ id: 'configuration', title: 'Configurazione', state: 'ok', message: 'Configurazione selezionata.' });
    } else {
      steps.push({ id: 'configuration', title: 'Configurazione', state: 'ok', message: 'Configurazione già attiva.' });
    }
  } catch (err) {
    steps.push({ id: 'configuration', title: 'Configurazione', state: 'fail', message: 'Impossibile selezionare la configurazione.', detail: describeError(err) });
    await closeQuietly(device, wasOpen, steps);
    return finish('open-failed', info);
  }
  info.interfaces = interfacesOf(device);

  const target = info.interfaces.find((i) => i.classCode === PRINTER_CLASS) ?? info.interfaces[0];
  let outcome: Outcome = 'ok';
  if (!target) {
    steps.push({ id: 'claim', title: 'Presa di controllo', state: 'skip', message: 'Il dispositivo non espone interfacce.' });
  } else {
    const which = target.classCode === PRINTER_CLASS ? 'stampante' : `${target.className} (nessuna interfaccia stampante)`;
    try {
      await device.claimInterface(target.number);
      await device.releaseInterface(target.number);
      steps.push({
        id: 'claim',
        title: 'Presa di controllo',
        state: 'ok',
        message: `Interfaccia ${target.number} (${which}) presa e subito rilasciata.`,
      });
    } catch (err) {
      steps.push({
        id: 'claim',
        title: 'Presa di controllo',
        state: 'fail',
        message: `Impossibile prendere il controllo dell’interfaccia ${target.number} (${which}).`,
        detail: describeError(err),
      });
      outcome = 'claim-failed';
    }
  }

  await closeQuietly(device, wasOpen, steps);
  return finish(outcome, info);
}

async function closeQuietly(device: USBDevice, wasOpen: boolean, steps: DiagnosticStep[]): Promise<void> {
  if (wasOpen) {
    steps.push({ id: 'close', title: 'Chiusura', state: 'skip', message: 'Il dispositivo era già aperto da questa pagina: lasciato aperto.' });
    return;
  }
  try {
    await device.close();
    steps.push({ id: 'close', title: 'Chiusura', state: 'ok', message: 'Dispositivo chiuso.' });
  } catch (err) {
    steps.push({ id: 'close', title: 'Chiusura', state: 'fail', message: 'Errore alla chiusura.', detail: describeError(err) });
  }
}

const ICONS: Record<StepState, string> = { ok: '✓', fail: '✗', skip: '–', info: 'i' };

/** Testo da copiare e incollare (numero di serie troncato). */
export function reportToText(report: DiagnosticReport, when = new Date()): string {
  const lines = [`Diagnostica USB – ${when.toISOString()}`, `Esito: ${report.summary}`, ''];
  for (const s of report.steps) {
    lines.push(`${ICONS[s.state]} ${s.title}: ${s.message}`);
    if (s.detail) lines.push(`    ${s.detail}`);
  }
  if (report.device) {
    const d = report.device;
    lines.push('', 'Dispositivo:');
    lines.push(`  ${d.manufacturerName} – ${d.productName}`);
    lines.push(`  ID ${d.vendorId}:${d.productId}, USB ${d.usbVersion}${d.serialTail ? `, serie ${d.serialTail}` : ''}`);
    if (d.labelWriter) lines.push(`  ${d.labelWriter}`);
    for (const i of d.interfaces) lines.push(`  interfaccia ${i.number}: ${i.className}`);
  }
  return lines.join('\n');
}
