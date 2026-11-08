import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { APP_BUILD } from './app-info';
import { diagLog, installGlobalCapture } from './diagnostics/log';
import { trackScreenShape } from './screen-shape';
import { applyTheme } from './theme';
import './styles/base.css';

installGlobalCapture();
diagLog.add('app', `Avvio: app ${APP_BUILD.version} (${APP_BUILD.commit}), ${navigator.userAgent}`);
applyTheme();
trackScreenShape();
createApp(App).use(createPinia()).mount('#app');
