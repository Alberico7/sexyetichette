# Pulsante «Larghezza etichetta» per il riquadro del testo

- Data: 2026-11-06
- Stato: **in attesa** (2026-11-06: l'utente ha chiesto di fare per ora solo il sottolineato)

## Perché

Con «Bianco su nero» il fondo nero copre il riquadro del testo. Per avere una fascia nera da un bordo all'altro dell'etichetta, oggi bisogna allargare il riquadro a mano con le maniglie, e allinearlo esattamente ai bordi col dito è difficile. Serve un pulsante che lo faccia in un tocco.

## Cosa

Nel pannello del testo, in «Altre opzioni», accanto a «Bianco su nero» e «Ruota 90°», c'è un nuovo pulsante: **«↔ Larghezza etichetta»**.

Un tocco porta il riquadro del testo a **tutta la larghezza utile dell'etichetta**:

- **Larghezza utile** è l'area consigliata, cioè quella che la testina stampa in modo affidabile:
  - **lungo il rotolo:** dalla fine della zona iniziale non stampabile (6 mm) al bordo opposto dell'etichetta;
  - **attraverso il rotolo:** da bordo a bordo, meno il margine di sicurezza di 0,5 mm per lato (vedi `2026-11-05-margine-bordo-testina.md`).
- **Bordo sinistro** del riquadro: sull'inizio di quell'area.
- **Altezza e posizione verticale:** non cambiano. Se il riquadro sporgeva fuori dall'etichetta in alto o in basso, viene riportato dentro.
- **Testo ruotato di 90° o 270°:** la sua «larghezza» corre lungo l'altezza dell'etichetta, quindi viene portata all'altezza utile, centrata sul riquadro attuale. Con altre rotazioni (per esempio 45°) il pulsante è disattivato, perché non c'è una larghezza dell'etichetta a cui allinearlo.
- **Con l'adattamento automatico attivo:** il testo si ridimensiona da solo per riempire il riquadro più largo, come quando lo si allarga con le maniglie.
- Funziona anche senza «Bianco su nero», per esempio per centrare un titolo su tutta l'etichetta.

### Bordi neri

Nella stampa il nero arriva solo dove la testina può stampare:

- **lungo il rotolo:** i primi 6 mm dell'etichetta restano bianchi (zona iniziale non stampabile), poi il nero va fino al bordo opposto;
- **ai bordi lunghi:** resta il margine di 0,5 mm, perché lì la stampa non è affidabile (prove del 2026-11-05 e 2026-11-06).

Nell'editor queste zone sono già mostrate. Se si vuole il nero fino al bordo esatto dei lati lunghi, il riquadro si può comunque allargare a mano dentro la striscia di sicurezza, come oggi.

## Dove

- `src/stores/document.ts`: nuova funzione `fitElementWidthToLabel(id)`, che calcola il riquadro dalla geometria del documento (area `safe`).
- `src/components/TextProperties.vue`: il pulsante. La riga «Bianco su nero · Ruota 90°» diventa di 3 pulsanti; se a 412 px non entrano, «Larghezza etichetta» va su una riga sua.

## Test

- **Unitari:**
  - lungo il rotolo, 28×89: x = 6 mm e larghezza = 89 − 6 = 83 mm; altezza e y invariate;
  - attraverso il rotolo: x = 0,5 mm e larghezza = larghezza dell'etichetta − 1 mm;
  - riquadro che sporgeva in alto: riportato dentro;
  - rotazione 90°: lato lungo del riquadro = altezza utile, centro verticale del riquadro conservato;
  - rotazione 45°: niente cambia.
- **Rendering:** «Bianco su nero» con «Larghezza etichetta», poi stampa. Nel bitmap inviato il nero copre l'area utile per tutta la larghezza, e non ci sono punti neri nella zona non stampabile né nelle strisce di sicurezza.
- **E2E:**
  - il pulsante allarga il riquadro nell'editor e nell'anteprima;
  - è disattivato a 45°;
  - nessuno scorrimento orizzontale;
  - screenshot.
