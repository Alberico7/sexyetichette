# Manutenibilità (secondo controllo): pagina di prova, testo, simulazione, test, README, microfono

- Data: 2026-11-10
- Stato: **confermato e realizzato (2026-11-10)**

Dal controllo del 2026-11-10 l'utente ha scelto di fare **tutti i punti**. Nessuno cambia il comportamento dell'app, tranne il punto 1, che toglie una pagina di prova separata. Il primo controllo è in `docs/2026-11-06-manutenibilita.md`.

Ogni punto avrà un commit a parte. Prima e dopo ogni punto devono passare lint, tipi, tutti i test e la build.

## 1. Togliere la pagina di prova della dettatura e Whisper

**Oggi:**
- `prova-voce.html` e `src/prova-voce/` (circa 500 righe) ripetono a mano il microfono e il caricamento di Vosk, già presenti in `src/voice/`;
- `@huggingface/transformers` serve solo a Whisper nella pagina di prova, e mette nel sito un motore di calcolo da 27 MB.

**Cosa cambia:**
- si tolgono `prova-voce.html`, `src/prova-voce/`, la seconda voce di build in `vite.config.ts`, le esclusioni `prova-voce`/Whisper nella configurazione del service worker, `@huggingface/transformers` e `tests/e2e/prova-voce.spec.ts`;
- il test «l'app non carica le librerie della dettatura finché non si usa il microfono» si sposta in `tests/e2e/dictation.spec.ts`;
- il documento della prova (`docs/2026-11-10-prova-dettatura.md`) resta, con una nota: «pagina tolta il …».
- **Il modello già scaricato resta valido:** la cache si chiama ancora `etichettatrice-prova-voce` e l'app continua a usarla, quindi non si riscaricano 50 MB.
- **La dettatura nell'app funziona sul Pixel** (prova dell'utente, 2026-11-10): la pagina di prova non serve più. Se servisse di nuovo, si recupera dalla storia di git.

## 2. Dividere `TextProperties.vue` (571 righe)

**Oggi** il componente fa quattro lavori:
- la casella del testo, con i codici nascosti dei cuori;
- i quattro simboli;
- la dettatura, con pulsante, conferma, stato e avanzamento;
- lo stile del testo.

**Cosa cambia:**
- **`SymbolButtons.vue`:** i quattro pulsanti ⌀ ISO, ∅ 45°, AFKEUR e N.R. Ogni tocco emette `insert` con il testo da inserire;
- **`DictationControl.vue`:** il microfono, la conferma dello scaricamento, il testo provvisorio, i messaggi e l'avanzamento. Usa `useDictation` ed emette `text` con il testo finito;
- **`TextProperties.vue`** tiene la casella, l'inserimento al cursore (uno solo per simboli e dettatura) e lo stile;
- ogni componente porta con sé i suoi CSS, comprese le regole dell'orizzontale con la tastiera aperta;
- i `data-testid` restano gli stessi, quindi gli e2e non cambiano.

## 3. Un solo interruttore per la simulazione

**Oggi:**
- `?sim` si controlla in tre posti, con tre funzioni diverse: `src/printer/index.ts`, `src/voice/engine.ts`, `src/pwa/update.ts`;
- ci sono cinque variabili globali sparse: `__simVoice`, `__simVoiceDownloaded`, `__simVoiceDelayMs`, `__simUpdate`, più `__labelStage` per l'editor;
- lo script `check-no-simulator.mjs` le elenca a mano. Oggi `__simUpdate` è rimasto fuori dall'elenco, senza che nessun test se ne accorgesse. La build era comunque pulita: verificato.

**Cosa cambia:**
- **`src/sim.ts`:**
  - `simRequested()` (c'è `?sim` nell'indirizzo);
  - un solo oggetto globale `window.__sim`, con i campi tipizzati: `voice.phrases`, `voice.downloaded`, `voice.delayMs`, `update()`.
- **In ogni punto** la condizione su `import.meta.env.DEV` resta scritta per esteso. Solo così Vite elimina il ramo in produzione: oggi una versione chiusa in una funzione aveva lasciato un pezzo di simulatore nella build.
- `__labelStage` diventa `window.__sim.labelStage`.
- **`check-no-simulator.mjs`** cerca `__sim` (copre tutti i campi) e i nomi delle classi simulate. Un test unitario verifica che l'elenco contenga `__sim`.
- Gli e2e usano `window.__sim`.

## 4. Test unitari sulle parti nuove più delicate

Nel progetto «browser» (Chromium vero, con `fetch`, cache e `crypto` simulati dove serve):

- **`vosk-model.ts`:**
  - impronta diversa → errore, e il file non viene conservato;
  - modello già nel telefono → nessuno scaricamento;
  - conservazione non possibile → si va avanti lo stesso.
- **`back-button.ts`**, con un piccolo componente di prova:
  - apertura → un passo in più;
  - chiusura con Fine → passo tolto;
  - «indietro» → `close()` chiamata;
  - chiusura e riapertura immediata (il caso della stampa rapida) → il pannello resta aperto.
- **`useDictation.ts`**, con un motore finto:
  - pulsante lasciato durante la preparazione → nessun ascolto e messaggio «Pronto»;
  - permesso negato → messaggio sul microfono;
  - frase vuota → «Non ho sentito niente»;
  - lentezza → avviso del JIT una volta sola.

## 5. README aggiornato

- **Nome:** Rubeculabel, già fatto.
- **«Stato»:** le funzioni di oggi:
  - dettatura;
  - simboli e codici nascosti;
  - app installabile e senza rete;
  - aggiornamento su conferma;
  - orizzontale.
- **«Struttura»:** aggiunge `src/voice/`, `src/pwa/`, `src/diagnostics/`, `src/storage/`, `src/composables/`, `scripts/`.
- **Nuova sezione «Installazione sul telefono»:** come aggiungere l'icona e come attivare il JIT su Vanadium.
- **Comandi dei test:** `test:pwa`.

## 6. Microfono con `AudioWorklet` al posto di `ScriptProcessorNode`

**Oggi** la registrazione usa `ScriptProcessorNode`, che Chrome segnala come deprecato. Lavora sul filo principale della pagina, quindi può perdere pezzi di audio se la pagina è occupata.

**Cosa cambia:**
- in `src/voice/vosk-engine.ts` un piccolo `AudioWorklet`, scritto nel file stesso e caricato come Blob, così non serve configurare la build. Raccoglie l'audio fuori dal filo principale e lo passa a Vosk a pezzi;
- dopo il punto 1 è l'unico posto da cambiare.
- **Verifica:** la prova sul PC con il vero Vosk e la voce sintetica di Windows, come prima («TUBO ⌀20,50»).

**Restano solo annotati, senza intervento:**
- `vosk-browser` 0.0.8 (2022) non è più aggiornato;
- il nome della cache del modello, che resta per non riscaricarlo.

## Test e verifica

- Tutti i test esistenti passano senza modifiche, tranne dove cambiano i nomi delle variabili di simulazione (punto 3) e lo spostamento del test del punto 1.
- La build non contiene niente di simulato, e lo controlla lo script aggiornato.
- Prova sul PC con il vero Vosk dopo i punti 2 e 6.
- La precache del service worker non deve crescere.

## Note di implementazione (2026-11-10)

Un commit per punto. Dopo ognuno sono passati lint, tipi, tutti i test e la build.

1. **Pagina di prova tolta** (`99ec8fe`):
   - la precache scende da 37 a 32 file;
   - il test della PWA ora controlla che sia in cache lo script principale che la pagina carica davvero. Prima cercava il nome `main-…js`, che con una sola pagina è diventato `index-…js`.
2. **`TextProperties.vue` diviso** (`710b2cc`):
   - da 571 a 392 righe, più `SymbolButtons.vue` (84) e `DictationControl.vue` (135);
   - la riga della casella è una griglia: casella e microfono, con la dettatura sotto a tutta larghezza. Così `DictationControl` può avere più elementi alla radice;
   - gli screenshot in verticale e in orizzontale con la tastiera aperta sono uguali a prima.
3. **Simulazione** (`dc27125`):
   - `src/sim.ts` e `window.__sim`;
   - **verificato** che `check-no-simulator` blocca la build se un uso esce dal ramo protetto: con una perdita voluta in `update.ts` lo script ha segnalato `index-….js: __sim` ed è uscito con errore;
   - mentre lavoravo è emerso un caso concreto: il marcatore `__simUpdate` non era mai entrato nella lista dello script. Prettier aveva già spezzato l'elenco su più righe, quindi la mia sostituzione non l'aveva trovato. La build era comunque pulita.
4. **Test** (`99942aa`): 17 nuovi test nel progetto «browser».
   - Il test del tasto indietro usa una cronologia finta. Quella vera, nel browser dei test, faceva navigare anche la pagina che li controlla e la connessione cadeva.
   - Il test «chiuso e subito riaperto» fallisce senza la correzione degli «indietro» chiesti dall'app: verificato.
5. **README** (`705940d`). Aggiunte anche le licenze di `vosk-browser` e del modello italiano, entrambi Apache 2.0 secondo la pagina ufficiale dei modelli Vosk. Il modello non è incluso nel sito.
6. **`AudioWorklet`:**
   - pezzi da 1024 campioni; quando si lascia il pulsante, un «flush» consegna l'ultimo pezzo;
   - prova sul PC con il vero Vosk e la voce sintetica: «TUBO ⌀20,50», senza più l'avviso di funzione deprecata in console.

**Totali:** 415 unitari + browser, 106 Playwright (e2e, prestazioni, PWA).
