# Etichettatrice

Web app open source per progettare e stampare etichette su una **LabelWriter 550** collegata via USB, direttamente dal browser (WebUSB). È pensata soprattutto per il telefono. Funziona solo nel browser, senza server e senza account.

> Progetto indipendente, non affiliato al produttore della stampante. La stampa si basa sulla libreria MIT [`@thermal-label/labelwriter-web`](https://github.com/thermal-label/labelwriter).

## Stato

**Versione minima (fase 1):**
- collegamento e stato della stampante;
- lettura del rotolo via NFC, con scelta manuale del formato se la lettura fallisce;
- elementi di testo (spostamento, ridimensionamento, rotazione, carattere, allineamento, bianco su nero);
- anteprima a 300 dpi in bianco e nero;
- stampa con copie e densità;
- errori in italiano.

Immagini, codici a barre e QR, modelli salvati e import/export JSON arriveranno nella fase 2 (vedi [docs/2026-11-02-app-etichette-webusb.md](docs/2026-11-02-app-etichette-webusb.md)).

La stampa sulla stampante vera **non è ancora stata provata** con questa app: vedi la [checklist](#checklist-per-la-prova-con-la-stampante-vera).

## Requisiti

- Un browser basato su Chromium con WebUSB: Vanadium, Chrome, Edge. Firefox e Safari non sono supportati.
- La pagina deve essere servita in **HTTPS**, oppure da `localhost`.
- Una LabelWriter 550 con un rotolo di etichette originali. La 550 rifiuta i rotoli senza chip NFC valido, e l'app non prova ad aggirare questo blocco.

## Sviluppo

```bash
npm install
npx playwright install chromium   # solo la prima volta, per i test
npm run dev                       # http://localhost:5173
```

Con **`?sim`** in fondo all'indirizzo (`http://localhost:5173/?sim`) l'app usa una **stampante simulata**. Un pannello permette di provocare guasti: rotolo assente o non originale, coperchio aperto, stampante occupata, timeout, scollegamento, NFC illeggibile. La simulazione esiste solo in sviluppo e nei test: `npm run build` verifica che non finisca nella build pubblicata.

| Comando | Cosa fa |
|---|---|
| `npm test` | Test unitari (Node) e test di rendering (Chromium reale) |
| `npm run test:e2e` | Test dell'interfaccia a 412×915 (Pixel 7a), con la stampante simulata |
| `npm run test:perf` | Prestazioni sulla build di produzione con CPU rallentata 4×: digitazione e apertura dell'anteprima |
| `npm run build` | Controllo dei tipi, build in `dist/` e controllo dell'assenza della simulazione |
| `npm run preview` | Serve la build in locale |

### Struttura

```
src/model/     modello dell'etichetta e geometria (mm, punti, zona non stampabile)
src/render/    scena Konva, esportazione a 300 dpi, anteprima
src/printer/   livello stampante: interfaccia PrinterPort, adapter WebUSB, adapter simulato,
               formati, conversione a 1 bit, errori in italiano, flusso di stampa
src/stores/    stato dell'app (Pinia)
src/components/ interfaccia (Vue 3)
tests/         unit (Node), browser (Chromium), e2e (Playwright)
```

Tutto il codice che usa la libreria della stampante è in `src/printer/webusb.ts` e `src/printer/media.ts`.

## Pubblicazione su GitHub Pages

1. Crea un repository su GitHub e carica il progetto sul ramo `main`.
2. Nel repository apri **Settings → Pages** e alla voce **Source** scegli **GitHub Actions**.
3. A ogni push su `main`, il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) esegue i test, fa la build e pubblica `dist/`.
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

## Diagnostica USB (anche senza LabelWriter)

Aggiungendo **`?diagnostica`** all'indirizzo (es. `https://alberico7.github.io/sexyetichette/?diagnostica`) si apre una prova che funziona con **qualsiasi dispositivo USB**, per esempio una stampante di casa. La pagina:
- verifica che telefono, cavo, impostazioni USB-C e browser permettano di vedere il dispositivo, aprirlo e prenderne il controllo;
- **non invia nessun dato**: il dispositivo non stampa e non cambia stato;
- con **«Copia risultati»** copia un testo da incollare in chat, e con **«Dimentica questo dispositivo»** revoca l'autorizzazione al termine della prova.

La stessa pagina si apre dal link «Apri la diagnostica USB» nei messaggi d'errore di collegamento.

## Checklist per la prova con la stampante vera

### Già verificato da me, senza hardware

- [x] Geometria: testina di 672 punti a 300 dpi, zona non stampabile di 6 mm (71 punti) all'inizio dell'etichetta, dimensioni del catalogo. Test unitari.
- [x] Il lavoro preparato dall'app passa nel **codice reale del driver** (0.6.4) con un trasporto USB finto. Ho controllato richiesta del lock, densità, intestazione `ESC D` con righe e punti corretti, contenuto delle righe raster, chiusura `ESC E` + `ESC Q`, copie, e il blocco della stampa con lock occupato, coperchio aperto, rotolo assente o non originale e inceppamento.
- [x] L'anteprima coincide punto per punto con il bitmap inviato, e il dithering del driver non lo altera. Test in Chromium.
- [x] Interfaccia a 412×915 senza scorrimento orizzontale. Collegamento, testo, anteprima e stampa con la stampante simulata, più i messaggi d'errore. Test Playwright.
- [x] La build di produzione non contiene la stampante simulata.

### Da provare con la stampante (non confermato)

Annota per ogni punto ✅ / ❌ e, se qualcosa non va, una foto dell'etichetta.

1. **Rilevamento su Android/GrapheneOS.** Con il telefono sbloccato, tocca *Collega*: la LabelWriter 550 compare nel selettore? Dopo la scelta, l'indicatore diventa verde «Pronta»?
2. **Accesso USB.** Compaiono errori come «Accesso USB negato»? Se sì, copia i *Dettagli tecnici*.
3. **Lettura NFC.** Il formato in alto passa da solo a quello del rotolo inserito? In *Formato etichetta* compare «Rotolo rilevato» con il codice giusto?
4. **Prima stampa.** Etichetta con un testo corto e grande al centro, 1 copia, densità Normale. Esce un'etichetta sola? Il testo è leggibile?
5. **Allineamento lungo il rotolo.** Aggiungi un testo vicino al bordo sinistro dell'area tratteggiata e uno vicino al bordo destro. Sono entrambi stampati interi? Il bordo sinistro è il primo che esce dalla stampante?
6. **Allineamento attraverso il rotolo.** Con un'etichetta stretta (es. 28×89), metti un rettangolo «bianco su nero» in alto e uno in basso. Sono stampati sull'etichetta e non fuori? Il testo è dritto o capovolto?
7. **Verso «Attraverso il rotolo».** Ripeti la prova 4 con questo verso.
8. **Copie.** Stampa 3 copie: escono 3 etichette e la stampante si ferma correttamente?
9. **Densità.** Confronta Chiara e Scura.
10. **Errori.** Apri il coperchio: compare «Coperchio aperto»? Togli il rotolo: compare «Rotolo assente»? Stacca il cavo: compare «Stampante scollegata»?
11. **Ricollegamento.** Ricarica la pagina con la stampante collegata: torna «Pronta» senza toccare *Collega*?
12. **550 Turbo** (solo se ne hai una): deve comparire «non verificata». Riporta l'esito di tutte le prove.

## Licenza

© 2026 Andrea Carletti. **MIT con [Commons Clause](https://commonsclause.com/)**: la vendita non è consentita. Vedi [LICENSE](LICENSE).
