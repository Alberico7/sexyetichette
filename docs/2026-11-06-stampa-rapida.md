# Stampa rapida, senza passare dall'anteprima

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Perché

Oggi per stampare servono due tocchi:
1. **Stampa**, che apre il pannello «Anteprima e stampa»;
2. **Stampa** di nuovo, nel pannello.

Nell'uso quotidiano l'anteprima serve di rado: l'editor mostra già l'etichetta come uscirà. L'utente vuole stampare con **un solo tocco**.

## Cosa cambia

### 1. «Stampa» stampa subito

Il pulsante **Stampa**, quello in basso nell'editor e quello nel pannello del testo, **manda subito in stampa 1 copia** con la densità scelta l'ultima volta.

- **Durante la stampa:** il pulsante dice «Stampa…» ed è disattivato, così un doppio tocco non stampa due etichette.
- **Alla fine:** compare il messaggio breve «Stampata ✓» in basso. L'etichetta finisce nei **Recenti**, come oggi.
- **Se c'è un errore** (carta finita, stampante scollegata…): appare il solito messaggio di errore in alto.
- **Con il pannello del testo aperto:** il testo vuoto viene tolto come oggi e il pannello si chiude prima di stampare.

### 2. Quando invece si apre l'anteprima

La stampa rapida **non parte**, e si apre il pannello «Anteprima e stampa» con l'avviso già visibile, se:

- **la stampante non è collegata**, perché il pannello mostra «Collega la stampante per stampare»;
- **c'è un problema che blocca la stampa**, per esempio carta finita o coperchio aperto;
- **l'etichetta è vuota;**
- **un testo non entra nel suo riquadro** ed è stampato alla dimensione minima;
- **il formato scelto non corrisponde al rotolo inserito.**

In tutti gli altri casi si stampa subito. Gli avvisi sono quelli che il pannello mostra già oggi: nessuna regola nuova.

### 3. Anteprima, copie e densità

- Accanto a **Stampa** compare un pulsante più piccolo, **«Anteprima»**, che apre il pannello di oggi: anteprima a 300 dpi, copie, densità e pulsante di stampa.
- **Copie senza anteprima** (richiesta dell'utente del 2026-11-06):
  - accanto a **Stampa** c'è un piccolo pulsante **«×N»**, che di solito dice «×1»;
  - un tocco apre un riquadro compatto **«Quante copie?»**, non l'anteprima, con:
    - i pulsanti rapidi **2 · 3 · 4 · 5 · 10**;
    - i pulsanti **−/+** per un numero qualsiasi da 1 a 99;
  - toccando un numero rapido **si stampa subito** quel numero di copie;
  - con −/+ si sceglie il numero e poi si tocca «Stampa N copie»;
  - dopo la stampa le copie tornano a **1**, come oggi, per non ristamparne troppe per errore;
  - valgono le stesse regole del punto 2: se c'è un avviso, si apre l'anteprima invece di stampare;
  - nel pannello del testo il pulsante «×N» c'è anche lì, accanto a **Stampa**.
- Le copie si possono scegliere anche nel pannello «Anteprima», come oggi.
- **Attenzione:** le copie multiple sulla 550 oggi danno errore dopo la prima etichetta (vedi `2026-11-06-copie-multiple-550.md`). La scelta delle copie si può fare subito, ma stampare più copie funzionerà solo dopo quella correzione.
- La **densità** scelta nel pannello resta ricordata e vale anche per la stampa rapida, come oggi.
- **Disposizione dei pulsanti,** a 412 px di larghezza:
  - in basso nell'editor: «＋ Testo · Recenti · 👁 · **Stampa** ×1». «Anteprima» è un'icona 👁 con etichetta accessibile, per lasciare spazio a «×N»;
  - con un testo selezionato: «＋ Testo · Modifica · Elimina · 👁 · **Stampa** ×1»;
  - nel pannello del testo: «Elimina · Fine · **Stampa** ×1»;
  - nessuno scorrimento orizzontale a 412 px.

### 4. Velocità

La stampa usa l'immagine già calcolata in sottofondo per l'anteprima, che si aggiorna mentre si scrive. Se il calcolo è in corso, lo completa e stampa subito dopo. Non c'è nessun passaggio in più rispetto a oggi.

## Cosa non cambia

- Comandi inviati alla stampante e immagine stampata: è lo stesso percorso di oggi, controllo dello stato compreso.
- Il pannello «Anteprima e stampa» resta com'è.
- La diagnostica e la Stampa di prova restano come sono, con la loro conferma.

## Test

- **E2E, con la stampante simulata:**
  - un tocco su **Stampa** fa 1 lavoro ricevuto, mostra «Stampata ✓» e aggiunge l'etichetta ai Recenti, senza che si apra il pannello;
  - dal pannello del testo, **Stampa** stampa subito e chiude il pannello;
  - stampante scollegata, etichetta vuota, testo troppo lungo, formato diverso dal rotolo, carta finita: si apre l'anteprima con l'avviso e non parte nessun lavoro;
  - doppio tocco veloce: 1 solo lavoro;
  - **Anteprima** apre il pannello; lì 2 copie danno 1 lavoro da 2 copie, come oggi;
  - «×1» → «3» stampa subito 3 copie senza aprire l'anteprima; poi il pulsante torna a «×1»;
  - «×1» → + + → «Stampa 3 copie» fa lo stesso;
  - «×N» con un avviso (per esempio etichetta vuota) apre l'anteprima e non stampa;
  - la densità scelta nel pannello vale per la stampa rapida successiva;
  - nessuno scorrimento orizzontale a 412×915, con e senza testo selezionato.
- **Prestazioni:** il tempo da tocco a lavoro inviato non peggiora rispetto alla stampa dal pannello.
- I test che oggi aprono il pannello con **Stampa** vengono aggiornati per usare **Anteprima**.

## Note di implementazione (2026-11-06)

- **Logica:** `src/composables/quick-print.ts`.
  - `useQuickPrint()` stampa oppure risponde «apri l'anteprima».
  - `usePrintWarnings()` contiene gli avvisi (formato diverso, testo che non entra), condivisi con `PrintSheet.vue`.
  - Un solo stato «in stampa» per tutta l'app: un doppio tocco non fa due lavori.
- **Riquadro delle copie:** `src/components/CopiesPicker.vue`, in un pannello «Quante copie?».
- **Collegamento in `App.vue`:**
  - `quickPrint(copie)`;
  - se compare un avviso, l'anteprima si apre già con le copie scelte;
  - messaggio «Stampata ✓» oppure «Stampate N copie ✓», anche dall'anteprima.
- **Barra in basso:**
  - pulsanti: «＋ Testo · Recenti · 👁 · Stampa ×1»;
  - con un testo selezionato: «＋ Testo · Modifica · Elimina · 👁 · Stampa ×1»;
  - a 412 px tutte le scritte entrano intere, controllato sullo screenshot.
- **Test:**
  - 9 e2e nuovi in `tests/e2e/quick-print.spec.ts`, ripetuti 4 volte senza errori;
  - i test esistenti ora usano 👁 per aprire l'anteprima;
  - il test «operazione tipica» passa da 3 a 2 tocchi.
- **Differenza dal piano:** «Anteprima» è sempre l'icona 👁, non un pulsante con la scritta, per lasciare spazio a «×1».
