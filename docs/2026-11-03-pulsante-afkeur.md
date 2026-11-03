# Pulsante «AFKEUR»

- Data: 2026-11-03
- Stato: **confermato e realizzato**

## Cosa

Nel pannello Testo, accanto al pulsante **«⌀ Diametro»**, compare un pulsante **«AFKEUR»**. Toccandolo, la parola `AFKEUR` viene inserita nel testo nella posizione del cursore; se c'è del testo selezionato, lo sostituisce.

## Come

- Stesso meccanismo del pulsante del diametro (`insertAtSelection` in `src/model/text.ts`):
  - la tastiera resta aperta: il tocco non toglie il fuoco al campo;
  - il cursore finisce subito dopo la parola inserita;
  - l'adattamento automatico ricalcola la dimensione come per qualsiasi testo.
- La parola è inserita così com'è, senza spazi prima o dopo: se serve uno spazio lo aggiungi a mano.
- La parola sta in una costante (`REJECT_WORD = 'AFKEUR'` in `src/model/text.ts`), così si cambia in un punto solo.
- I due pulsanti stanno sulla stessa riga e si dividono lo spazio a metà, senza scorrimento orizzontale a 412 px.

## Test

- **Unitario:** inserimento nel testo vuoto, a metà testo e al posto di una selezione.
- **E2E (412×915):**
  - con il cursore dopo «Tubo 20 » e un tocco su «AFKEUR», il testo diventa «Tubo 20 AFKEUR», con il cursore alla fine;
  - nessuno scorrimento orizzontale;
  - la parola compare nell'anteprima di stampa.

## Note di implementazione (2026-11-03)

- Costante `REJECT_WORD` in `src/model/text.ts`. Pulsante `insert-reject` in `TextProperties.vue`, sulla stessa riga del diametro, metà larghezza ciascuno.
- Test: 1 unitario e 1 e2e (inserimento al cursore, stessa riga, nessuno scorrimento orizzontale, anteprima). Tutti i test passano.
