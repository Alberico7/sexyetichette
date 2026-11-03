/** Versione dell'app, inserita da Vite al momento della build (vedi `vite.config.ts`). */
declare const __APP_BUILD__: { version: string; commit: string; builtAt: string } | undefined;

export const APP_BUILD: { version: string; commit: string; builtAt: string } =
  typeof __APP_BUILD__ !== 'undefined' && __APP_BUILD__ ? __APP_BUILD__ : { version: 'sviluppo', commit: '–', builtAt: '' };
