/**
 * Condivisione con il menu di sistema (Android: app GitHub, Telegram, posta, note…).
 */

/** Oltre questa lunghezza, se possibile, il testo viene condiviso come file .txt. */
export const SHARE_FILE_THRESHOLD = 20_000;

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export function canShare(nav: Navigator = navigator): boolean {
  return typeof nav.share === 'function';
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name: unknown }).name === 'AbortError';
}

/** Nome del file: diagnostica-AAAA-MM-GG-HHMM.txt */
export function shareFileName(when = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `diagnostica-${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}-${p(when.getHours())}${p(when.getMinutes())}.txt`;
}

/**
 * Condivide un testo. Se è molto lungo e il browser accetta i file, lo invia
 * come file .txt. Se l'utente chiude il menu restituisce `cancelled`, senza errori.
 */
export async function shareText(title: string, text: string, nav: Navigator = navigator, when = new Date()): Promise<ShareOutcome> {
  if (!canShare(nav)) return 'unsupported';
  try {
    if (text.length > SHARE_FILE_THRESHOLD && typeof File !== 'undefined' && typeof nav.canShare === 'function') {
      const file = new File([text], shareFileName(when), { type: 'text/plain' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ title, files: [file] });
        return 'shared';
      }
    }
    await nav.share({ title, text });
    return 'shared';
  } catch (err) {
    return isAbort(err) ? 'cancelled' : 'failed';
  }
}

export async function copyText(text: string, nav: Navigator = navigator): Promise<boolean> {
  try {
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
