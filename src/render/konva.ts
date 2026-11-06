/**
 * Konva ridotto alle parti usate dall'app (nucleo, rettangolo, testo, maniglie),
 * invece del pacchetto completo con filtri e forme: circa metà del peso.
 * Importare Konva sempre da qui, mai da 'konva'.
 */
import CoreKonva from 'konva/lib/Core';
// Import con effetto: caricare il modulo registra la forma in Konva. Non devono diventare `import type`.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
import { Transformer } from 'konva/lib/shapes/Transformer';
/* eslint-enable @typescript-eslint/consistent-type-imports */

// L'import delle forme le registra anche nello spazio dei nomi di Konva.
const Konva = CoreKonva as typeof CoreKonva & {
  Rect: typeof Rect;
  Text: typeof Text;
  Transformer: typeof Transformer;
};

export default Konva;

export type { Stage } from 'konva/lib/Stage';
export type { Layer } from 'konva/lib/Layer';
export type { Group } from 'konva/lib/Group';
export type { Node } from 'konva/lib/Node';
export type { Rect } from 'konva/lib/shapes/Rect';
export type { Text } from 'konva/lib/shapes/Text';
export type { Transformer } from 'konva/lib/shapes/Transformer';
