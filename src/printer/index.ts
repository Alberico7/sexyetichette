import { simRequested } from '@/sim';
import type { PrinterPort } from './types';

/** `true` se la build consente la stampante simulata (mai in produzione). */
export const SIMULATION_AVAILABLE = import.meta.env.DEV || import.meta.env.MODE === 'test';

export function simulationRequested(): boolean {
  return SIMULATION_AVAILABLE && simRequested();
}

/**
 * Crea il collegamento alla stampante.
 * In sviluppo, con `?sim` nell'indirizzo, usa la stampante simulata.
 * La condizione su `import.meta.env.DEV` è costante: in produzione Vite elimina
 * il ramo e il modulo simulato non entra nella build.
 */
export async function createPrinterPort(): Promise<PrinterPort> {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    if (simulationRequested()) {
      const { SimulatedPrinterPort } = await import('./simulated');
      return new SimulatedPrinterPort();
    }
  }
  // Il driver della stampante è caricato a parte, dopo l'interfaccia.
  const { WebUsbPrinterPort } = await import('./webusb');
  return new WebUsbPrinterPort();
}

export type { PrinterPort } from './types';
