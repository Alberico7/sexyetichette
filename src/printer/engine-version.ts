/**
 * Codice prodotto nella risposta a ESC V (versione).
 *
 * La 550 lo scrive come testo esadecimale negli ultimi due byte: «28» (byte 32 38)
 * per la 550. La libreria li legge come numero binario (0x3832), quindi la
 * diagnostica segnalava una differenza con il codice USB 0x0028 che non c'è
 * (prova del 2026-11-05).
 */
export function versionProductId(raw: Uint8Array | undefined, libraryPid: number): number {
  if (!raw || raw.length < 34) return libraryPid;
  const text = String.fromCharCode(raw[32]!, raw[33]!);
  return /^[0-9A-Fa-f]{2}$/.test(text) ? parseInt(text, 16) : libraryPid;
}
