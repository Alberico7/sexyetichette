/**
 * Traduzione in italiano degli errori del browser, della libreria e della stampante.
 *
 * Alcuni errori della libreria arrivano come `Error` generici: li riconosco dal
 * testo del messaggio. Le espressioni regolari sono verificate dai test contro
 * la versione 0.6.4 di `@thermal-label/labelwriter-web`.
 */

export type ErrorCode =
  | 'webusb-unsupported'
  | 'insecure-context'
  | 'no-device-selected'
  | 'access-denied'
  | 'device-unknown'
  | 'not-connected'
  | 'no-media'
  | 'invalid-media'
  | 'low-media'
  | 'media-not-set'
  | 'cover-open'
  | 'paper-jam'
  | 'busy'
  | 'timeout'
  | 'disconnected'
  | 'overheated'
  | 'low-voltage'
  | 'not-ready'
  | 'printer-error'
  | 'unknown';

export interface AppError {
  code: ErrorCode;
  /** Titolo breve in italiano. */
  title: string;
  /** Spiegazione e cosa fare. */
  hint: string;
  /** Messaggio tecnico originale, per la sezione dettagli. */
  detail?: string;
  /** `true` se ha senso proporre "Ripristina stampante". */
  recoverable?: boolean;
  /** `true` per avvisi che non impediscono la stampa. */
  warning?: boolean;
}

const GRAPHENE_HINT =
  'Collega la stampante con il telefono sbloccato. Su GrapheneOS controlla anche ' +
  "l'impostazione della porta USB-C nelle impostazioni di sicurezza: se è limitata " +
  'alla sola ricarica, la stampante non viene vista.';

const MESSAGES: Record<ErrorCode, { title: string; hint: string; recoverable?: boolean; warning?: boolean }> = {
  'webusb-unsupported': {
    title: 'Questo browser non supporta WebUSB',
    hint: 'Usa un browser basato su Chromium (Vanadium, Chrome, Edge). Firefox e Safari non possono comunicare con la stampante.',
  },
  'insecure-context': {
    title: 'Pagina non sicura',
    hint: "WebUSB funziona solo su HTTPS o su localhost. Apri l'app dall'indirizzo https.",
  },
  'no-device-selected': {
    title: 'Nessuna stampante selezionata',
    hint: `Se la stampante non compariva nell'elenco: ${GRAPHENE_HINT}`,
  },
  'access-denied': {
    title: 'Accesso USB negato',
    hint:
      'Il browser non ha potuto aprire la stampante. Chiudi altre app o schede che la usano, ' +
      `scollega e ricollega il cavo e riprova. ${GRAPHENE_HINT}`,
  },
  'device-unknown': {
    title: 'Dispositivo non riconosciuto',
    hint: 'Il dispositivo scelto non è una LabelWriter supportata. Questa app è pensata per la LabelWriter 550.',
  },
  'not-connected': {
    title: 'Stampante non collegata',
    hint: 'Tocca «Collega» e scegli la stampante.',
  },
  'no-media': {
    title: 'Rotolo assente',
    hint: 'Inserisci un rotolo di etichette e chiudi il coperchio. Se il rotolo è inserito, controlla che sia posizionato bene.',
  },
  'invalid-media': {
    title: 'Rotolo non valido',
    hint: 'La stampante ha rifiutato il rotolo: questo modello stampa solo con etichette originali dotate di chip NFC.',
  },
  'low-media': {
    title: 'Rotolo quasi finito',
    hint: 'Restano poche etichette.',
    warning: true,
  },
  'media-not-set': {
    title: 'Formato etichetta non impostato',
    hint: 'Scegli il formato del rotolo prima di stampare.',
  },
  'cover-open': {
    title: 'Coperchio aperto',
    hint: 'Chiudi il coperchio della stampante.',
  },
  'paper-jam': {
    title: 'Etichetta inceppata',
    hint: 'Apri il coperchio, rimuovi l’etichetta inceppata e richiudi.',
    recoverable: true,
  },
  busy: {
    title: 'Stampante occupata',
    hint: 'Un altro computer o programma sta usando la stampante. Attendi la fine del lavoro, oppure usa «Ripristina stampante».',
    recoverable: true,
  },
  timeout: {
    title: 'La stampante non risponde',
    hint: 'Tempo scaduto. Controlla il cavo e lo stato della stampante, poi usa «Ripristina stampante» o scollega e ricollega.',
    recoverable: true,
  },
  disconnected: {
    title: 'Stampante scollegata',
    hint: 'La connessione USB si è interrotta. Ricollega la stampante e tocca «Collega».',
  },
  overheated: {
    title: 'Testina surriscaldata',
    hint: 'Attendi qualche minuto che la testina si raffreddi.',
  },
  'low-voltage': {
    title: 'Alimentazione insufficiente',
    hint: 'La tensione della testina è troppo bassa. Controlla l’alimentatore della stampante.',
  },
  'not-ready': {
    title: 'Stampante non pronta',
    hint: 'La stampante è impegnata o non pronta. Attendi qualche secondo e riprova.',
    recoverable: true,
  },
  'printer-error': {
    title: 'Errore della stampante',
    hint: 'La stampante ha segnalato un errore. Prova «Ripristina stampante»; se non basta, spegnila e riaccendila.',
    recoverable: true,
  },
  unknown: {
    title: 'Errore imprevisto',
    hint: 'Riprova. Se il problema continua, scollega e ricollega la stampante.',
  },
};

export function appError(code: ErrorCode, detail?: string): AppError {
  const m = MESSAGES[code];
  const err: AppError = { code, title: m.title, hint: m.hint };
  if (detail) err.detail = detail;
  if (m.recoverable) err.recoverable = true;
  if (m.warning) err.warning = true;
  return err;
}

/** Codici di stato della libreria (`PrinterError.code`) → codici dell'app. */
const STATUS_CODES: Record<string, ErrorCode> = {
  no_media: 'no-media',
  counterfeit_media: 'invalid-media',
  low_media: 'low-media',
  cover_open: 'cover-open',
  paper_jam: 'paper-jam',
  overheated: 'overheated',
  low_voltage: 'low-voltage',
  not_ready: 'not-ready',
  printer_error: 'printer-error',
};

export function fromStatusError(e: { code: string; message: string }): AppError {
  return appError(STATUS_CODES[e.code] ?? 'printer-error', `${e.message} (${e.code})`);
}

/** Messaggi della libreria riconosciuti dal testo (v0.6.4). */
const LOCK_HELD = /Print lock on \S+ is held by another host/i;
const CANNOT_PRINT = /^Cannot print on \S+: .* \((\w+)\)$/;
const UNSUPPORTED_DEVICE = /Unsupported USB device|not in the LabelWriter registry/i;
const CLAIM_FAILED = /could not open any USB interfaces|Unable to claim interface|claimInterface/i;

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** Converte qualunque eccezione in un errore dell'app. */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  const detail = describe(err);
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  const message = err instanceof Error || err instanceof DOMException ? err.message : String(err);

  switch (name) {
    case 'NotFoundError':
      // Selettore chiuso senza scelta, oppure nessun dispositivo compatibile.
      return appError('no-device-selected', detail);
    case 'SecurityError':
      return appError(
        typeof window !== 'undefined' && !window.isSecureContext ? 'insecure-context' : 'access-denied',
        detail,
      );
    case 'TransportTimeoutError':
      return appError('timeout', detail);
    case 'TransportClosedError':
      return appError('disconnected', detail);
    case 'DeviceIdentificationRequiredError':
    case 'DeviceNotFoundError':
      return appError('device-unknown', detail);
    case 'MediaNotSpecifiedError':
      return appError('media-not-set', detail);
    case 'NetworkError':
      // claimInterface/open falliti: tipicamente interfaccia già in uso.
      return appError('access-denied', detail);
    case 'AbortError':
      return appError('disconnected', detail);
    case 'InvalidStateError':
      return appError('disconnected', detail);
  }

  if (LOCK_HELD.test(message)) return appError('busy', detail);
  const cannot = CANNOT_PRINT.exec(message);
  if (cannot?.[1]) return { ...fromStatusError({ code: cannot[1], message }), detail };
  if (UNSUPPORTED_DEVICE.test(message)) return appError('device-unknown', detail);
  if (CLAIM_FAILED.test(message)) return appError('access-denied', detail);
  if (/disconnected|device unavailable|No device selected/i.test(message)) {
    return appError(/No device selected/i.test(message) ? 'no-device-selected' : 'disconnected', detail);
  }
  return appError('unknown', detail);
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'title' in value &&
    'hint' in value &&
    typeof (value as AppError).title === 'string'
  );
}

/** Errore lanciabile che trasporta un `AppError`. */
export class AppErrorException extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.title);
    this.name = 'AppErrorException';
  }
}

export function unwrapError(err: unknown): AppError {
  if (err instanceof AppErrorException) return err.appError;
  return toAppError(err);
}

/** Controlla il supporto del browser prima di aprire il selettore. */
export function checkEnvironment(): AppError | null {
  if (typeof window === 'undefined') return appError('webusb-unsupported');
  if (!window.isSecureContext) return appError('insecure-context');
  if (!('usb' in navigator) || !navigator.usb) return appError('webusb-unsupported');
  return null;
}
