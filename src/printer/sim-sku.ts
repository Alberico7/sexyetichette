/**
 * Costruzione dei 63 byte di risposta a `ESC U` (dati del rotolo), nel formato
 * letto da `parseSkuInfo` della libreria. Usata solo dalla stampante simulata
 * e dai test.
 */
export interface SkuBytesOptions {
  sku: string;
  widthMm: number;
  /** 0 = continuo. */
  lengthMm: number;
  totalLabels?: number;
  magic?: number;
  /** 0 carta, 1 trasparente… (indice della tabella della libreria). */
  material?: number;
  /** 0 continuo, 1 fustellata. */
  labelType?: number;
  productionDate?: string;
}

export function buildSkuBytes(o: SkuBytesOptions): Uint8Array {
  const b = new Uint8Array(63);
  const u16 = (off: number, v: number) => {
    b[off] = v & 0xff;
    b[off + 1] = (v >> 8) & 0xff;
  };
  u16(0, o.magic ?? 0xcab6);
  b[2] = 0x30;
  b[3] = 63;
  const code = new TextEncoder().encode(o.sku.slice(0, 12));
  b.set(code, 8);
  b[20] = 0x00; // DYMO
  b[21] = 0x01;
  b[22] = o.material ?? 3; // paper
  b[23] = o.labelType ?? (o.lengthMm > 0 ? 1 : 0);
  b[24] = 1; // bianco
  b[25] = 0; // nero
  u16(40, Math.round(o.lengthMm * 10));
  u16(42, Math.round(o.widthMm * 10));
  u16(48, Math.round((o.widthMm + 3) * 10));
  u16(50, o.totalLabels ?? 130);
  b[56] = 0x01; // count-down
  const date = new TextEncoder().encode((o.productionDate ?? '24').slice(0, 2));
  b.set(date, 60);
  return b;
}
