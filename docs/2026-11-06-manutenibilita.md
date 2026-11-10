# Manutenibilità: test e2e in pubblicazione, lint e formattazione, aiuti comuni nei test

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

Dal controllo di manutenibilità del 2026-11-06 si realizzano tre punti. Nessuno cambia il comportamento dell'app.

## 1. I test e2e e di prestazioni girano prima di ogni pubblicazione

**Oggi** il flusso `.github/workflows` lancia `npm test`, cioè solo vitest: test unitari e di rendering. I 47 test Playwright (e2e e prestazioni) non girano, quindi una regressione nell'interfaccia può arrivare online.

**Cosa cambia** nel lavoro `build` del flusso, dopo `npm test`:

```yaml
- run: npx playwright test --project=e2e
- run: npx playwright test --project=perf
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: |
      test-results/
      playwright-report/
    retention-days: 7
```

- Se un test fallisce, il sito **non** viene pubblicato e resta la versione precedente.
- Gli screenshot e i dettagli dell'errore si scaricano dalla pagina dell'esecuzione su GitHub.
- **Prestazioni:** le soglie, come «anteprima in meno di 150 ms oltre il tocco», sono tarate sul mio computer. I server di GitHub sono più lenti e variabili, quindi lì il test potrebbe fallire senza un vero problema.
  - Sul server il test di prestazioni gira con `PERF_CI=1`, e le soglie di tempo vengono raddoppiate.
  - I controlli sui blocchi lunghi durante la digitazione restano gli stessi.
  - Se dopo 3 pubblicazioni risulta ancora instabile, lo tolgo dal flusso e resta solo in locale. In quel caso lo annoto nel README.
- Il server di Playwright usa già Chromium, installato dal flusso di oggi.
- **Durata:** la pubblicazione richiede circa 1–2 minuti in più.

## 2. ESLint e Prettier

**Oggi** non c'è nessun controllo automatico di stile e di errori comuni. Prettier l'ho usato a mano su qualche file, ma non è fra le dipendenze.

**Cosa cambia:**

- **Nuove dipendenze di sviluppo,** a versione esatta, tutte pubblicate da almeno 2 settimane:
  - `prettier` 3.9.10
  - `eslint` 10.13.0
  - `@eslint/js` 10.0.1
  - `typescript-eslint` 8.72.1
  - `eslint-plugin-vue` 10.12.0
  - `vue-eslint-parser` 10.4.1
  - `globals` 17.13.0

  Non vanno nella versione pubblicata dell'app, che resta uguale byte per byte. La build lo verifica.
- **`.prettierrc.json`:** lo stile già usato nel codice, cioè apici singoli, punto e virgola, righe fino a 120 caratteri, virgola finale e 2 spazi. Così la prima formattazione cambia il meno possibile.
- **`.prettierignore`:** `dist`, `test-results`, `node_modules`, i file `.md` dei documenti (scritti a mano) e i caratteri.
- **`eslint.config.js`:** regole consigliate di JavaScript, TypeScript e Vue 3, più due regole del progetto.
  - `@typescript-eslint/no-floating-promises`: segnala le promesse lasciate senza `await` né `void`, che sono la causa tipica di errori USB che nessuno vede. Si scrive `void` quando è voluto, come già si fa nel codice.
  - `@typescript-eslint/consistent-type-imports`: si allinea a `verbatimModuleSyntax`, già attivo.
  - Le regole di sola formattazione sono spente, perché quella la fa Prettier.
- **Nuovi comandi:**
  - `npm run lint`: ESLint su `src` e `tests`;
  - `npm run format`: Prettier scrive le correzioni;
  - `npm run format:check`: Prettier controlla soltanto.
- **Pubblicazione:** il flusso lancia `npm run lint` e `npm run format:check` prima dei test. Se uno dei due fallisce, il sito non viene pubblicato.
- **Prima applicazione:**
  - un commit a parte, solo formattazione, con `npm run format`, così le modifiche vere restano leggibili nella storia;
  - poi le correzioni di ESLint, una per una, senza cambiare il comportamento;
  - se una regola segnala molti casi corretti di proposito, la spengo per quel file con un commento che spiega perché, invece di toglierla per tutti.
- **CRLF:** OneDrive su Windows scrive i file con il fine riga di Windows. `.gitattributes` li porta già a LF nel commit, e Prettier usa `endOfLine: "lf"`. I file nel repository restano LF.

## 3. Aiuti comuni nei test e2e

**Oggi** i 5 file in `tests/e2e/` ripetono ciascuno il controllo degli errori in console, `noHorizontalScroll` e una versione di `connect`.

**Cosa cambia:**

- **Nuovo file `tests/e2e/helpers.ts`** con:
  - `test`: il `test` di Playwright esteso con un controllo automatico. Fallisce se la pagina scrive errori o avvisi di Vue in console, come fa oggi la coppia `beforeEach`/`afterEach` ripetuta in ogni file;
  - `noHorizontalScroll(page)`;
  - `connectSimulated(page, { fault?, waitForRoll? })`: apre `/?sim`, imposta l'eventuale guasto, collega e, se richiesto, aspetta che il formato del rotolo sia stato adottato;
  - `writeText(page, testo)`;
  - `jobs(page, n)`: lavori ricevuti dalla stampante simulata;
  - `fakeShare(page)`, `shared(page)` e `fakeClipboard(page)`, per leggere il testo condiviso o copiato.
- I 5 file importano da `helpers.ts`. I test restano uguali; cambia solo da dove prendono gli aiuti.
- `tests/perf/perf.spec.ts` usa lo stesso file dove serve.

## Test e verifica

- Prima e dopo ogni passo passano tutti i test: 238 vitest e 47 Playwright.
- La versione pubblicata dell'app (il file `dist`) è identica prima e dopo la formattazione e le correzioni di ESLint, a parte il nome del commit inserito nella build. Si controlla confrontando i file costruiti.
- Prima di fondere le modifiche, il flusso su GitHub gira almeno una volta con i nuovi passi e risulta verde.

## Fuori da questo lavoro

I punti 4 e 5 del controllo, cioè «Ultime stampe» registrato in un posto solo e le copie passate direttamente alla stampa, si fanno insieme alla correzione delle copie multiple. Il punto 6, su `App.vue`, si fa più avanti.

## Note di implementazione (2026-11-06)

- **Commit separati:**
  1. aiuti comuni e2e;
  2. strumenti e flusso di pubblicazione;
  3. sola formattazione Prettier;
  4. correzioni di ESLint.
- **Aiuti e2e:** `tests/e2e/helpers.ts`. Il controllo degli errori in console è un fixture automatico. È stato verificato con un test di prova che scrive `console.error`: il test fallisce come deve.
- **ESLint, configurazione oltre al piano:**
  - `require-await` spento: le porte e i finti trasporti implementano interfacce async;
  - `no-unsafe-*` spenti solo nei due test dei caratteri, perché opentype.js non ha tipi;
  - `prefer-const` con `ignoreReadBeforeAssign`, per `chosen` in `usb-diagnostics.ts`, letto in una closure prima dell'assegnazione;
  - `unbound-method` spento riga per riga in `usb-trace.ts` e nel suo test, con un commento.
- **Errore trovato e corretto durante il lavoro:**
  - la correzione automatica di ESLint aveva trasformato gli import delle forme in `src/render/konva.ts` in `import type`;
  - quegli import registrano le forme in Konva, quindi 43 test sono falliti con «Konva.Rect is not a constructor»;
  - ripristinati, con un commento e la regola spenta solo lì.
- **ESLint non ha trovato promesse lasciate senza `await`** (`no-floating-promises`).
- **Tipi:** `tsconfig.json` ora controlla anche `tests/e2e`, `tests/perf`, `vite.config.ts` e `playwright.config.ts`. Non è emerso nessun errore.
- **Verifica della build:** dopo formattazione e correzioni, l'app costruita è identica alla precedente a parte l'identificatore del commit. Il confronto ignora i nomi dei file con hash, gli identificatori degli stili `data-v-…` e gli spazi all'inizio e alla fine dei testi nei modelli dei componenti, che il browser non mostra.
- **`npm audit`:** 11 segnalazioni «moderate», tutte da `minimatch`, usato da ESLint. È un possibile rallentamento solo con schemi di file scritti apposta, e solo sul computer di sviluppo. Non entra nell'app.
- **Primo giro su GitHub (commit `c5b4691`):**
  - lint, formattazione, vitest ed e2e: verdi;
  - **prestazioni: fallito anche con le soglie raddoppiate.** Il sito non è stato pubblicato, come previsto.
- **Scelta:** il test di prestazioni resta nel flusso ma con `continue-on-error`, quindi è solo informativo. Le soglie vere si verificano in locale, prima di ogni modifica all'interfaccia.
  - Il documento prevedeva fino a 3 tentativi. Ne è bastato uno: i tempi di un server condiviso con la CPU rallentata 4 volte non dicono nulla sul Pixel 7a.
  - Tutti gli altri controlli restano bloccanti.
- **Azioni di GitHub aggiornate** (richiesta dell'utente, 2026-11-06). Le versioni precedenti usavano Node 20, in dismissione sui server di GitHub:

  | Azione | Prima | Dopo |
  |---|---|---|
  | `checkout` | v4 | v7 |
  | `setup-node` | v4 | v7 |
  | `upload-artifact` | v4 | v7 |
  | `upload-pages-artifact` | v3 | v5 |
  | `deploy-pages` | v4 | v5 |
