# Diagnostica completa della LabelWriter 550

- Data: 2026-11-03
- Stato: **confermato e realizzato**

## Perché

Prima prova con la 550 reale (Pixel 7a, GrapheneOS, Vanadium): la stampante viene collegata e riconosciuta e lo stato si legge, ma **il rotolo non viene riconosciuto**. Restano da verificare anche la stampa, l'allineamento, il verso e la zona non stampabile.

Oggi l'app dice solo «Non è stato possibile leggere il rotolo». `readMedia()` restituisce `null` per cinque cause diverse senza distinguerle:
1. tempo scaduto;
2. risposta più corta di 63 byte;
3. codice del tag diverso da `0xCAB6`;
4. misure assenti;
5. altro errore.

Lo SKU sconosciuto non è tra le cause, perché in quel caso l'app usa le misure lette dal tag.

L'obiettivo è una diagnostica che raccolga **tutto quello che serve per capire un problema** in una sola prova, da condividere con un tocco.

## Principi di sicurezza

- **Solo comandi di lettura**, salvo una richiesta esplicita:
  - `ESC V`: versione della stampante;
  - `ESC A`: stato;
  - `ESC U`: dati del rotolo.
- **Nessun ripristino, reset o cambio di impostazioni** automatico. «Ripristina stampante» resta un pulsante separato, come oggi.
- La **stampa di prova** parte solo dal suo pulsante e dopo una conferma («Stampa 1 etichetta di prova?»).
- **Nessun tentativo di aggirare il controllo NFC**: l'app riporta solo ciò che la stampante comunica.
- Nel testo condiviso **nessun dato personale**:
  - il numero di serie è troncato alle ultime 4 cifre;
  - i testi delle etichette dell'utente non compaiono, solo le loro dimensioni;
  - del contenuto stampato si registrano solo le dimensioni in byte.

## 1. Registro degli eventi (sempre attivo)

Un registro in memoria degli ultimi 300 eventi della sessione, con l'ora al millisecondo. Non viene salvato sul telefono né inviato da nessuna parte.

- **Applicazione:** avvio, versione dell'app (data della build e commit), collegamento automatico o manuale, cambi di stato, errori. Per gli errori registra il codice dell'app e il **messaggio originale della libreria**.
- **USB:** eventi `connect`/`disconnect` del browser e dispositivi autorizzati.
- **Traffico USB:** per ogni scrittura e lettura:
  - direzione, numero di byte, durata, esito (riuscita, tempo scaduto, errore);
  - comando riconosciuto (`ESC A`, `ESC U`, `ESC V`, inizio lavoro, fine lavoro…);
  - per le **risposte** di stato, rotolo e versione, i byte in esadecimale; per i dati di stampa solo le dimensioni.

  Lo ottengo osservando il trasporto USB della libreria, che è un campo privato. Se in una versione futura non fosse raggiungibile, il registro ha solo gli eventi dell'app e tutto il resto funziona come prima.
- **Errori JavaScript non gestiti** (`error`, `unhandledrejection`), per scoprire problemi che oggi passano inosservati.
- **Avvisi della libreria:** per esempio «read filled exactly … bytes», un segnale di risposte non allineate.

## 2. Lettura del rotolo con la causa precisa

- `readMedia()` restituisce un esito con il motivo, al posto di `null`:
  - `timeout`;
  - `short` (N byte);
  - `bad-magic` (con il valore trovato);
  - `no-size`;
  - `error` (con il messaggio).
- **Un secondo tentativo automatico** dopo mezzo secondo, se il primo fallisce.
- Nel pannello «Formato etichetta» compaiono:
  - la causa in italiano, per esempio «La stampante non ha risposto alla richiesta dei dati del rotolo»;
  - i «Dettagli» con i byte ricevuti;
  - i pulsanti «Copia» e «Condividi».

## 3. Pagina «Diagnostica» con due prove

La pagina attuale (`?diagnostica`, link dai messaggi d'errore) diventa:

### A. Collegamento USB (qualsiasi dispositivo)

È la prova attuale e resta com'era: nessun dato inviato. In più mostra per ogni interfaccia gli **endpoint**: direzione, tipo, dimensione del pacchetto. Serve perché il trasporto arrotonda le letture alla dimensione del pacchetto.

### B. LabelWriter 550 (una prova, tutti i controlli)

Usa la stampante già collegata nell'app; se non è collegata, offre «Collega». Esegue in ordine, mostrando per ciascun passaggio ✓/✗, la durata e i dettagli:

1. **Browser e app:**
   - versione dell'app, browser e versione, sistema;
   - pagina sicura, WebUSB presente;
   - larghezza dello schermo e densità dei pixel.
2. **Dispositivo:**
   - codici del produttore e del prodotto;
   - versione del firmware USB (`deviceVersion`);
   - interfacce ed endpoint;
   - modello riconosciuto (550 verificata, 550 Turbo non verificata).
3. **Versione della stampante** (`ESC V`): hardware, firmware, data del firmware, codice prodotto interno. Controlla che coincida con il codice USB.
4. **Stato** (`ESC A`), letto **tre volte** a distanza di mezzo secondo:
   - byte grezzi e campi interpretati: pronta, rotolo presente, errori, dettagli della libreria, stato del lock;
   - tempi di risposta;
   - eventuali differenze tra una lettura e l'altra.
5. **Rotolo** (`ESC U`), letto **tre volte**: esito con la causa, byte grezzi e tutti i campi del tag:
   - codice, marca, materiale, tipo, colore;
   - lunghezza e larghezza, offset stampabili;
   - numero di etichette, contatore, data di produzione.

   Poi confronta i dati con il catalogo: codice trovato o no, misure coincidenti o no. Se le tre letture danno risultati diversi, lo segnala (lettura instabile).
6. **Formato e geometria** del formato scelto nell'app e di quello rilevato:
   - misure in mm e in punti;
   - area stampabile e zone non stampabili;
   - rotazione inviata alla stampante, verso del contenuto.

   Segnala se formato scelto e rotolo non coincidono.
7. **Controllo del lavoro di stampa, senza inviarlo:** prepara il lavoro dell'etichetta attuale e verifica:
   - righe = lunghezza in punti;
   - 84 byte per riga;
   - punti neri presenti;
   - **nessun punto nero nella zona non stampabile**;
   - testo che non esce dall'etichetta.
8. **Impostazioni:** densità, copie, formato e verso salvati.

Alla fine un **riepilogo** in cima con i problemi trovati, in ordine di gravità. Esempi:
- «Il rotolo non risponde: la stampante non invia i dati del tag (3 tentativi su 3)»;
- «Il formato scelto (25×54) è diverso dal rotolo (28×89)».

### C. Stampa di prova (facoltativa, su richiesta)

Un pulsante **«Stampa un'etichetta di prova»**, con conferma, stampa **una** etichetta sul formato del rotolo, o su quello scelto se il rotolo non si legge. L'etichetta contiene:
- un **bordo di 1 punto** sul limite dell'area stampabile, e un secondo bordo tratteggiato 1 mm più all'interno;
- **tacche ogni millimetro** lungo i quattro lati, più lunghe ogni 5 mm, con i numeri ogni 10 mm;
- la scritta **«ALTO»** in alto e una **freccia «→ uscita»** nel verso di avanzamento della carta;
- angoli numerati **1–4** e il formato, per esempio «25×54 · densità normale».

Dopo la stampa compaiono **quattro domande con risposte da toccare**, che finiscono nel testo condiviso:
1. Il bordo esterno è completo su tutti e quattro i lati? (sì / manca a sinistra / a destra / in alto / in basso)
2. La scritta «ALTO» è dritta, capovolta o girata?
3. Su ogni lato, quante tacche mancano o sono tagliate? (numeri da inserire)
4. La stampa è nitida, troppo chiara o troppo scura?

Così si capisce con una sola etichetta se il verso, la zona non stampabile e l'allineamento ipotizzati sono giusti, e di quanto correggerli.

## 4. Condivisione dei risultati

- **«Condividi»** apre il menu di Android (`navigator.share`), con titolo «Etichettatrice – diagnostica» seguito da data e ora. Il pulsante compare solo se il browser lo supporta; l'annullamento non mostra errori.
- **«Copia»** copia lo stesso testo negli appunti.
- Il testo è diviso in sezioni: riepilogo, prove, risposte sulla stampa di prova, registro degli eventi. Il registro va per ultimo, così il riepilogo si legge subito anche nelle app di chat.
- Se il testo è molto lungo (registro pieno), la condivisione invia un file `diagnostica-AAAA-MM-GG-HHMM.txt` se il browser lo permette, altrimenti il testo completo.

## Cosa non cambia

- Il resto dell'app funziona come prima; il registro occupa poca memoria e non rallenta la digitazione. Il test di prestazioni esistente lo verifica.
- Se il rotolo non si legge si può sempre scegliere il formato dall'elenco.
- La build pubblicata continua a non contenere la stampante simulata.

## Struttura

- `src/diagnostics/log.ts`: registro circolare degli eventi, intercettazione di errori e avvisi, testo del registro.
- `src/diagnostics/usb-trace.ts`: osservazione del trasporto USB della libreria e riconoscimento dei comandi.
- `src/diagnostics/media-read.ts`: classificazione delle cause della lettura del rotolo, campi del tag, confronto con il catalogo.
- `src/diagnostics/printer-check.ts`: la prova B, come logica pura che riceve la porta della stampante.
- `src/diagnostics/job-check.ts`: controllo del lavoro di stampa. La logica oggi nel simulatore (`validateJob`) diventa condivisa.
- `src/diagnostics/test-label.ts`: disegno dell'etichetta di prova come bitmap a 1 bit, direttamente alla risoluzione della testina e senza Konva.
- `src/diagnostics/report.ts`: testo completo da copiare e condividere.
- `src/share.ts`: `canShare()`, `shareText()`, `shareFile()`.
- `src/printer/usb-diagnostics.ts`: aggiunta degli endpoint.
- `src/printer/webusb.ts`, `types.ts`:
  - `readMedia()` con l'esito;
  - nuovi metodi di sola lettura `readVersion()` e `readStatusRaw()`;
  - collegamento al registro.
- `src/printer/simulated.ts`: guasti simulati nuovi:
  - rotolo che non risponde, risposta corta, tag non valido;
  - letture instabili;
  - stato lento.
- `src/stores/printer.ts`: conserva l'ultimo esito del rotolo.
- `src/components/UsbDiagnostics.vue` diventa una pagina con le schede «USB», «LabelWriter 550» e «Stampa di prova». `MediaPicker.vue` mostra la causa.

## Test

- **Unitari:**
  - classificazione di ogni causa del rotolo, con i dati di un tag reale e di uno fuori catalogo;
  - secondo tentativo;
  - letture instabili;
  - riconoscimento dei comandi nel traffico USB; dati di stampa mai copiati nel registro;
  - registro circolare (300 voci);
  - controllo del lavoro: punti nella zona non stampabile e righe sbagliate;
  - etichetta di prova per tutti i formati del catalogo: bordo esattamente sul limite stampabile, nessun punto nella zona non stampabile;
  - testo condiviso: serie troncato e nessun testo dell'utente.

  Per i comandi alla stampante uso il driver reale della libreria con un trasporto finto, come oggi.
- **E2E (412×915)**, con la stampante simulata:
  - prova B completa e prova con il rotolo che non risponde;
  - stampa di prova con conferma e domande;
  - «Condividi» con un `navigator.share` finto, «Copia», pulsante nascosto senza supporto;
  - nessuno scorrimento orizzontale.
- **Prestazioni:** il test di digitazione esistente, con il registro attivo.
- **Da provare con l'hardware:** la stessa 550 e lo stesso rotolo 25×54. Prima la prova B, condividendo il risultato; poi la stampa di prova e le quattro domande.

## Note di implementazione (2026-11-03)

- Moduli in `src/diagnostics/`:
  - `log.ts`, `usb-trace.ts`, `hex.ts`;
  - `media-read.ts`, `job-check.ts`, `printer-check.ts`;
  - `test-label.ts`, `report.ts`.

  Inoltre `src/share.ts`, `src/app-info.ts` e `src/stores/diagnostics.ts`. Componenti: `DiagnosticsPanel.vue` (schede), `PrinterCheck.vue`, `TestPrint.vue`, `ShareActions.vue`; `UsbDiagnostics.vue` è la scheda USB.
- `PrinterPort.readMedia()` restituisce `MediaReadResult`. Il nuovo `probe()` offre `device`, `version`, `status` e `media`. La logica di un tentativo è in `readMediaWith()` (`webusb.ts`), provata con il driver reale.
- La stampa di prova passa da `printer.printJob()`, con lo stesso controllo preventivo dello stato della stampa normale. Usa il formato del rotolo se letto, altrimenti quello scelto, e il verso del documento. Prima della stampa il pannello mostra un'anteprima dell'etichetta di prova.
- Le domande dopo la stampa sono cinque:
  - bordo;
  - verso della scritta, rispetto al triangolo;
  - lato uscito per primo;
  - nitidezza;
  - tacche mancanti per lato.
- Versione dell'app: `__APP_BUILD__`, definita in `vite.config.ts` (versione del pacchetto, commit, data della build).
- Accesso ai campi privati della libreria: solo `transport` di `WebLabelWriterPrinter`. Se manca, il registro lo annota e il resto funziona come prima.
- Un'etichetta ancora vuota non conta tra i problemi della prova 550: compare solo nei dettagli.
- Pagina iniziale: 103,1 KB gzip, contro 99,6 della versione precedente. Diagnostica e etichetta di prova sono caricate solo all'apertura.
- Test:
  - unitari e nel browser: 183 in tutto, di cui 52 nuovi. Comprendono le cause del rotolo con il driver reale, il registro e il traffico USB, la prova 550 con la stampante simulata, il controllo del lavoro, il testo condiviso, la condivisione e l'etichetta di prova per tutti i formati in entrambi i versi;
  - e2e: 4 nuovi;
  - prestazioni: invariate (nessun blocco durante la digitazione).
- Il formato predefinito ora è 25×54 mm, quindi nei test di anteprima la larghezza attesa è 638 punti.
