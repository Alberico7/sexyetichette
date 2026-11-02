# Web app per etichette su LabelWriter 550 via WebUSB

- Data: 2026-11-02
- Stato: **confermato il 2026-11-02; fase 1 (versione minima) implementata**. Vedi «Note di implementazione» in fondo.
- Nome dell'app: **Etichettatrice** (generico, senza riferimenti a DYMO o DYMO Connect)

## 1. Obiettivo

Una web app statica e open source, con interfaccia in italiano, per progettare e stampare etichette su una LabelWriter 550 collegata via USB. Si usa soprattutto da telefono: Pixel 7a con GrapheneOS e Vanadium. Non usa codice, nomi o grafica di DYMO Connect. Il nome "DYMO" compare solo dove serve a descrivere la compatibilità, per esempio "etichette DYMO originali".

## 2. Cosa ho verificato nella libreria (v0.6.4, installata e letta)

Ho controllato i `.d.ts`, i sorgenti in `labelwriter-core/src` e `labelwriter-web/dist/printer.js`, il file `data/devices.json` e le pagine `/web` e `/protocol/lw5-raster`. La pagina demo non l'ho letta.

| Cosa | Esito |
|---|---|
| `requestPrinters({ transport: 'usb' })` | Confermato. `ConnectOptions = { transport: 'usb'; deviceKey?: string }`, e restituisce `PrinterAdapterMap = Record<ruolo, PrinterAdapter>`. Sulla 550 c'è una sola chiave, `primary`. Se VID/PID non sono riconosciuti lancia `DeviceIdentificationRequiredError`. |
| `requestPrinter()` deprecata | Confermato. Anche `fromUSBDevice` e `fromUSBDeviceAll` sono deprecate. Problema: l'API nuova apre **sempre** il selettore e non offre un modo per riconnettersi a un dispositivo già autorizzato (`navigator.usb.getDevices()`). Vedi il §7. |
| `print(image, media?, options?)` | Confermato. `image` è `RawImageData { width, height, data }` in RGBA. Le opzioni (`LabelWriterPrintOptions`) sono `copies`, `density: 'light' \| 'medium' \| 'normal' \| 'high'` (sulla 550 diventa 70/85/100/130 %), `speed: 'normal' \| 'high'`, `rotate: 'auto' \| 0 \| 90 \| 180 \| 270` e `labelLengthDots`. |
| Lock e handshake sulla 550 | Confermato. `print()` acquisisce il lock (`ESC A 1`) e, se la stampante segnala errori, si interrompe prima di inviare dati. Il lavoro va a segmenti con handshake `ESC A` dopo ogni etichetta, con timeout di 15 s per handshake e 2 s per la lettura dello stato. Tutte le operazioni USB passano da un serializzatore, quindi il polling non si inserisce nel mezzo di una stampa. |
| `getMedia()` e `skuInfoToMedia()` | Confermati. `getMedia()` legge 63 byte dal tag NFC (`ESC U`). **Limite:** `skuInfoToMedia()` restituisce larghezza e lunghezza in mm ma non `lengthDots`, quindi il driver non imposta da solo `labelLengthDots` per i formati letti via NFC. Lo calcolerò io. |
| `getPrintableCanvasDots(engine, media)` | Confermato. Sulla 550 la testina è da 672 punti a 300 dpi e c'è una zona morta iniziale di 6 mm (71 punti) nel senso di avanzamento. Ai lati non c'è zona morta. |
| Dithering e rotazione | Confermati. `renderImage(image, { dither: true, rotate })` usa `pickRotation` come rotazione automatica, e `renderImage` è esportato da `labelwriter-core`. |
| Stato ed errori | `getStatus()` restituisce `{ ready, mediaLoaded, errors: { code, message }[], details }`. I codici 550 sono `cover_open`, `no_media`, `low_media`, `paper_jam`, `counterfeit_media`, `overheated`, `low_voltage`, `printer_error` e `not_ready`. `onStatus` interroga lo stato ogni 4 s. |
| PID | Confermati: 550 = `0x0028` (verified), 550 Turbo = `0x0029` (expected), VID `0x0922`. |

Altre cose da sapere:

- Il README del pacchetto web è superato: cita `printText` e `printImage`, che la classe non ha. Mi baso sui tipi.
- Lock occupato e stampante con errore arrivano come `Error` generici. Per tradurli in italiano devo riconoscerli dal testo del messaggio. È fragile, quindi lo isolo in un solo modulo coperto da test.
- `labelwriter-web` dichiara `typescript` come peer dependency, e npm ha installato TypeScript 7. `labelwriter-core` pubblica i tipi come sorgenti `.ts`. Da verificare che il nostro type-check li accetti.
- **Allineamento orizzontale non documentato.** L'encoder allinea la bitmap al punto 0 della testina e riempie il resto a destra. Dove cade fisicamente un'etichetta più stretta di 57 mm (per esempio la 89×28, larga 28 mm) va provato sull'hardware. Per questo prevedo una **calibrazione di offset X/Y** nelle impostazioni.
- Il registro dichiara che sulla 550 la lunghezza letta dal tag NFC prevale su quella inviata. L'app avviserà se il formato scelto a mano non corrisponde a quello rilevato.

## 3. Progetti open source esistenti (ricerca del 2026-11-02)

| Progetto | Cos'è | Utilità per noi |
|---|---|---|
| **[burnmark-io/label-maker](https://github.com/burnmark-io/label-maker)** (burnmark.app), MIT | Editor di etichette in Vue 3 + Konva che stampa via WebUSB con i driver `@thermal-label`, dello **stesso autore** del driver. Supporta testo, immagini, codici a barre e QR, forme, CSV ed Excel, PDF, fogli A4, PWA, archivio in IndexedDB e vue-i18n. | È il progetto più vicino. La [issue #1 del driver](https://github.com/thermal-label/labelwriter/issues/1) documenta la prima stampa riuscita su una **LabelWriter 550 reale tramite quest'app**, su macOS con Chrome. Il percorso di stampa sulla 550 è quindi stato provato almeno una volta. Però è pensata per desktop e per più famiglie di stampanti, con un perimetro molto più ampio del nostro, e la UI per telefono non è documentata. |
| **[burnmark-io/designer-core](https://github.com/burnmark-io/designer-core)**, MIT, v0.5.1 | Motore di impaginazione headless (modello e render verso bitmap 1 bpp). Usa bwip-js, jspdf, papaparse e jszip. | Potrebbe fare da renderer, ma è in fase iniziale (nessuna release su GitHub, ultimo aggiornamento a maggio 2026) e porta dipendenze che non ci servono. **Non lo uso come dipendenza.** Lo consulto come riferimento. |
| [thermal-label/harness](https://github.com/thermal-label) | Banco di prova dei driver, usato nella issue #1. | Riferimento per il flusso di collegamento e stato. |
| [CatLabel](https://github.com/lukaszliniewicz/catlabel), Apache-2.0 | Editor React con backend FastAPI per stampanti Bluetooth (Niimbot, Phomemo). | Serve un backend e non supporta la 550. Non è utile. |
| [ZebraPrintLab](https://github.com/u8array/ZebraPrintLab) e altri | Editor ZPL per Zebra. | Fuori ambito. |
| [Labelle](https://alternativeto.net/software/labelle/about) | App desktop in Python/Qt per DYMO LabelManager. | Fuori ambito. |

Non ho trovato altre web app per LabelWriter 550 basate su WebUSB. Non ho trovato nessuna segnalazione su Android: tutte le prove documentate sono state fatte su desktop.

**Decisione: costruisco un'app nostra, mobile-first, invece di fare un fork di burnmark.**
- Il fork darebbe un percorso di stampa già provato, ma porterebbe con sé Brother, LabelManager, CSV, Excel (`xlsx` 0.18.5 ha vulnerabilità note), PDF e fogli A4.
- La UI andrebbe comunque rifatta per l'uso a una mano su telefono, e la separazione dei livelli e l'adapter simulato richiesti andrebbero ricavati da un codice di circa 185 commit che non conosco.
- Scelgo **lo stesso stack di burnmark** (Vue 3 + Konva), così posso consultare e, dove serve, riprendere con attribuzione MIT le parti già provate sulla 550 (collegamento, scelta del formato, dimensionamento del canvas).

## 4. Stack scelto (criterio: meno problemi)

| Area | Scelta | Motivo |
|---|---|---|
| Linguaggio | **TypeScript**, non Rust | La libreria e le API del browser sono in JS. Rust/WASM aggiungerebbe solo complessità. |
| Build | **Vite** | Produce un sito statico pronto per GitHub Pages, e `localhost` è già un contesto sicuro per WebUSB. |
| UI | **Vue 3 + Pinia** | È lo stesso stack di burnmark, quindi posso riusarne le idee e il codice. È maturo, ha binding Konva ufficiali, ed è leggero a sufficienza per un telefono. |
| Editor e rendering | **Konva** (usato direttamente, senza `vue-konva`) | Il `Transformer` di Konva gestisce già spostamento, ridimensionamento e rotazione con il touch: è la parte più facile da sbagliare se la scrivo da zero. La stessa scena viene esportata a 300 dpi per anteprima e stampa (`toCanvas({ pixelRatio })`), quindi editor e stampa hanno un solo percorso di rendering. |
| Codici a barre e QR | **bwip-js** (MIT) | È usato anche da designer-core. Disegna su canvas e copre Code128, EAN-13, UPC-A, Code39, QR, DataMatrix e altri. |
| Dithering e anteprima | `renderImage` di `@thermal-label/labelwriter-core` | È la stessa funzione che usa il driver. |
| Font | Pochi font OFL inclusi nel progetto (Inter, Roboto Condensed, Roboto Mono, Noto Serif) | Li carico con `document.fonts.load` prima del rendering. Sono identici su ogni dispositivo e funzionano offline. |
| Archiviazione | **IndexedDB** tramite `idb` | Le immagini incorporate superano il limite di localStorage. |
| Testi UI | Testi italiani nei componenti; messaggi d'errore centralizzati in `printer/errors.ts` | C'è una sola lingua: nessuna libreria di traduzione. |
| Test | **Vitest** in Node per modello, formati, errori e flusso di stampa simulato. **Vitest browser mode + Playwright (Chromium)** per il rendering su canvas reale. **Playwright** per il layout a 412×915. | Chromium è lo stesso motore di Vanadium. |
| PWA | **Sì**, con `vite-plugin-pwa` e aggiornamento su conferma | Permette di usare l'app offline vicino alla stampante e di installarla sulla schermata home. Va in fase 3. |
| Versioni | Versioni **esatte** (senza `^`) per `@thermal-label/*` | Riconosco alcuni errori dal testo del messaggio. |
| Licenza | **MIT** | |
| Nome | **Etichettatrice** | |

## 5. Architettura

```
src/
  model/        # modello dell'etichetta: tipi, default, validazione, (de)serializzazione JSON con versione
  render/       # modello → nodi Konva; export a 300 dpi; nessun riferimento a USB o a Vue
  printer/      # livello stampante dietro un'interfaccia piccola
    types.ts        # interfaccia PrinterPort + tipi di stato ed errore dell'app
    webusb.ts       # implementazione reale su @thermal-label/labelwriter-web
    simulated.ts    # adapter simulato (solo dev/test)
    errors.ts       # mappa degli errori di libreria e browser → messaggi in italiano
    media.ts        # catalogo formati per la 550, calcolo dei punti, SKU NFC → formato
    raster.ts       # orientamento e rotazione verso il senso della testina, dithering per l'anteprima
  storage/      # modelli, etichette recenti, import ed export JSON
  stores/       # store Pinia: documento (con annulla/ripeti), stampante, impostazioni
  ui/           # componenti Vue: barra stampante, editor (Konva + Transformer), pannelli proprietà, anteprima, dialog
```

### 5.1 Interfaccia della stampante (`PrinterPort`)

```ts
interface PrinterPort {
  readonly kind: 'webusb' | 'simulated';
  connect(): Promise<PrinterInfo>;          // va chiamata da un gesto dell'utente
  disconnect(): Promise<void>;
  getStatus(): Promise<AppPrinterStatus>;
  onStatus(cb: (s: AppPrinterStatus) => void): () => void;
  readMedia(): Promise<DetectedMedia | null>; // NFC; null se la lettura non riesce
  print(job: PrintJob): Promise<void>;        // bitmap già orientata e dimensionata
  recover(): Promise<void>;
}
```

L'interfaccia utente conosce solo `PrinterPort` e tipi propri dell'app. I tipi di `@thermal-label` restano dentro `printer/webusb.ts` e `printer/media.ts`.

### 5.2 Adapter simulato

- Si carica con un `import()` dinamico protetto da `import.meta.env.DEV || import.meta.env.MODE === 'test'`. Vite lo elimina dalla build di produzione, e un test della build verifica che non ci sia.
- Si attiva con `?sim=1` oppure con un interruttore nella barra di sviluppo.
- Permette di scegliere il rotolo simulato, ritardi e guasti: rotolo assente, non originale, coperchio aperto, lock occupato, timeout e disconnessione.
- Registra i lavori ricevuti (bitmap, opzioni, copie) e li mostra all'utente e ai test.

### 5.3 Pipeline di rendering e stampa

1. **Modello.** Le coordinate sono in mm, nel verso di lettura dell'etichetta. L'utente sceglie l'orientamento di lettura: orizzontale o verticale.
2. **Area stampabile.** Larghezza = larghezza del formato in punti a 300 dpi. Lunghezza = lunghezza del formato in punti meno la zona morta di 71 punti (`getPrintableCanvasDots`). I formati continui hanno una lunghezza scelta dall'utente.
3. **Rendering.** `render/` costruisce la scena Konva dal modello. L'editor la mostra alla scala dello schermo. Per anteprima e stampa la stessa scena viene esportata a 300 dpi, senza maniglie né guide, in un canvas RGBA nel verso di lettura. Prima dell'export si attende il caricamento dei font e delle immagini.
4. **Orientamento.** Ruoto io la bitmap nel senso della testina, applico gli offset di calibrazione e passo `rotate: 0` e `labelLengthDots` espliciti. In questo modo la rotazione non dipende dall'euristica `pickRotation` e l'anteprima corrisponde esattamente a ciò che viene inviato.
5. **Anteprima.** Applico `renderImage(..., { dither: true })` di `labelwriter-core`, la stessa funzione che usa il driver, quindi ottengo la stessa bitmap a 1 bit. La mostro alla risoluzione reale, con zoom 1:1 e possibilità di ingrandire, sopra il contorno dell'etichetta e della zona morta.
6. **Stampa.** Chiamo `PrinterPort.print({ image, media, copies, density })`. Prima controllo lo stato: rotolo presente e corrispondenza tra formato scelto e formato rilevato.

### 5.4 Elementi dell'editor

- **Testo:** contenuto su più righe, font, dimensione, grassetto e corsivo, allineamento orizzontale e verticale, adattamento automatico al riquadro, inversione bianco su nero.
- **Immagine:** caricata dalla galleria o dalla fotocamera, con soglia o dithering e inversione. Viene salvata come data URL ridimensionata a 300 dpi.
- **Codice a barre:** tipo, dati, testo leggibile sì/no e validazione con messaggio in italiano.
- **QR:** dati e livello di correzione.
- **Forme semplici:** linea e rettangolo. Le aggiungo perché costano poco e sono utili per i bordi.
- **Operazioni comuni:** spostamento, ridimensionamento con maniglie, rotazione libera e a scatti di 90°, livelli (avanti e indietro), duplicazione, eliminazione, annulla e ripeti, aggancio alla griglia e al centro.

### 5.5 Interfaccia su telefono (circa 412×915 CSS px)

- Barra in alto: stato della stampante (pallino colorato e testo) e pulsante **Collega**.
- Al centro: area dell'etichetta, adattata alla larghezza dello schermo, con pinch-zoom solo sull'area.
- In basso, nella zona del pollice: barra con **Aggiungi** (testo, immagine, codice, QR), **Proprietà**, **Anteprima** e **Stampa**.
- Le proprietà si aprono in un pannello che sale dal basso. I bersagli touch misurano almeno 44 px. Nessuno scorrimento orizzontale, e uso `env(safe-area-inset-*)`.

### 5.6 Rotolo e formati

- Al collegamento chiamo `readMedia()`. Cerco lo SKU letto dal tag NFC nel catalogo della libreria, filtrato per i formati della 550 (`targetModels` contiene `lw`). Se lo trovo uso quella voce, che include `lengthDots`. Altrimenti uso le misure del tag.
- Se la lettura fallisce o non c'è stampante, compare un elenco di formati con ricerca per SKU o misura, più una voce "Personalizzato".

### 5.7 Archiviazione

- Ogni documento ha questa forma: `{ format: 'etichetta', version: 1, id, nome, media, orientamento, elementi[], creato, modificato }`.
- **Modelli:** salvataggio con nome. **Recenti:** le ultime 20 etichette stampate, salvate in automatico.
- Esportazione in JSON (una singola etichetta o tutto) con download del file. Importazione con validazione di schema e versione e messaggi d'errore in italiano.

### 5.8 Errori (in italiano)

| Situazione | Come la riconosco |
|---|---|
| Browser senza WebUSB | `!('usb' in navigator)` oppure contesto non sicuro |
| Selettore chiuso o nessun dispositivo | `NotFoundError` dal selettore. Il messaggio suggerisce di sbloccare il telefono e controllare in GrapheneOS l'impostazione della porta USB-C (il percorso esatto del menu è da verificare sul telefono). |
| Accesso USB negato | `SecurityError` / `NetworkError` all'apertura o al claim (interfaccia già in uso) |
| Dispositivo non riconosciuto | `DeviceIdentificationRequiredError`, oppure un PID diverso da 0x0028. Per la Turbo compare l'avviso "modello non verificato". |
| Rotolo assente, non inserito bene o esaurito | `errors[].code === 'no_media'` |
| Rotolo non valido o non originale | `counterfeit_media` |
| Coperchio aperto, inceppamento, surriscaldamento, tensione bassa | codici corrispondenti |
| Stampante occupata | il messaggio "Print lock … held by another host" |
| Timeout | `TransportTimeoutError` |
| Disconnessione | `TransportClosedError` e l'evento `navigator.usb` `disconnect` |
| Errore generico | messaggio italiano con i dettagli tecnici in una sezione richiudibile |

Dopo un errore durante la stampa propongo "Ripristina stampante" (`recover()`).

## 6. Fasi

1. **Versione minima:** scheletro Vite, Vue 3 e Konva, `PrinterPort` con implementazione WebUSB e simulata, collegamento e stato, un solo elemento di testo, scelta manuale del formato, anteprima e stampa con copie e densità, prima suite di test.
2. **Funzioni complete:** rilevamento NFC, editor completo (immagini, codici a barre, QR, rotazione, font, allineamento), annulla e ripeti, modelli e recenti, import ed export, tutti gli errori, calibrazione degli offset.
3. **Rifinitura:** PWA, controllo del layout con Playwright a 412×915, README con pubblicazione su GitHub Pages (GitHub Action) e prova sul Pixel tramite `adb reverse` su localhost oppure tramite Pages, checklist per l'hardware.

## 7. Rischi e punti aperti

- **Riconnessione senza selettore:** l'API nuova non accetta un `USBDevice` già autorizzato. Propongo di usare comunque il selettore a ogni collegamento. Su Android è un tocco in più. Se diventa scomodo, si può usare la funzione deprecata `fromUSBDeviceAll` dietro l'interfaccia.
- **Allineamento e zona morta:** da verificare sull'hardware, con gli offset di calibrazione come rimedio.
- **Android / GrapheneOS / Vanadium:** su Android WebUSB esiste, ma il claim dell'interfaccia stampante non è confermato.
- **Lettura NFC reale:** non confermata finché non si prova un rotolo vero.
- **Messaggi di errore della libreria riconosciuti dal testo:** potrebbero cambiare tra versioni. Fisso la versione esatta, `0.6.4`.

## 8. Verifica finale prevista

Test unitari e di rendering, test del flusso di stampa con l'adapter simulato, build di produzione senza l'adapter simulato e controllo del layout a 412×915. La stampa reale **non** sarà dichiarata funzionante: preparerò una checklist per l'hardware, divisa in "verificato da me" e "da provare".

## 9. Note di implementazione (fase 1, 2026-11-02)

Cosa è cambiato rispetto al piano:

- **Konva senza `vue-konva`.** L'editor costruisce i nodi con la stessa funzione usata per la stampa (`render/scene.ts`). C'è un solo percorso di rendering e una dipendenza in meno.
- **Testi UI.** Non c'è un modulo `i18n/it.ts`: i testi sono nei componenti, gli errori in `printer/errors.ts`.
- **Conversione a 1 bit.** La fa l'app con soglia 128 (`printer/raster.ts`). Il driver riceve solo pixel bianchi o neri, quindi il suo dithering non li cambia (verificato da un test). L'anteprima è quel bitmap esatto.
- **Rotazione.** La rotazione verso la testina la calcola l'app (90° per il verso «lungo il rotolo», 0° per «attraverso»). Al driver arriva `rotate: 0`.
- **Zona non stampabile.** Nel verso «lungo il rotolo» la zona iniziale di 6 mm sta a **sinistra** dell'etichetta. Il bordo inferiore dell'etichetta corrisponde al punto 0 della testina. È dedotto dal codice della libreria e va confermato sull'hardware (checklist nel README).
- **Riconnessione automatica.** All'avvio l'app usa `fromUSBDeviceAll` (deprecata) sui dispositivi già autorizzati. Il collegamento manuale usa `requestPrinters({ transport: 'usb' })`.
- **Test con il driver reale.** `tests/unit/real-driver.test.ts` fa passare il lavoro nel `WebLabelWriterPrinter` della libreria con un trasporto USB finto, per verificare i byte inviati.

Resta per la fase 2: immagini, codici a barre e QR, font inclusi, annulla e ripeti, modelli, etichette recenti, import ed export JSON, calibrazione degli offset ed eventuale ribaltamento di 180°, aggancio alla griglia, forme. Per la fase 3: PWA.
