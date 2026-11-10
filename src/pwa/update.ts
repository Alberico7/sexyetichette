/**
 * Service worker e aggiornamenti su conferma: quando è pubblicata una versione nuova
 * compare «Nuova versione disponibile — Aggiorna». Vedi docs/2026-11-10-pwa.md.
 */
import { ref } from 'vue';
import { diagLog } from '@/diagnostics/log';

/** C'è una versione nuova pronta: si attiva con `applyUpdate()`. */
export const updateReady = ref(false);

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

const HOUR = 60 * 60 * 1000;

export async function setupPwa(): Promise<void> {
  // In sviluppo, con «?sim», l'aggiornamento si simula (per gli e2e): in produzione Vite elimina il ramo.
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    if (new URLSearchParams(location.search).has('sim')) {
      (window as unknown as { __simUpdate?: () => void }).__simUpdate = () => (updateReady.value = true);
    }
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        diagLog.add('app', 'Nuova versione disponibile');
        updateReady.value = true;
      },
      onOfflineReady() {
        diagLog.add('app', 'App pronta anche senza rete');
      },
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        // Controlla le versioni nuove ogni ora e quando l'app torna in primo piano.
        setInterval(() => void reg.update().catch(() => {}), HOUR);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {});
        });
      },
      onRegisterError(err: unknown) {
        diagLog.add('app', `Service worker non registrato: ${String(err)}`);
      },
    });
  } catch (err) {
    diagLog.add('app', `Service worker non disponibile: ${String(err)}`);
  }
}

/** Attiva la versione nuova e ricarica la pagina. */
export async function applyUpdate(): Promise<void> {
  updateReady.value = false;
  if (updateSW) await updateSW(true);
  else location.reload();
}
