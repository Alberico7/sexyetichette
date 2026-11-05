# Immagini, codici a barre e codici QR

- Data: 2026-11-04
- Stato: **programmato, in attesa**. Proposta approvata nei contenuti; l'utente ha chiesto di aspettare prima di realizzarla (2026-11-04). Non iniziare finché non lo chiede.
- Fa parte della fase 2 prevista in `2026-11-02-app-etichette-webusb.md`.

## Cosa

Sull'etichetta, oltre ai testi, si possono mettere tre nuovi tipi di elemento:

1. **Immagine:** loghi, simboli e pittogrammi, presi dalla galleria del telefono o dalla fotocamera.
2. **Codice a barre:** Code 128, EAN-13 e Code 39.
3. **Codice QR:** un testo o un indirizzo web.

Come i testi, ogni elemento si sposta, si ridimensiona e si ruota con le dita, e si modifica dal suo pannello. Anteprima e stampa sono quelle di oggi. Il codice che parla con la stampante non cambia: riceve sempre un'immagine in bianco e nero a 300 dpi.

Le foto funzionano, ma su un'etichetta piccola rendono poco. Il caso previsto sono loghi e simboli.

## Dove si aggiungono

Con nessun elemento selezionato, la barra in basso diventa:

**«＋ Testo» · «＋ Altro» · «Recenti» · «Stampa»**

- «＋ Testo» resta a un tocco, perché è l'uso più frequente.
- «＋ Altro» apre un pannello dal basso con tre voci grandi: **Immagine**, **Codice a barre**, **Codice QR**.
- Quattro pulsanti a 412 px stanno su una riga senza scorrimento orizzontale. È la stessa disposizione che la barra ha già quando un testo è selezionato.

## 1. Immagine

- **Scelta del file:** «Immagine» apre la scelta di Android, quindi galleria, file o fotocamera, con un normale `<input type="file" accept="image/*">`. Non serve nessun permesso speciale e funziona con Vanadium.
- **Posizione:** l'immagine entra al centro dell'etichetta, grande quanto l'area stampabile permette, mantenendo le proporzioni.
- **Conversione in bianco e nero:** la LabelWriter stampa solo punti neri. Il pannello Immagine ha:
  - **Modo:**
    - **«Disegno»**, il predefinito, per loghi e simboli: ogni punto diventa bianco o nero secondo una soglia;
    - **«Foto»**: i grigi diventano puntini più o meno fitti (retinatura Floyd–Steinberg).
  - **Più chiaro / più scuro:** un cursore che sposta la soglia. L'anteprima si aggiorna mentre lo muovi.
  - **Inverti:** bianco al posto del nero.
  - **Ruota di 90°**, **Sostituisci immagine** ed **Elimina**.
- **Le proporzioni restano bloccate** quando si ridimensiona con le maniglie, così il logo non si deforma.
- **Trasparenza:** le parti trasparenti di un PNG, per esempio di un logo, diventano bianche.
- **Memoria:**
  - appena scelta, l'immagine viene rimpicciolita, al massimo 800 punti sul lato lungo, e salvata **in scala di grigi**, come PNG;
  - così si può cambiare la soglia in seguito senza ricaricare il file, e un logo occupa di solito 10–60 KB invece dei 3–5 MB di una foto del telefono;
  - l'etichetta salvata e le *Recenti* la ricordano;
  - se la memoria del browser si riempie vale la regola di oggi: le recenti più vecchie escono, e la stampa funziona comunque.
- **File troppo grandi o rovinati:** un avviso chiaro, «Immagine non leggibile», e nessun elemento aggiunto. Oltre 20 MB il file viene rifiutato prima di leggerlo.

## 2. Codice a barre

- **Pannello:**
  - **Contenuto**, la casella di testo;
  - **Tipo:**
    - **Code 128**, il predefinito, che accetta lettere, cifre e simboli;
    - **EAN-13**, 12 o 13 cifre: la cifra di controllo, se manca, la calcola l'app;
    - **Code 39**, maiuscole, cifre e pochi simboli;
  - **«Mostra il testo sotto»**, attivo di base, scritto con il carattere tecnico ISO 3098.
- **Nitidezza per lo scanner:**
  - ogni barra è larga un numero **intero** di punti della testina, mai una via di mezzo sfumata;
  - il codice viene disegnato direttamente in punti a 300 dpi, non rimpicciolito da un'immagine;
  - la barra più stretta è di almeno 2 punti (0,17 mm);
  - a destra e a sinistra resta il margine bianco obbligatorio («zona di quiete»).
- **Avvisi:**
  - contenuto non valido per il tipo scelto, per esempio lettere in EAN-13: «Contenuto non valido per EAN-13», e il codice non viene disegnato;
  - codice troppo lungo per il riquadro: «Il codice non entra: allarga il riquadro o accorcia il contenuto». Stessa regola dei testi che non entrano.
- La stampa è bloccata se un codice ha un errore, come oggi per un'etichetta vuota.

## 3. Codice QR

- **Pannello:** **Contenuto**, testo o indirizzo, e **Correzione d'errore**:
  - «Normale» (M), il predefinito;
  - «Alta» (Q), più robusta se l'etichetta si rovina, ma con più quadratini.
- **Forma:** il QR è sempre quadrato. Il riquadro si ridimensiona mantenendo il quadrato.
- **Nitidezza:**
  - ogni quadratino è un numero intero di punti, almeno 3 punti (0,25 mm);
  - attorno resta un bordo bianco di 2 quadratini;
  - se il contenuto è troppo lungo per il riquadro: «Il QR non entra: ingrandisci il riquadro o accorcia il contenuto».
- **Capienza:**
  - su un'etichetta alta 25 mm entra comodamente un indirizzo web di 40–60 caratteri;
  - non c'è un limite fisso: decide la regola dei 3 punti.

## Come

- **Modello** (`src/model/types.ts`): `LabelElement` diventa l'unione di tre tipi.
  - **`text`** come oggi.
  - **`image`:**
    - `source`, il PNG in scala di grigi come data URL;
    - `mode`, cioè `'threshold'` o `'dither'`;
    - `threshold`, `invert`.
  - **`code`:**
    - `symbology`, cioè `'qr'`, `'code128'`, `'ean13'` o `'code39'`;
    - `value`, `showText`, `qrErrorLevel`.

  Le etichette salvate di oggi restano valide. La versione del formato non cambia, perché aggiungo solo tipi nuovi. Il controllo dei dati letti (`parseDocument`) impara i nuovi tipi e scarta un elemento rovinato senza perdere il resto.
- **Disegno** (`src/render/scene.ts`): ogni tipo ha la sua funzione di costruzione per Konva.
  - L'immagine convertita e il codice vengono preparati come bitmap in bianco e nero alla risoluzione di stampa e messi in cache, per non rallentare quando si trascina.
  - Editor, anteprima e stampa usano lo stesso disegno, come per i testi.
- **Librerie per i codici**, entrambe MIT e caricate **solo quando si crea o si apre un codice**, così l'avvio non rallenta:
  - **`qrcode-generator`** (2.0.4) per il QR;
  - **`jsbarcode`** (3.12.3) per i codici a barre.

  Uso solo la **codifica**, cioè la sequenza di barre e quadratini: il disegno a punti interi lo fa l'app. Licenze in `public/licenses/`, come per osifont.
- **Conversione immagine** (`src/render/image-convert.ts`, nuovo): rimpicciolimento, scala di grigi, soglia e retinatura.
  - Sono funzioni pure su array di pixel, quindi testabili senza browser.
  - La retinatura viene fatta alla risoluzione di stampa dell'elemento, così i puntini corrispondono ai punti della testina.
- **Pannelli:** `ImageProperties.vue` e `CodeProperties.vue` (nuovi). Il pannello agganciato in basso funziona come quello del testo: «Elimina», «Fine», «Stampa».
- **Miniature delle Recenti:** nessun cambiamento, vengono già dal bitmap di stampa. Il riassunto testuale aggiunge «[immagine]», «[QR] contenuto» e «[codice] contenuto».
- **Diagnostica:** come per i testi, immagini e contenuti dei codici non vengono inclusi.

## Ordine di lavoro

Tutto insieme in una consegna, ma costruito e provato in questo ordine:
1. modello e salvataggio;
2. codici QR e a barre, la parte più utile e più facile da verificare;
3. immagini;
4. barra «＋ Altro».

## Test

- **Unitari:**
  - controllo dei dati: nuovi tipi validi, rovinati, etichette vecchie ancora valide;
  - EAN-13: cifra di controllo calcolata, contenuti non validi rifiutati;
  - soglia, inversione e retinatura su piccole immagini note;
  - rimpicciolimento a 800 punti con le proporzioni giuste.
- **Rendering (Chromium):**
  - **QR:**
    - quadratini di dimensione intera e uguale;
    - bordo bianco presente;
    - il QR stampato viene **riletto** con il lettore QR del browser (`BarcodeDetector`, se disponibile in Chromium) o con un decodificatore di test e dà il contenuto originale;
  - **Code 128 ed EAN-13:**
    - larghezze delle barre multiple intere del modulo;
    - zone di quiete;
    - sequenza delle barre uguale a quella attesa per un contenuto noto;
  - **immagine:**
    - un logo di prova a due colori esce identico in nero e bianco;
    - le parti trasparenti diventano bianche;
    - le proporzioni restano bloccate.
- **E2E (412×915, stampante simulata):**
  - «＋ Altro» → «Codice QR», scrivo un indirizzo e stampo: un lavoro ricevuto, anteprima non vuota;
  - codice a barre EAN-13 con lettere: avviso e stampa bloccata;
  - immagine caricata da file di prova: compare, si cambia la soglia, si stampa;
  - ricaricando la pagina immagine e codici ci sono ancora; compaiono nelle *Recenti*;
  - nessuno scorrimento orizzontale nei nuovi pannelli e nella barra a quattro pulsanti.
- **Prestazioni:**
  - avvio senza le librerie dei codici;
  - trascinare un'immagine o un QR resta fluido;
  - le prove di oggi restano nei limiti.

Sulla stampante vera, poi, è da verificare che QR e codici a barre stampati si leggano con il telefono. I test simulati non lo garantiscono.

## Fuori da questa proposta

- Modifica dell'immagine (ritaglio, gomma), forme e linee.
- Codici a barre GS1-128, DataMatrix, PDF417: aggiungibili dopo, se servono.
- Contenuti variabili o numerazione progressiva.
- Modelli salvati, import ed export JSON, annulla e ripeti: restano nella fase 2, con documenti separati.
