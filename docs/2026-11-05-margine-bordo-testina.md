# Larghezza vera dell'etichetta e correzioni della diagnostica

- Data: 2026-11-05
- Stato: **confermato e realizzato**

## Cosa è emerso dalle prove del 2026-11-05

Le prove sono state fatte sul LabelWriter 550 vero, con un rotolo 25×54 mm (S0722520), nel verso «lungo il rotolo».

- **Corretti:**
  - verso e lato che esce per primo;
  - nitidezza e lettura del rotolo;
  - zona iniziale di 6 mm;
  - tacche lungo l'etichetta, cioè 10–50 mm.
- **Misure dell'utente:**
  - con il calibro, la linea del bordo esterno **in alto è 0,5 mm sotto il bordo** dell'etichetta, mentre doveva coincidere;
  - in basso la linea del bordo **manca** e le tacche sono tagliate da circa 24,5 mm in giù.

### Causa

Il contenuto è **spostato verso il basso di circa 0,4–0,5 mm**, e la riga più bassa finisce sul bordo dell'etichetta.

- Il catalogo della libreria dà per questo rotolo una larghezza di **25 mm**, cioè 295 punti. Il chip del rotolo dice **25,4 mm**, cioè 300 punti: è la misura vera, 1 pollice.
- La libreria mette l'immagine a partire dal punto 0 della testina. Il punto 0 corrisponde al **bordo basso** dell'etichetta, e la foto lo conferma.
- L'app manda 295 punti. Quindi:
  - la riga più bassa dell'immagine cade proprio sul bordo basso dell'etichetta e si perde nel taglio;
  - la riga più alta cade 5 punti, cioè 0,42 mm, **sotto** il bordo alto: è la misura del calibro;
  - i 5 punti più in alto dell'etichetta non vengono mai usati.
- Nell'editor, quindi, tutto appare 0,42 mm più in alto di dove esce davvero, e l'etichetta disegnata è più bassa di quella vera.

L'«offset verticale 1,6 mm» del chip non corrisponde a quello che si vede, quindi non lo uso.

## Cosa cambia

### 1. Larghezza vera dell'etichetta

- **Rotolo letto:** se il chip dà una larghezza, l'app usa **quella**, quindi 25,4 mm e 300 punti, al posto della larghezza arrotondata del catalogo. Vale per ogni rotolo letto, perché molte etichette DYMO hanno misure in pollici arrotondate nel catalogo, per esempio 28,6 mm indicati come 28 mm. Lo stesso per la lunghezza, se diversa.
- **Senza rotolo letto**, con formato scelto a mano, si usa il catalogo come oggi. Una nota in *Formato* dice che la misura è quella nominale.
- Il nome del formato non cambia: «Multiuso piccola 25×54 mm».
- **Effetto sulla carta:**
  - l'immagine inviata è larga 300 punti e copre esattamente l'etichetta, dal punto 0 al punto 299 della testina;
  - nell'editor ogni elemento è dove esce davvero;
  - l'area utile cresce di 0,4 mm.

### 2. Margine di sicurezza sui due bordi lunghi

Stampare fino al bordo esatto non è affidabile: il taglio dell'etichetta e la sua posizione hanno qualche decimo di tolleranza. La linea in basso della prova, che cadeva proprio sul bordo, si è persa.

- **Margine:** **0,5 mm (6 punti)** su entrambi i bordi lunghi, cioè in alto e in basso nel verso «lungo il rotolo», o a sinistra e a destra nel verso «attraverso il rotolo».
- **Come appare:** nell'editor e nell'anteprima è una zona grigia sottile, come la zona iniziale di 6 mm. I riquadri dei testi nuovi e l'adattamento automatico restano al suo interno.
- **Etichette già salvate:**
  - i testi restano dove sono, in millimetri dal bordo vero dell'etichetta;
  - un testo che tocca la zona grigia si vede, ma non lo sposto da solo;
  - le etichette salvate con il vecchio formato da 25 mm prendono la larghezza vera appena il rotolo viene letto.
- **Dove:** il valore sta in un punto solo, `EDGE_SAFETY_DOTS = 6` in `src/model/geometry.ts`. Se una prova mostra che serve di più o di meno, si cambia lì.

### 3. Stampa di prova

- Il bordo esterno viene disegnato sul limite della nuova area stampabile, quindi a 0,5 mm dai bordi lunghi.
- Una **seconda linea sottile** è disegnata sul bordo esatto dell'etichetta. Serve a vedere, nelle prove future, se il bordo vero si riesce a stampare.
- Le tacche restano misurate dal bordo vero dell'etichetta.

### 4. Falso allarme «codice interno 0x3832» nella diagnostica

- La risposta a ESC V finisce con i caratteri **«28»**, i byte `32 38`: è il codice del modello **scritto in testo**, cioè 0x28, uguale al codice USB 0x0028.
- La diagnostica li leggeva come numero binario, quindi 0x3832.
- **Correzione:**
  - se gli ultimi due byte sono cifre esadecimali in testo, li leggo come testo;
  - l'avviso sparisce.

### 5. README

- **Verifiche sull'hardware**, voce del 2026-11-05:
  - prova LabelWriter 550 senza problemi;
  - firmware 0002.0020, hardware LW550B_PPB_00002;
  - l'**avviso «64 byte» è innocuo**: 6 letture del rotolo sono identiche e le risposte di stato successive non sono sfasate;
  - stampa di prova: verso, zona iniziale e tacche corretti, contenuto spostato di 0,4–0,5 mm per la larghezza arrotondata del catalogo, corretto da questa modifica.
- **Elenco delle verifiche:** aggiornato. Resta da rifare una stampa di prova.

## Test

- **Unitari (geometria e formato):**
  - con il rotolo letto (larghezza del chip 25,4 mm) l'etichetta è alta 300 punti;
  - l'area stampabile ha 6 punti di margine in alto e in basso, e la zona iniziale di 6 mm resta invariata;
  - senza rotolo letto restano i 25 mm del catalogo, con lo stesso margine;
  - verso «attraverso il rotolo»: margini a sinistra e a destra;
  - un'etichetta salvata con il formato da 25 mm prende la larghezza del rotolo letto e i testi restano agli stessi millimetri.
- **Rendering:**
  - l'immagine inviata è larga 300 punti;
  - i punti 0–5 e 294–299 della testina sono bianchi per un testo con adattamento automatico;
  - nella stampa di prova la linea del bordo esatto è sui punti 0 e 299.
- **Diagnostica:** la risposta ESC V vera del 2026-11-05 dà codice 0x0028 senza avviso.
- **E2E:**
  - la zona grigia si vede nell'editor;
  - un testo nuovo sta dentro l'area utile;
  - nessuno scorrimento orizzontale;
  - i test esistenti restano verdi, con le misure aggiornate dove dipendono dalla larghezza.

## Da verificare dopo, sulla stampante

Una nuova *Stampa di prova* deve mostrare:
- la linea del bordo esterno a 0,5 mm da entrambi i bordi lunghi, misurata con il calibro;
- nessuna tacca tagliata;
- se le linee sul bordo esatto escono o no. Se escono intere, il margine di sicurezza si può ridurre.

Il verso «attraverso il rotolo» non è ancora stato provato su carta e andrà confermato.

## Note di implementazione (2026-11-05)

- **Larghezza vera:** `withRollSize` in `src/printer/media.ts`, usata da `mediaFromSku`.
  - La misura del chip sostituisce quella del catalogo se la differenza è fra 0,05 e 2 mm; oltre si tiene il catalogo.
  - La lunghezza cambia solo se differisce più di 0,2 mm.
  - In `App.vue`, un'etichetta salvata con lo stesso formato del rotolo letto ma con la misura arrotondata prende la misura vera. Verso e testi restano come sono.
- **Margine:** `EDGE_SAFETY_DOTS = 6` in `src/model/geometry.ts`.
  - La geometria ha due campi nuovi: `safe`, l'area consigliata, e `safetyZones`, le due strisce.
  - `printable` resta l'immagine inviata, intera, così sulla carta non si sposta nulla.
  - I testi nuovi nascono in `safe`.
  - Nell'editor le strisce hanno la tinta della zona non stampabile, più leggera. Nell'anteprima sono velate, senza tratteggio, perché lì si può stampare.
- **Stampa di prova:**
  - bordo esterno sull'area consigliata;
  - linea di 1 punto sul bordo esatto dei lati lunghi;
  - nuova domanda «Linea sul bordo esatto», riportata nel testo della diagnostica.
- **ESC V:** `versionProductId` in `src/printer/engine-version.ts`. Il riepilogo della diagnostica mostra anche l'area consigliata.
- **Test:**
  - 10 unitari (`tests/unit/edge-margin.test.ts`), con i byte veri di ESC U ed ESC V della 550;
  - 3 di rendering (`tests/browser/edge-margin.test.ts`);
  - test dell'etichetta di prova aggiornato per tutti i formati;
  - 1 e2e: etichetta salvata con misura arrotondata → misura del rotolo.

  Tutti i test passano, comprese le prestazioni.
- Il disegno della zona grigia nell'editor non ha un test automatico dedicato: è controllato a vista.
