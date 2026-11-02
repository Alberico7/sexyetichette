/** Risoluzione della testina della LabelWriter 550. */
export const PRINT_DPI = 300;

export const MM_PER_INCH = 25.4;

export function mmToDots(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm * dpi) / MM_PER_INCH);
}

/** Conversione senza arrotondamento, per posizionare gli elementi nella scena. */
export function mmToDotsExact(mm: number, dpi = PRINT_DPI): number {
  return (mm * dpi) / MM_PER_INCH;
}

export function dotsToMm(dots: number, dpi = PRINT_DPI): number {
  return (dots * MM_PER_INCH) / dpi;
}

export function ptToMm(pt: number): number {
  return (pt * MM_PER_INCH) / 72;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
