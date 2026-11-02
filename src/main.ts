import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { applyTheme } from './theme';
import './styles/base.css';

applyTheme();
createApp(App).use(createPinia()).mount('#app');
