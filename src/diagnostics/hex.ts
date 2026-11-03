/** Byte in esadecimale («ca b6 01»), troncati oltre `max`. */
export function toHex(bytes: Uint8Array, max = Number.POSITIVE_INFINITY): string {
  const shown = bytes.length > max ? bytes.subarray(0, max) : bytes;
  const hex = Array.from(shown, (b) => b.toString(16).padStart(2, '0')).join(' ');
  return bytes.length > max ? `${hex} … (+${bytes.length - max} byte)` : hex;
}
