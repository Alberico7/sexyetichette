# Rubeculabel

*Prima si chiamava Etichettatrice. Il nome viene da* Erithacus rubecula*, il pettirosso, e da* label*.*

Web app open source per progettare e stampare etichette su una **LabelWriter 550** collegata via USB, direttamente dal browser (WebUSB). È pensata soprattutto per il telefono. Funziona solo nel browser, senza server e senza account.

> Progetto indipendente, non affiliato al produttore della stampante. La stampa si basa sulla libreria MIT [`@thermal-label/labelwriter-web`](https://github.com/thermal-label/labelwriter).

## Stato

**Cosa fa oggi:**
- collegamento e stato della stampante, con ricollegamento automatico all'avvio e il pettirosso in alto che cambia colore con lo stato;
- lettura del rotolo via NFC, con scelta manuale del formato se la lettura fallisce;
- elementi di testo (spostamento, ridimensionamento, rotazione, allineamento, grassetto, corsivo, sottolineato, bianco su nero), con il carattere tecnico **ISO 3098** come predefinito e **Noto Sans** come alternativa;
- simboli: ⌀ ISO, ∅ a 45°, AFKEUR e NON RIPARABILE (N.R.) con un tocco; cuori nascosti `#<3*` → ♥ e `#<3-` → ♡;
- **dettatura** sul telefono con Vosk, senza mandare l'audio fuori: numeri in cifre, «diametro» → ∅ e «diametro ISO» → ⌀ con formato 00.00, «scarto» → AFKEUR ([documento](docs/2026-11-10-dettatura.md));
- anteprima a 300 dpi in bianco e nero, stampa rapida, copie e densità;
- etichetta salvata da sola sul telefono, elenco delle ultime 20 etichette stampate, da riaprire o ristampare;
- uso in orizzontale e tema chiaro/scuro;
- **app installabile (PWA):** schermo intero dall'icona, funziona senza rete, avviso «Aggiorna» per le versioni nuove, tasto indietro che chiude i pannelli ([documento](docs/2026-11-10-pwa.md));
- diagnostica USB e della stampante, errori in italiano.

Immagini, codici a barre e QR, modelli salvati e import/export JSON arriveranno nella fase 2 (vedi [docs/2026-11-02-app-etichette-webusb.md](docs/2026-11-02-app-etichette-webusb.md)).

Con la LabelWriter 550 vera sono stati provati il 2026-11-04 collegamento, lettura del rotolo e una prima stampa, tutti riusciti. Il 2026-11-05 la stampa di prova ha mostrato uno spostamento di 0,4–0,5 mm attraverso il rotolo, già corretto ma da riverificare. Copie, densità ed errori sono **ancora da provare**: vedi la [checklist](#checklist-per-la-prova-con-la-stampante-vera).

## Requisiti

- Un browser basato su Chromium con WebUSB: Vanadium, Chrome, Brave, Edge. Firefox e Safari non sono supportati.
- La pagina deve essere servita in **HTTPS**, oppure da `localhost`.
- Una LabelWriter 550 con un rotolo di etichette originali. La 550 rifiuta i rotoli senza chip NFC valido, e l'app non prova ad aggirare questo blocco.

## Installazione sul telefono

1. Apri l'indirizzo dell'app nel browser (Vanadium, Chrome o Brave).
2. Dal menu del browser scegli **«Aggiungi a schermata Home»** (o «Installa app»). Sotto l'icona compare «Rubeculabel».
3. Aperta dall'icona, l'app è a schermo intero e funziona anche senza rete.
4. Quando c'è una versione nuova, in alto compare **«Nuova versione disponibile — Aggiorna»**.

Se avevi già l'icona di prima (con la barra del browser), toglila e aggiungila di nuovo.

**Dettatura su Vanadium:** per sicurezza Vanadium tiene spento il compilatore JavaScript (JIT), e senza JIT il riconoscimento è lentissimo (sul Pixel 7a: 9–27 s dopo aver lasciato il pulsante invece di 0,1 s). Attivalo solo per questo sito: lucchetto accanto all'indirizzo → *Impostazioni sito* → **JavaScript JIT**. Se il riconoscimento è lento, l'app lo ricorda da sola. La prima volta la dettatura scarica il modello italiano (circa 50 MB), che poi resta nel telefono.

## Sviluppo

```bash
npm install
npx playwright install chromium   # solo la prima volta, per i test
npm run dev                       # http://localhost:5173
```

Con **`?sim`** in fondo all'indirizzo (`http://localhost:5173/?sim`) l'app usa una **stampante simulata**. Un pannello permette di provocare guasti: rotolo assente o non originale, coperchio aperto, stampante occupata, timeout, scollegamento, NFC illeggibile. Con `?sim` sono simulati anche la dettatura e l'avviso di aggiornamento: i test e2e li pilotano dall'oggetto `window.__sim` (vedi [src/sim.ts](src/sim.ts)). La simulazione esiste solo in sviluppo e nei test: `npm run build` verifica che `__sim` e le classi simulate non finiscano nella build pubblicata.

| Comando | Cosa fa |
|---|---|
| `npm test` | Test unitari (Node) e test di rendering (Chromium reale) |
| `npm run test:e2e` | Test dell'interfaccia a 412×915 (Pixel 7a), con la stampante simulata |
| `npm run test:perf` | Prestazioni sulla build di produzione con CPU rallentata 4×: digitazione e apertura dell'anteprima |
| `npm run test:pwa` | App installabile sulla build di produzione: service worker, funzionamento senza rete, manifest |
| `npm run lint` | ESLint su `src` e `tests` |
| `npm run format` / `format:check` | Prettier: formatta / controlla |
| `npm run build` | Controllo dei tipi, build in `dist/` e controllo dell'assenza della simulazione |
| `npm run preview` | Serve la build in locale |

### Struttura

```
src/model/       modello dell'etichetta e geometria (mm, punti, zona non stampabile), testi e simboli
src/render/      scena Konva, esportazione a 300 dpi, anteprima, caratteri
src/printer/     livello stampante: interfaccia PrinterPort, adapter WebUSB, adapter simulato,
                 formati, conversione a 1 bit, errori in italiano, flusso di stampa, copie
src/stores/      stato dell'app (Pinia)
src/composables/ stampa rapida, rotolo letto, avvio in sottofondo, messaggi brevi
src/components/  interfaccia (Vue 3)
src/voice/       dettatura: Vosk, microfono, modello (scaricamento e conservazione), parole → testo
src/pwa/         service worker e aggiornamenti, tasto indietro
src/diagnostics/ registro degli eventi, prove della stampante, stampa di prova, rapporto
src/storage/     etichetta corrente e recenti salvate sul telefono
src/sim.ts       interruttore della simulazione (solo sviluppo e test)
scripts/         mini-font dei simboli, controllo che la build non contenga la simulazione
tests/           unit (Node), browser (Chromium), e2e e pwa (Playwright), perf
```

Tutto il codice che usa la libreria della stampante è in `src/printer/webusb.ts` e `src/printer/media.ts`.

## Pubblicazione su GitHub Pages

1. Crea un repository su GitHub e carica il progetto sul ramo `main`.
2. Nel repository apri **Settings → Pages** e alla voce **Source** scegli **GitHub Actions**.
3. A ogni push su `main`, il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) esegue lint, controllo della formattazione, test vitest, test e2e e test della PWA con Playwright: se uno fallisce non pubblica. Poi fa la build e pubblica `dist/`. Il test di prestazioni gira anche lì ma è solo informativo, perché i tempi dei server di GitHub non sono confrontabili con quelli di un telefono; le sue soglie si verificano in locale con `npm run test:perf`.
4. L'app sarà disponibile su `https://<utente>.github.io/<repository>/`. È in HTTPS, quindi WebUSB funziona. I percorsi sono relativi, quindi non serve configurare il nome del repository.

Va bene anche qualunque altro hosting statico in HTTPS: basta caricare il contenuto di `dist/`.

## Prova sul Pixel 7a (GrapheneOS + Vanadium)

**Modo più semplice:** pubblica su GitHub Pages e apri l'indirizzo in Vanadium.

**Senza pubblicare, dal computer di sviluppo:** la porta USB del telefono serve alla stampante, quindi si usa il *debug wireless* di Android.
1. Sul telefono attiva le *Opzioni sviluppatore* e il *Debug wireless*. Associa il computer con `adb pair <ip>:<porta>` e poi collegalo con `adb connect <ip>:<porta>`.
2. Sul computer avvia `npm run dev` ed esegui `adb reverse tcp:5173 tcp:5173`.
3. Sul telefono apri `http://localhost:5173` in Vanadium. Per il browser è `localhost`, quindi un contesto sicuro.
4. Collega la stampante al telefono con un cavo adatto: USB-C ↔ USB-B, oppure un adattatore OTG.

L'indirizzo di rete locale (`http://192.168.x.x:5173`) **non** funziona per WebUSB, perché non è HTTPS.

**Collegamento della stampante:**
- Collega la stampante con il telefono **sbloccato**.
- Se la stampante non compare nel selettore, controlla in GrapheneOS l'impostazione della **porta USB-C** (impostazioni di sicurezza): non deve essere limitata alla sola ricarica.
- Tocca **Collega** e scegli la stampante dall'elenco. Al successivo avvio l'app prova a ricollegarsi da sola.

## Diagnostica

Si apre aggiungendo **`?diagnostica`** all'indirizzo (es. `https://alberico7.github.io/sexyetichette/?diagnostica`), dal pulsante **«Diagnostica»** in *Formato etichetta* (con la stampante collegata) o dal link nei messaggi d'errore di collegamento. Ha tre schede:

- **USB**: prova con **qualsiasi dispositivo USB**, per esempio una stampante di casa. Verifica che telefono, cavo, impostazioni USB-C e browser permettano di vedere il dispositivo, aprirlo e prenderne il controllo, e mostra gli endpoint. **Non invia nessun dato.** «Dimentica questo dispositivo» revoca l'autorizzazione al termine.
- **LabelWriter 550**: prova della stampante collegata con **soli comandi di lettura**:
  - versione (`ESC V`);
  - stato (`ESC A`) e dati del rotolo (`ESC U`), ciascuno letto tre volte, con byte grezzi e tempi;
  - tutti i campi del tag NFC confrontati con il catalogo;
  - geometria del formato;
  - controllo del lavoro di stampa dell'etichetta attuale **senza inviarlo**.

  In cima c'è un riepilogo con i problemi in ordine di gravità.
- **Stampa di prova**: su richiesta e dopo una conferma, stampa **una** etichetta con bordo sul limite stampabile, tacche ogni millimetro, «ALTO», angoli numerati e un triangolo sul lato che dovrebbe uscire per primo. Poi chiede come è uscita.

**«Copia tutto» / «Condividi»** raccolgono in un unico testo:
- riepilogo;
- prove;
- risposte sulla stampa di prova;
- **registro degli eventi** della sessione: collegamento, errori con il messaggio originale e traffico USB con la stampante.

Il registro sta solo in memoria. Il testo non contiene dati personali: il numero di serie è troncato e i testi delle etichette sono esclusi. Se il rotolo non si legge, *Formato etichetta* mostra la causa precisa e i byte ricevuti, con «Copia dettagli» e «Condividi».

## Checklist per la prova con la stampante vera

### Già verificato da me, senza hardware

- [x] Geometria: testina di 672 punti a 300 dpi, zona non stampabile di 6 mm (71 punti) all'inizio dell'etichetta, dimensioni del catalogo. Test unitari.
- [x] Il lavoro preparato dall'app passa nel **codice reale del driver** (0.6.4) con un trasporto USB finto. Ho controllato richiesta del lock, densità, intestazione `ESC D` con righe e punti corretti, contenuto delle righe raster, chiusura `ESC E` + `ESC Q`, copie, e il blocco della stampa con lock occupato, coperchio aperto, rotolo assente o non originale e inceppamento.
- [x] L'anteprima coincide punto per punto con il bitmap inviato, e il dithering del driver non lo altera. Test in Chromium.
- [x] Interfaccia a 412×915 senza scorrimento orizzontale. Collegamento, testo, anteprima e stampa con la stampante simulata, più i messaggi d'errore. Test Playwright.
- [x] La build di produzione non contiene la stampante simulata.

### Verificato sull'hardware dall'utente

- [x] **2026-11-03 – WebUSB su Pixel 7a con GrapheneOS e Vanadium**, provato con la diagnostica USB e una stampante HP a getto d'inchiostro. Il selettore mostra il dispositivo, Android concede il permesso, il browser apre la stampante e prende il controllo dell'interfaccia di tipo **stampante**, la stessa classe della LabelWriter 550. Porta USB-C e cavo/adattatore funzionano come host USB.
  Questa prova **non** verifica il protocollo della 550: comandi, lock di stampa e lettura NFC.
- [x] **2026-11-03 – Condivisione dei risultati della diagnostica** su Pixel 7a con Vanadium: «Condividi» apre il menu di Android e il testo arriva completo all'app scelta. Prova fatta con la stampante HP.
- [x] **2026-11-04 – LabelWriter 550 reale su Pixel 7a con Vanadium:**
  - collegamento e collegamento automatico all'avvio;
  - stato letto: pronta, rotolo presente;
  - **lettura NFC del rotolo** al primo tentativo: il tag di un rotolo originale 25×54 contiene il codice europeo `S0722520`, larghezza 25,4 mm e lunghezza 54,0 mm;
  - **prima stampa** di un'etichetta con testo: ne esce una sola, con il contenuto intero e centrato.

- [x] **2026-11-05 – Prova *LabelWriter 550* e *Stampa di prova*:**
  - prova *LabelWriter 550* senza problemi;
  - firmware 0002.0020, hardware LW550B_PPB_00002;
  - l'avviso della libreria «read filled exactly 64 bytes» è **innocuo**: 6 letture del rotolo sono identiche byte per byte e le risposte di stato successive non sono sfasate;
  - stampa di prova corretta per verso, lato che esce per primo, zona iniziale di 6 mm, tacche lungo l'etichetta e nitidezza;
  - **contenuto spostato di 0,4–0,5 mm** attraverso il rotolo, misurato con il calibro. Il catalogo dà il rotolo largo 25 mm, il chip 25,4 mm, e la stampante allinea l'immagine al bordo basso. **Corretto:** l'app usa la larghezza letta dal chip e lascia un margine di sicurezza di 0,5 mm sui bordi lunghi ([documento](docs/2026-11-05-margine-bordo-testina.md));
  - l'avviso «codice interno 0x3832» della diagnostica era un falso allarme: la 550 scrive il codice «28» come testo. Corretto.

  Resta da rifare la *Stampa di prova* dopo la correzione, più i punti qui sotto.

- [x] **2026-11-10 – Dettatura nell'app** su Pixel 7a con Vanadium (con il JIT attivo per il sito): funziona. Ricollegamento automatico all'avvio confermato di nuovo.

### Da provare con la stampante (non confermato)

Annota per ogni punto ✅ / ❌ e, se qualcosa non va, una foto dell'etichetta.

1. ✅ 2026-11-04 – **Rilevamento su Android/GrapheneOS.** Con il telefono sbloccato, tocca *Collega*: la LabelWriter 550 compare nel selettore? Dopo la scelta, l'indicatore diventa verde «Pronta»?
2. **Accesso USB.** Compaiono errori come «Accesso USB negato»? Se sì, copia i *Dettagli tecnici*.
3. **Lettura NFC.** Il formato in alto passa da solo a quello del rotolo inserito? In *Formato etichetta* compare «Rotolo rilevato» con il codice giusto? Se no, apri *Diagnostica → LabelWriter 550*, avvia la prova e condividi il risultato con «Condividi».
   - 2026-11-03, prima prova con la 550 reale: collegamento e stato ok, **rotolo 25×54 non letto**. La causa non è nota: la diagnostica non esisteva ancora.
   - ✅ 2026-11-04: rotolo letto e riconosciuto (S0722520 → Multiuso piccola 25×54).
   - ✅ 2026-11-05: nessun byte resta in coda dopo la lettura, verificato con la prova *LabelWriter 550*.
4. **Stampa di prova.** In *Diagnostica → Stampa di prova* stampa l'etichetta di prova, rispondi alle domande e condividi «Tutti i risultati». Questa prova da sola verifica verso, zona non stampabile e allineamento.
   - ✅ 2026-11-05: verso, zona iniziale e tacche corretti; contenuto spostato di 0,4–0,5 mm attraverso il rotolo, corretto.
   - **Da rifare dopo la correzione:** il bordo esterno deve stare a 0,5 mm da entrambi i bordi lunghi, da misurare con il calibro, e nessuna tacca deve essere tagliata. Indica anche se si vede la linea sottile sul bordo esatto: se esce intera, il margine di sicurezza si può ridurre.
5. ✅ 2026-11-04 – **Prima stampa.** Etichetta con un testo corto e grande al centro, 1 copia, densità Normale. Esce un'etichetta sola? Il testo è leggibile?
6. **Allineamento lungo il rotolo.** Aggiungi un testo vicino al bordo sinistro dell'area tratteggiata e uno vicino al bordo destro. Sono entrambi stampati interi? Il bordo sinistro è il primo che esce dalla stampante?
7. **Allineamento attraverso il rotolo.** Con un'etichetta stretta (es. 28×89), metti un rettangolo «bianco su nero» in alto e uno in basso. Sono stampati sull'etichetta e non fuori? Il testo è dritto o capovolto?
8. **Verso «Attraverso il rotolo».** Ripeti la prova 5 con questo verso.
9. **Copie.** Il 2026-11-06, con 7 copie, la 550 ha stampato 1 etichetta e poi è andata in errore. Causa probabile: la libreria aspetta la risposta di stato fra un'etichetta e l'altra prima di spedire la successiva, mentre il driver ufficiale DYMO la legge dopo. Ora le copie usano l'ordine DYMO ([docs/2026-11-06-copie-multiple-550.md](docs/2026-11-06-copie-multiple-550.md)). **Da rifare:**
   - 2 e poi 5 copie: escono tutte, nessun lampeggio, il contatore del rotolo scende di 2 e poi di 5;
   - 10 copie con «Ferma» dopo 2 o 3.

   Se fallisce: incollare il testo di «Copia tutto», poi passare a `MULTI_COPY_MODE = 'one-by-one'` in `src/printer/copies.ts`.
10. **Densità.** Confronta Chiara e Scura.
11. **Errori.** Apri il coperchio: compare «Coperchio aperto»? Togli il rotolo: compare «Rotolo assente»? Stacca il cavo: compare «Stampante scollegata»?
12. ✅ 2026-11-04 – **Ricollegamento.** Ricarica la pagina con la stampante collegata: torna «Pronta» senza toccare *Collega*?
13. **550 Turbo** (solo se ne hai una): deve comparire «non verificata». Riporta l'esito di tutte le prove.

## Licenza

© 2026 Andrea Carletti. **MIT con [Commons Clause](https://commonsclause.com/)**: la vendita non è consentita. Vedi [LICENSE](LICENSE).

Il carattere «Tecnico ISO 3098» è [osifont](https://github.com/hikikomori82/osifont), distribuito sotto GNU LGPL 3 con *font exception*. È incluso senza modifiche, con la licenza in [public/licenses/osifont](public/licenses/osifont). Le etichette stampate con questo carattere non hanno vincoli di licenza.

Il carattere «Noto Sans (simile a Segoe UI)» è [Noto Sans](https://github.com/notofonts/latin-greek-cyrillic), distribuito sotto SIL Open Font License 1.1. È incluso senza modifiche (sottoinsieme latino di [Fontsource](https://fontsource.org/fonts/noto-sans)), con la licenza in [public/licenses/noto-sans](public/licenses/noto-sans).

La dettatura usa la libreria [vosk-browser](https://github.com/ccoreilly/vosk-browser) (Apache 2.0), inclusa nel sito, e il modello italiano [vosk-model-small-it-0.22](https://alphacephei.com/vosk/models) (Apache 2.0), che **non** è incluso: il telefono lo scarica al primo uso da una copia su Hugging Face, controllando che sia identico all'originale.
