/**
 * Avvio in sottofondo, dopo il primo disegno dell'interfaccia: il driver della
 * stampante (ricollegamento a una stampante già autorizzata) e il carattere dei
 * nuovi testi, così è pronto al primo «+ Testo».
 */
import { onMounted } from 'vue';
import { DEFAULT_FONT } from '@/model/fonts';
import { requestFont } from '@/render/web-fonts';
import { usePrinterStore } from '@/stores/printer';

export function useBackgroundStartup(): void {
  const printer = usePrinterStore();
  onMounted(() => {
    const start = () => {
      void printer.tryReconnect();
      requestFont(DEFAULT_FONT);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1000 });
    else setTimeout(start, 0);
  });
}
