import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { APP_BUILD } from './app-info';
import { diagLog, installGlobalCapture } from './diagnostics/log';
import { setupPwa } from './pwa/update';
import { trackScreenShape } from './screen-shape';
import { applyTheme } from './theme';
import './styles/base.css';

// Browser troppo vecchio: index.html ha già scritto il messaggio. Niente app né service
// worker (docs/2026-11-27-browser-troppo-vecchio.md).
if (!document.documentElement.hasAttribute('data-browser-vecchio')) {
  installGlobalCapture();
  diagLog.add('app', `Avvio: app ${APP_BUILD.version} (${APP_BUILD.commit}), ${navigator.userAgent}`);
  applyTheme();
  trackScreenShape();
  createApp(App).use(createPinia()).mount('#app');
  // Service worker e avviso di aggiornamento (docs/2026-11-10-pwa.md).
  void setupPwa();
}
