# Prova della dettatura sul telefono (riconoscimento vocale in locale)

- Data: 2026-11-10
- Stato: **confermato (2026-11-10)**

## Perché

L'utente vorrebbe dettare il testo delle etichette. L'audio deve essere elaborato **sul telefono**, senza mandarlo a un servizio esterno, e nel modo più veloce possibile.

Prima di toccare l'app serve sapere quanto sono veloci e precisi i motori possibili **sui due telefoni reali**:

- Pixel 7a, GrapheneOS, Vanadium;
- Realme GT Master, Brave.

Questa è solo una **pagina di prova**, separata dall'app. La dettatura vera nell'app sarà un documento a parte, scritto dopo aver visto i risultati.

## La pagina di prova

Indirizzo: `https://alberico7.github.io/sexyetichette/prova-voce.html`. Dall'app non ci sono collegamenti.

1. **Cosa offre il browser.** All'apertura la pagina mostra:
   - se c'è il riconoscimento vocale del browser (Web Speech API) e se dichiara di funzionare sul telefono, senza Internet. Lo segnala soltanto, non lo usa;
   - se c'è la scheda grafica per il calcolo (WebGPU);
   - quanti core ha il processore;
   - se il browser permette di usare più core insieme (`crossOriginIsolated`). Su GitHub Pages mi aspetto di no.
2. **Scelta del motore:**
   - **Whisper**, nelle misure tiny, base e small (base preselezionata), con la scheda grafica (WebGPU) o con il solo processore (WASM);
   - **Vosk**, con il modello italiano piccolo.
3. **Scaricamento.** Il modello si scarica solo quando si preme «Carica». Si vedono l'avanzamento e il tempo impiegato. Il browser lo conserva, quindi le volte successive non si riscarica.
4. **Premi per parlare.** Si tiene premuto un pulsante grande, si parla e si lascia. La pagina mostra:
   - il testo riconosciuto (con Vosk anche mentre si parla);
   - la durata della frase;
   - il tempo del riconoscimento, cioè quanto passa da quando si lascia il pulsante a quando compare il testo;
   - il rapporto fra tempo di riconoscimento e durata della frase.
5. **Frasi suggerite**, tipiche delle etichette, da leggere ad alta voce:
   - «tubo diametro ISO venti virgola cinquanta» (atteso ⌀20,50);
   - «flangia diametro dodici punto settantacinque» (atteso ∅12.75);
   - «albero diametro otto virgola zero cinque» (atteso ∅8,05: lo zero dopo la virgola non deve sparire).
   - Scelta dell'utente: «diametro» da solo è il ∅ a 45°, «diametro ISO» è il ⌀ ISO. I diametri si scrivono con i decimali, con la virgola o con il punto (00,00 o 00.00): si dice «virgola» o «punto» e il separatore deve restare quello detto. La prova mostra come li scrive ogni motore, e la dettatura nell'app li correggerà se serve;
   - «pompa non riparabile»;
   - «valvola tre quarti di pollice»;
   - «afkeur» (parola olandese: serve a vedere come se la cava con le parole non italiane);
   - «codice centoventicinque barra quattro».
6. **«Copia risultati»**, come nella diagnostica dell'app. Copia in un testo le caratteristiche del browser e tutte le prove fatte (motore, tempi, testo), da incollare qui.

## Come

- **Whisper:** libreria `@huggingface/transformers` (versione fissa), modelli `onnx-community/whisper-*` compressi, lingua fissata sull'italiano. I modelli si scaricano dal sito di Hugging Face.
- **Vosk:** libreria `vosk-browser` (versione fissa) con il modello `vosk-model-small-it-0.22`, circa 50 MB.
  - Il sito ufficiale non permette di scaricarlo da un'altra pagina web (CORS): vedi le note di implementazione.
- **Microfono:** `getUserMedia`. L'audio viene convertito in mono a 16 kHz, il formato che vogliono entrambi i motori. Si chiede il permesso al primo uso del pulsante.
- **Calcolo in un worker**, cioè separato dalla pagina, così la pagina non si blocca mentre il modello lavora.
- **Una seconda pagina nello stesso progetto** (`prova-voce.html`, una seconda voce in `vite.config.ts`). Le librerie della prova finiscono solo nei suoi file, quindi **l'app non diventa più pesante e non cambia**.

## Cosa non cambia

- L'app, le sue pagine e i suoi tempi di avvio.
- Nessun audio esce dal telefono. Da Internet si scaricano solo i modelli, una volta.

## Test

- **Unitari:** la conversione dell'audio a 16 kHz mono (lunghezza e frequenza giuste) e il calcolo dei tempi.
- **E2E:**
  - la pagina si apre e mostra le caratteristiche del browser;
  - l'app non contiene le librerie della prova: il suo pacchetto non cresce.
  - I modelli **non** vengono scaricati nei test, che restano veloci.
- **Sui telefoni (tu):** su entrambi provi Whisper base con la scheda grafica, Whisper base con il solo processore e Vosk. Leggi le frasi suggerite e incolli «Copia risultati». Se Whisper base va bene, si prova anche small.

## Dopo la prova

Con i numeri veri scelgo motore e misura del modello. Poi scrivo il documento della dettatura nell'app:

- il pulsante microfono nella casella del testo;
- le parole dell'app («diametro» → ⌀, «a capo», ecc.);
- lo scaricamento al primo uso.

## Note di implementazione (2026-11-10)

- **File:** `prova-voce.html` e `src/prova-voce/`:
  - `main.ts`: pagina, microfono, motori, risultati;
  - `whisper-worker.ts`: Whisper nel worker;
  - `audio.ts`: conversione a 16 kHz, tempi;
  - `style.css`.
  - Seconda voce di build in `vite.config.ts` e worker in formato a moduli.
- **Librerie:** `@huggingface/transformers` 4.3.1, `vosk-browser` 0.0.8 e `fflate` 0.8.3, versioni fisse.
  - Il motore di calcolo di Whisper per il processore (`ort-wasm…wasm`, 27 MB) finisce nel sito, ma si scarica solo premendo «Carica».
  - Vosk (5,8 MB) e `fflate` si caricano solo quando si sceglie Vosk.
  - L'app non scarica niente di tutto questo: lo verifica un e2e.
- **Vosk, modello 0.22** (`src/prova-voce/vosk-model.ts`, `src/prova-voce/tar.ts`):
  - il sito ufficiale non permette CORS. Si scarica la copia su Hugging Face (`ambind/vosk-model-small-it-0.22`, revisione fissa), che permette CORS;
  - la copia è identica allo zip ufficiale: stessa impronta SHA-256, verificata il 2026-11-10 scaricando entrambi. La pagina ricontrolla l'impronta a ogni scaricamento e si ferma se è diversa;
  - `vosk-browser` vuole un `.tar.gz`: la pagina estrae lo zip (`fflate`), crea il tar (scrittore ustar minimo) e lo comprime;
  - il risultato si conserva nel browser (Cache Storage), quindi dalla seconda volta non si riscarica;
  - all'inizio avevo usato il modello 0.4 pubblicato dall'autore di `vosk-browser`. **Scelta dell'utente:** tenere solo la versione più nuova, la 0.22.
- **Dimensioni reali di Whisper**, encoder più decoder, da Hugging Face:
  - con q8: tiny 41 MB, base 77 MB, small 249 MB;
  - con fp16: tiny 76 MB, base 146 MB, small 485 MB.
  - La pagina fa scegliere la compressione (q8 o fp16).
- **Primo avvio a vuoto:** dopo il caricamento Whisper elabora 1 s di silenzio. Con la scheda grafica è lì che compila i calcoli, e il tempo viene indicato a parte; le prove misurano solo il riconoscimento.
- **«Controlla» a parte:** la domanda al riconoscimento del browser (`SpeechRecognition.available`) fa chiudere la pagina in Chromium per computer. Per questo non parte da sola e la pagina avvisa di premerla per ultima.
- **Prova sul computer** (Chromium senza scheda grafica, voce sintetica di Windows «Elsa» al posto del microfono, frase «tubo diametro ISO venti virgola cinquanta», 4,6 s). Sono numeri del PC, non del telefono:
  - Whisper tiny, processore, q8: «Tu vogliamo trovi 20,5%.», 1,15 s;
  - Whisper base, processore, q8: «tubo di ametro iso 20,50», 2,40 s;
  - Vosk: con il pulsante lasciato prima della fine della frase «tubo diametro insolventi virgola cinquanta» (0.4). Tenendo premuto fino a dopo la frase, sia la 0.4 sia la 0.22 danno «tubo diametro iso venti virgola cinquanta», circa 0,06 s dopo il rilascio; la 0.22 lo scrive giusto già mentre si parla, la 0.4 passa per «insolventi»;
  - Vosk 0.22, caricamento: la prima volta 49,7 MB scaricati, controllati e convertiti in 11,4 s; la seconda, dalla memoria del browser, in 1,5 s.
- **Test:**
  - 5 unitari sull'audio (16 kHz da 48 e da 44,1 kHz, salita da 8 kHz, filtro, mono, tempi);
  - 4 unitari sul tar (cartelle, blocchi e somma di controllo, lettura ed estrazione con il programma `tar` del sistema, SHA-256);
  - 2 e2e: la pagina si apre senza scaricare modelli e «Copia risultati» funziona; l'app non carica le librerie della prova.
  - Totali: 331 unitari + browser, 95 e2e.
- **Correzione (2026-11-10): la pagina non scorreva su Vanadium con un dito**, solo con due.
  - Causa: la pagina metteva `overflow: auto` anche su `body`, che diventava un riquadro scorrevole senza niente da scorrere. In più l'app gli dà `overscroll-behavior: none`, quindi lo scorrimento non passava alla pagina. Con due dita si muove la vista del browser, per questo funzionava.
  - Ora `html` e `body` hanno `overflow: visible` e `overscroll-behavior: auto`.
  - Nuovo e2e: la rotellina fa scorrere la pagina (con la regola vecchia la pagina resta ferma e il test fallisce). Il gesto col dito simulato da Playwright non funziona nemmeno su una pagina vuota, quindi si usa la rotellina, che segue le stesse regole.

## Risultati sul telefono (2026-11-10)

Pixel 7a, Vanadium (Chrome 157, 8 core, 8 GB). Stesse sette frasi, lette dall'utente.

- **WebGPU:** «presente ma senza adattatore». Whisper con la scheda grafica non parte («Failed to get GPU adapter»). Vanadium non dà accesso alla scheda grafica alle pagine.
- **Riconoscimento del browser:** presente, ma l'italiano senza Internet è «unavailable». «Controlla» non ha chiuso la pagina.
- **Vosk 0.22 senza JIT** (impostazione di serie di Vanadium):
  - caricamento 95 s, scaricamento compreso;
  - testo 9–27 s dopo il rilascio, circa 5 volte la durata della frase.
- **Vosk 0.22 con «JavaScript JIT» attivato solo per `alberico7.github.io`:**
  - caricamento 4,7 s (modello già nel telefono);
  - testo **0,05–0,15 s** dopo il rilascio.
- **Precisione:** 6 frasi su 7 identiche al testo letto. Diametro ISO, virgola e punto, «otto virgola zero cinque», «tre quarti di pollice», «centoventicinque barra quattro» sono tutti giusti. «afkeur» → «a eur»: la parola non è nel vocabolario italiano di Vosk, quindi non verrà mai riconosciuta.
- **Realme GT Master, Brave:** Whisper con la scheda grafica si carica, ma non riconosce niente. Non ho indagato oltre, visto che è stato scelto Vosk. Una causa probabile è il modello q8 sulla scheda grafica, che con alcuni driver dà risultati vuoti.
- **Scelta dell'utente (2026-11-10): Vosk.** La dettatura nell'app è descritta in `docs/2026-11-10-dettatura.md`.
