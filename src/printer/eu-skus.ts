/**
 * Codici europei delle etichette LabelWriter, associati ai formati del catalogo.
 *
 * Fonte: tabella ufficiale DYMO Europa «LabelWriter labels overview»,
 * https://dymo.eu/Footer/Technical-Info/LabelWriter-labels-overview/ (consultata il 2026-11-03).
 * Esclusi i formati solo per 4XL/5XL (testina larga) e le etichette gioielli 10×19.
 *
 * Non è noto quale codice sia scritto nel tag NFC dei rotoli europei: per ogni
 * formato associo tutti i codici, comprese le confezioni multiple.
 * Vedi docs/2026-11-03-codici-europei-etichette.md.
 */

export interface EuCodes {
  /** Id del formato nel catalogo. */
  mediaId: string;
  /** Misure secondo la tabella DYMO: larghezza × lunghezza in mm (0 = continuo). */
  widthMm: number;
  lengthMm: number;
  /** Codici articolo (S07…, S09…) e numeri brevi: mostrati nell'elenco dei formati. */
  shown: string[];
  /** Confezioni multiple e varianti: cercabili e riconosciuti via NFC, non mostrati. */
  more: string[];
}

export const EU_CODES: readonly EuCodes[] = [
  { mediaId: 'multi-purpose-extra-small', widthMm: 13, lengthMm: 25, shown: ['S0722530', '11353'], more: [] },
  { mediaId: 'return-address', widthMm: 19, lengthMm: 51, shown: ['S0722550', '11355'], more: ['2234186', '2234184'] },
  { mediaId: 'barcode-dymo-file', widthMm: 19, lengthMm: 64, shown: [], more: ['2112284'] },
  { mediaId: 'multi-purpose-square', widthMm: 25, lengthMm: 25, shown: ['S0929120'], more: ['2112286'] },
  { mediaId: 'multi-purpose-small', widthMm: 25, lengthMm: 54, shown: ['S0722520', '11352'], more: ['2177564', '2223589', '2112283'] },
  { mediaId: 'shelving', widthMm: 25, lengthMm: 89, shown: [], more: ['2112285'] },
  { mediaId: 'address-standard', widthMm: 28, lengthMm: 89, shown: ['S0722370', '99010'], more: ['2093091', '13188', '1983173'] },
  { mediaId: 'multi-purpose-medium-removable', widthMm: 32, lengthMm: 57, shown: ['S0722540', '11354'], more: ['2093094', '2093095', '2223590'] },
  { mediaId: 'multi-purpose-medium', widthMm: 32, lengthMm: 57, shown: [], more: ['2112289'] },
  { mediaId: 'address-large', widthMm: 36, lengthMm: 89, shown: ['S0722400', '99012', 'S0722410', '99013'], more: ['2093093', '13187', '1983172'] },
  { mediaId: 'appointment-card', widthMm: 51, lengthMm: 89, shown: ['S0929100'], more: [] },
  { mediaId: 'multi-purpose-large', widthMm: 54, lengthMm: 70, shown: ['S0722440', '99015'], more: ['2234188', '2234185'] },
  {
    mediaId: 'shipping-standard',
    widthMm: 54,
    lengthMm: 101,
    shown: ['S0722430', '99014'],
    more: ['2093092', '13186', '2223588', '2133399', '2133400'],
  },
  { mediaId: 'shipping-large', widthMm: 59, lengthMm: 102, shown: [], more: ['2112290'] },
  { mediaId: 'lever-arch', widthMm: 59, lengthMm: 190, shown: ['S0722480', '99019'], more: [] },
  { mediaId: 'continuous-57', widthMm: 57, lengthMm: 0, shown: ['2191636'], more: [] },
  // Formati nuovi (non presenti nel catalogo della libreria).
  { mediaId: 'eu-suspension-file', widthMm: 12, lengthMm: 50, shown: ['S0722460', '99017'], more: [] },
  { mediaId: 'eu-lever-arch-narrow', widthMm: 38, lengthMm: 190, shown: ['S0722470', '99018'], more: [] },
  { mediaId: 'eu-name-badge-small', widthMm: 41, lengthMm: 89, shown: ['S0722560', '11356'], more: ['2234187', '2234183'] },
];

/**
 * Formati della tabella DYMO assenti dal catalogo della libreria.
 * Lunghezza in punti calcolata dalle misure: da verificare con la stampa di prova.
 */
export const EU_NEW_FORMATS: readonly { id: string; base: string; widthMm: number; lengthMm: number }[] = [
  { id: 'eu-suspension-file', base: 'Cartella sospesa', widthMm: 12, lengthMm: 50 },
  { id: 'eu-lever-arch-narrow', base: 'Dorso raccoglitore stretto', widthMm: 38, lengthMm: 190 },
  { id: 'eu-name-badge-small', base: 'Badge piccolo', widthMm: 41, lengthMm: 89 },
];
