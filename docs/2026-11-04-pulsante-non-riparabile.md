# Pulsante «NON RIPARABILE»

- Data: 2026-11-04
- Stato: **confermato e realizzato**

## Cosa

Nel pannello Testo, sulla riga di **«⌀ Diametro»** e **«AFKEUR»**, compare un terzo pulsante, **«N. R.»** (NON RIPARABILE). Un tocco inserisce il testo **su due righe**:

```
NON
RIPARABILE
```

Il testo va nella posizione del cursore. Se c'è del testo selezionato, lo sostituisce. È lo stesso comportamento di «AFKEUR».

Uso tipico:
1. «＋ Testo»;
2. tocco su «N. R.»;
3. «Stampa».

L'etichetta esce con le due parole una sopra l'altra, centrate. Con l'adattamento automatico attivo, che è il valore predefinito, riempiono il riquadro.

## Come

- **Costante:** `UNREPAIRABLE_TEXT = 'NON\nRIPARABILE'` in `src/model/text.ts`, accanto a `REJECT_WORD`. Si cambia in un punto solo.
- **Inserimento:**
  - stessa funzione dei pulsanti già presenti (`insertAtSelection`);
  - la tastiera resta aperta e il cursore finisce dopo «RIPARABILE»;
  - il ritorno a capo è un normale «Invio» nel testo. L'editor, l'anteprima e la stampa lo gestiscono già, e così l'adattamento automatico («a capo solo con Invio»).
- **Spazi:** il testo è inserito così com'è, senza spazi o a capo prima e dopo, come per «AFKEUR». Se lo aggiungi dopo altro testo sulla stessa riga, il ritorno a capo prima di «NON» lo metti a mano.
- **Pulsante:**
  - per risparmiare spazio, sul pulsante c'è scritto **«N. R.»**, su una riga sola (richiesta dell'utente, 2026-11-04);
  - per i lettori di schermo il nome completo è «Inserisci NON RIPARABILE su due righe»;
  - i tre pulsanti stanno sulla stessa riga, senza scorrimento orizzontale a 412 px;
  - «N. R.» è corto, quindi prende meno spazio e lascia più larghezza a «⌀ Diametro» e «AFKEUR»;
  - l'altezza del pulsante resta quella di oggi, almeno 44 px.

## Test

- **Unitario:** inserimento nel testo vuoto, dopo un testo e al posto di una selezione. Il testo risultante contiene esattamente un ritorno a capo.
- **E2E (412×915):**
  - con «＋ Testo» e un tocco su «N. R.», il testo è «NON\nRIPARABILE»;
  - i tre pulsanti stanno sulla stessa riga;
  - nessuno scorrimento orizzontale;
  - la scritta «N. R.» del pulsante non è tagliata;
  - l'anteprima di stampa mostra due righe di testo.
- **Rendering:** con l'adattamento automatico, «NON» e «RIPARABILE» stanno nel riquadro su due righe e il blocco è centrato in verticale.

## Note di implementazione (2026-11-04)

- Costante `UNREPAIRABLE_TEXT` in `src/model/text.ts`. Pulsante `insert-unrepairable` in `TextProperties.vue`, dopo «AFKEUR».
- Sulla riga, «N. R.» è largo circa 0,6 volte gli altri due pulsanti.
- **Test:**
  - 1 unitario (vuoto, dopo un testo, al posto di una selezione);
  - 1 di rendering (`tests/browser/unrepairable.test.ts`): due righe, tutto nel riquadro, blocco centrato entro 1 mm;
  - 1 e2e: testo inserito, cursore alla fine, tre pulsanti sulla stessa riga, scritta non tagliata, nessuno scorrimento orizzontale, anteprima.

  Tutti i test passano, comprese le prestazioni.

## Scritta «N.R.» senza spazio (2026-11-10)

- **Richiesta dell'utente:** sul pulsante «N.R.» invece di «N. R.», per risparmiare spazio. Il testo inserito non cambia (NON↵RIPARABILE).
