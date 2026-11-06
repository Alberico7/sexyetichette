# Diagnostica più semplice da raggiungere e da usare

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Perché

Durante le prove sul telefono la diagnostica serve spesso: prova della 550, stampa di prova e copia del registro dopo una stampa. Oggi è scomoda in quattro punti.

1. **Difficile da aprire.** Si arriva solo dal formato (*Formato ▾ → Diagnostica*, e solo con la stampante collegata), da un messaggio di errore o con `?diagnostica` nell'indirizzo. Dopo una stampa servono tre tocchi e bisogna sapere dov'è.
2. **«Copia tutto» è in fondo,** sotto risultati e domande lunghe. Per mandare il registro bisogna scorrere fino in fondo.
3. **Le schede sono nell'ordine sbagliato per questa fase.** «USB» è la prima, ma serviva solo prima che la 550 funzionasse. Oggi le più usate sono «LabelWriter 550» e «Stampa di prova».
4. **Si perde la scheda usata.** Chiudendo e riaprendo il pannello si torna alla scheda predefinita.

## Cosa cambia

### 1. Pulsante «Diagnostica» sempre visibile nella barra in alto

- Nella barra della stampante, accanto al pulsante del tema, compare un pulsante con l'icona **🔧** (etichetta accessibile «Diagnostica»).
- È sempre visibile, con la stampante collegata o no. Un tocco apre il pannello.
- Il pulsante dipende da un solo interruttore, `TEST_PHASE = true` in `src/config.ts`. A fine collaudo basta metterlo a `false` per toglierlo: la diagnostica resta raggiungibile dal formato e dagli errori, come oggi.
- La barra ha spazio, perché il pulsante occupa 48 px come quello del tema. Il testo dello stato si accorcia con «…» se serve. Nessuno scorrimento orizzontale a 412 px.

### 2. «Copia tutto» e «Condividi» fissi in fondo al pannello

- I due pulsanti passano nel piede del pannello (lo spazio in basso che non scorre), quindi sono **sempre visibili** in tutte e tre le schede.
- Sopra i pulsanti, una riga piccola dice quanti eventi ci sono nel registro, per esempio «Registro: 300 eventi».
- Il testo copiato è lo stesso di oggi.
- La sezione «Tutti i risultati» in fondo alla pagina sparisce, perché è sostituita dal piede.

### 3. Schede in un ordine nuovo, e si ricordano

- Nuovo ordine: **«Prova 550» · «Stampa di prova» · «USB»**. Il nome «LabelWriter 550» diventa «Prova 550», più corto e più chiaro.
- All'apertura si torna all'**ultima scheda usata**, salvata nel browser.
- La prima volta: «Prova 550» se la stampante è collegata, altrimenti «USB», come oggi.
- **Le schede restano sempre in alto,** ferme mentre si scorre. Oggi stanno in cima al contenuto e dopo la prova 550 scorrono via con i risultati lunghi: per questo non si riusciva a passare alla stampa di prova (segnalato il 2026-11-06).
- Sotto il riepilogo della prova 550 compare il pulsante **«Vai alla stampa di prova →»**, perché il riepilogo stesso dice «Prova ora la stampa di prova».

### 4. Registro con le ultime stampe in evidenza

Il registro tiene gli ultimi 300 eventi, e una stampa fatta dopo la diagnostica era già in fondo (oppure non c'era). Per controllare le copie multiple e le prove future:

- Nel riepilogo all'inizio del testo copiato compare una sezione **«Ultime stampe»** con le ultime 10 stampe. Per ciascuna:
  - ora;
  - copie chieste;
  - etichette inviate (numero di «ESC n»);
  - densità e formato;
  - etichette rimaste sul rotolo prima e dopo, lette dallo stato.
- Così, con «Copia tutto» subito dopo una stampa, si vede a colpo d'occhio se ne sono state chieste 2 e quante ne sono uscite davvero.
- Le stampe sono quelle registrate dall'app, anche le stampe normali dall'editor e non solo quelle della diagnostica.

## Cosa non cambia

- Contenuto delle tre schede, comandi inviati e domande della stampa di prova.
- Nessun comando nuovo verso la stampante: la diagnostica resta di sola lettura, tranne la stampa di prova confermata.

## Test

- **E2E:**
  - il pulsante 🔧 apre la diagnostica da stampante scollegata e collegata;
  - «Copia tutto» è visibile senza scorrere in ogni scheda;
  - ordine delle schede;
  - la scheda usata si ricorda dopo chiusura e riapertura;
  - nessuno scorrimento orizzontale a 412×915, nemmeno nella barra in alto.
- **Unitari:**
  - «Ultime stampe» con la stampante simulata: 1 stampa da 2 copie dà «copie 2, etichette inviate 2»;
  - limite di 10 stampe;
  - il testo copiato contiene la sezione;
  - con `TEST_PHASE = false` il pulsante non c'è.
- I test esistenti della diagnostica vengono aggiornati dove cambia l'ordine delle schede o la posizione di «Copia tutto».

## Note di implementazione (2026-11-06)

- **Pulsante 🔧:** `src/components/PrinterBar.vue`, comandato da `TEST_PHASE` in `src/config.ts`.
- **Piede fisso:** `src/components/DiagnosticsShare.vue`, nello spazio `footer` del pannello (`App.vue`). La vecchia sezione «Tutti i risultati» è stata tolta.
- **Schede:** `src/components/DiagnosticsPanel.vue`.
  - Le schede stanno in una barra `position: sticky`.
  - L'ultima scheda usata è salvata nel browser con la chiave `etichettatrice.diagnostica.scheda`; se il browser non salva, si usa la scheda predefinita.
  - Cambiando scheda si torna in cima.
- **«Vai alla stampa di prova →»:** `src/components/PrinterCheck.vue`.
- **Ultime stampe:** `src/diagnostics/print-history.ts`.
  - Con la 550 vera, le etichette inviate e il contatore del rotolo si leggono dal traffico USB già osservato (`listener` in `usb-trace.ts`), senza comandi in più.
  - Il contatore è nei byte 27–28 della risposta a ESC A.
  - La stampante simulata registra le copie che produce.
- **Test:**
  - 7 unitari (`tests/unit/print-history.test.ts`), con le risposte di stato vere del 2026-11-06;
  - 1 e2e in `tests/e2e/diagnostics.spec.ts`: pulsante 🔧 con la stampante scollegata e collegata, ordine delle schede, schede e «Copia tutto» visibili dopo lo scorrimento, «Vai alla stampa di prova», scheda ricordata, stampa da 2 copie in «Ultime stampe».
- **Differenza dal piano:** non c'è un test automatico con `TEST_PHASE = false`, perché è una costante del codice. Per toglierla basta il controllo `v-if` già presente.
