# Copie multiple sulla LabelWriter 550

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**, da verificare sulla stampante

## Cosa succede

Prova dell'utente del 2026-11-06: **7 copie** chieste, la 550 ne stampa **una**, poi il pulsante di accensione **lampeggia** (errore). Le stampe da **1 copia** funzionano sempre: 8 di fila, con il contatore del rotolo sceso di 8.

## Cosa dicono le fonti

1. **La libreria `@thermal-label/labelwriter`.** La 550 è stata dichiarata «verificata» provando solo stampe da 1 copia, più due stampe singole di fila. I lavori con più etichette non sono mai stati provati su una stampante vera ([issue #1](https://github.com/thermal-label/labelwriter/issues/1)).
2. **Manuale tecnico ufficiale DYMO, «LabelWriter 550 Series Technical Reference».** Per ogni etichetta del lavoro servono `ESC n` (indice), `ESC D` più i dati e `ESC G`; alla fine `ESC E` ed `ESC Q`. Nel diagramma le etichette sono numerate **1, 2, … n**. Il manuale non parla della domanda di stato fra un'etichetta e l'altra.
3. **Driver Linux ufficiale DYMO per la serie 550, GPL** ([dymosoftware/Drivers](https://github.com/dymosoftware/Drivers), `LW5xx_Linux/src/lw/LabelWriterDriverV2.cpp` e `LabelWriterLanguageMonitorV2.cpp`; ordine delle chiamate in `common/CupsFilter.h`). Per un lavoro da 2 etichette la sequenza è:

   ```
   ESC A 1  → legge 32 byte              (blocco della stampante)
   ESC s …, densità, modo, velocità, ESC L
   ESC n 1, ESC D …, dati, ESC G         (etichetta 1)
   ESC A 2                               (domanda di stato, SENZA leggere)
   ESC L, ESC n 2, ESC D …, dati, ESC G  (etichetta 2)
   legge 32 byte                         (risposta a ESC A 2, DOPO l'etichetta 2)
   ESC A 0  → legge 32 byte
   ESC E, ESC Q
   ```

   Con più etichette lo schema si ripete: prima di ogni etichetta dalla seconda in poi parte `ESC A 2`, e la risposta si legge dopo averla spedita.

**Confronto con la libreria:**

| | Driver DYMO | Libreria |
|---|---|---|
| Indice della prima etichetta | **1** | **0** |
| Risposta a `ESC A 2` | letta **dopo** aver spedito l'etichetta successiva | letta **prima** di spedire l'etichetta successiva |

**Causa più probabile.** La libreria aspetta la risposta a `ESC A 2` prima di mandare l'etichetta 2. Se la 550 risponde solo dopo averla ricevuta, come presuppone il driver DYMO:
- la lettura scade dopo 15 s;
- la stampa si interrompe senza `ESC Q`;
- la stampante resta bloccata e lampeggia.

Torna con quello che si è visto: la prima etichetta esce, poi errore.

L'ordine del driver DYMO è ricostruito leggendo il codice, non registrato su una stampante. Il registro di una prova da 2 copie con la versione attuale lo confermerà: dopo la prima etichetta si dovrebbe vedere la lettura che aspetta e poi scade. Non serve però per cominciare.

## Cosa cambia

### 1. Più copie: sequenza come il driver DYMO

Con **1 copia** non cambia niente: si usa `print()` della libreria come oggi, il percorso provato su carta.

Con **2 o più copie** l'app manda il lavoro da sé, con la sequenza del driver DYMO:

- **Pezzi della libreria, non riscritti:**
  - immagine e lavoro sono preparati dalle sue funzioni esportate (`renderImage`, `compose550Job`);
  - si cambia solo l'**indice** di ogni etichetta, da 0, 1, … a **1, 2, …**: sono i 2 byte dopo `ESC n`;
  - il blocco della stampante (`ESC A 1`) e il controllo dello stato prima di stampare sono quelli della libreria, eseguiti nella sua stessa coda dei comandi, così nessun'altra richiesta (per esempio quella di stato ogni 4 s) si infila a metà lavoro.
- **Ordine dell'invio:**
  1. inizio del lavoro;
  2. etichetta 1;
  3. per ogni etichetta successiva: `ESC A 2`, l'etichetta, poi la lettura della risposta;
  4. `ESC A 0` con la sua lettura;
  5. `ESC E` ed `ESC Q`.
- **Controllo di ogni risposta letta:**
  - se la stampante segnala un errore (carta finita, coperchio aperto, lavoro annullato), il lavoro si chiude subito con `ESC Q`, così la stampante non resta bloccata;
  - il messaggio dice quante etichette sono uscite, per esempio «Stampate 3 copie su 7, poi: Carta finita». Il conteggio si ricava dall'indice di etichetta nella risposta di stato.
- **Errore di comunicazione a metà** (lettura scaduta, scrittura fallita): si manda comunque `ESC Q` per sbloccare. Il messaggio consiglia «Ripristina» o di spegnere e riaccendere se la stampante lampeggia ancora.
- **Prudenza con la libreria:** le parti interne che servono sono la coda dei comandi, il blocco e il trasporto. Se una versione futura non le ha più, l'app non tenta la sequenza: stampa le copie **una alla volta** (punto 2) e lo scrive nel registro.

### 2. Riserva: una copia alla volta

`src/printer/copies.ts` ha un interruttore, `MULTI_COPY_MODE`:

- **`'job'`** (predefinito): un lavoro con N etichette, come al punto 1;
- **`'one-by-one'`**: N lavori da 1 copia, cioè il percorso provato su carta.
  - Ogni etichetta va al punto di strappo, quindi è un po' più lento.
  - Prima di ogni copia si controlla lo stato.
  - Se qualcosa va storto si ferma e dice quante copie sono uscite.

Se il punto 1 non funziona sulla 550 vera, si passa a `'one-by-one'` cambiando una riga, senza altro lavoro.

### 3. Durante la stampa

- Il pulsante mostra «Stampa 3 di 7…». L'avanzamento si legge dall'indice di etichetta nelle risposte di stato, oppure dal ciclo nel modo `'one-by-one'`.
- Il messaggio finale resta «Stampate 7 copie ✓».
- **Pulsante «Ferma»** (richiesta dell'utente del 2026-11-06). Compare al posto di «Stampa» durante una stampa da 2 o più copie.
  - Non usa comandi di annullamento, che DYMO non documenta. L'app **smette di mandare etichette** e chiude il lavoro nel modo normale: `ESC A 0` con la sua lettura, poi `ESC E` ed `ESC Q`. Per la stampante è un lavoro più corto, con la stessa struttura di quello che funziona.
  - **Modo `'job'`:** le etichette già spedite vengono stampate. Al momento del tocco può esserne in viaggio al massimo una, quella in corso. Le successive non partono.
  - **Modo `'one-by-one'`:** si ferma dopo la copia in corso.
  - Durante la chiusura il pulsante dice «Fermo…». Alla fine il messaggio dice «Fermata: stampate 3 copie su 7».
  - Il conteggio delle copie uscite viene dall'indice di etichetta nell'ultima risposta di stato. Nel modo `'one-by-one'` viene dal ciclo.

### 4. Diagnostica

- «Ultime stampe» indica:
  - il modo usato, `job` oppure `one-by-one`;
  - copie chieste, etichette inviate e etichette rimaste sul rotolo prima e dopo;
  - l'eventuale copia a cui si è fermata.
- Il registro annota ogni passo, per esempio «Copie: etichetta 2 di 7 inviata, risposta di stato: indice 2, stampa in corso».

### 5. Pulizia insieme (punti 4 e 5 del controllo di manutenibilità)

- **«Ultime stampe» in un posto solo.** Il record si crea in un punto comune per la stampante vera e quella simulata. La stampante vera aggiunge solo i conteggi dal traffico USB.
- **Copie passate direttamente.** La stampa rapida passa il numero di copie a `print()`, senza modificare e poi rimettere a 1 `printer.copies`.

### 6. README

- Copie multiple: difetto trovato il 2026-11-06 e corretto così, con le fonti.
- Nuova verifica da fare sulla stampante: «copie multiple: 2 e 5 copie, tutte uscite, nessun errore».

## Test

- **Unitari, con il driver vero e un trasporto finto che risponde come la 550:**
  - 1 copia: byte identici a oggi;
  - 3 copie, ordine esatto: preambolo, etichetta 1, `ESC A 2`, etichetta 2, lettura, `ESC A 2`, etichetta 3, lettura, `ESC A 0` con lettura, `ESC E ESC Q`;
  - indici 1, 2, 3; dati delle etichette identici byte per byte a quelli della libreria;
  - un trasporto finto che risponde a `ESC A 2` **solo dopo** aver ricevuto l'etichetta successiva, come si suppone faccia la 550: con la nuova sequenza la stampa finisce; con quella della libreria si blocca. Questo test riproduce il guasto;
  - carta finita nella risposta dopo l'etichetta 2: si ferma, manda `ESC Q`, il messaggio dice «Stampate 2 copie su 3»;
  - lettura scaduta: `ESC Q` inviato, errore chiaro;
  - parti interne della libreria mancanti: si passa a «una alla volta», con la nota nel registro;
  - modo `'one-by-one'`: 3 lavori da 1 copia;
  - «Ferma» dopo l'etichetta 2 di 5 (modo `'job'`): nessuna etichetta 3, chiusura normale `ESC A 0` + lettura + `ESC E ESC Q`, messaggio «Fermata: stampate 2 copie su 5»;
  - «Ferma» nel modo `'one-by-one'`: si ferma dopo la copia in corso.
- **E2E, con la stampante simulata:**
  - «×1» → «3» mostra l'avanzamento e alla fine «Stampate 3 copie ✓»;
  - «×1» → «10», poi «Ferma» dopo la seconda copia: «Fermata: stampate 2 copie su 10» (al massimo 3, se una era già in viaggio);
  - nessuno scorrimento orizzontale.
- Tutti i test esistenti restano verdi.

## Da verificare sulla stampante

1. 2 copie, poi 5: tutte uscite, nessun lampeggio, il contatore del rotolo scende di 2 e poi di 5.
2. 10 copie con «Ferma» dopo 2 o 3: la stampa si ferma, l'ultima etichetta va al punto di strappo, nessun lampeggio.
2. Se fallisce: incollare il testo di «Copia tutto». Si passa a `'one-by-one'` e si riprova.

## Note di implementazione (2026-11-06)

- **`src/printer/copies.ts`:**
  - `write550CopiesDymoOrder`: sequenza DYMO, «Ferma», `ESC Q` se il lavoro si interrompe;
  - `numberLabelsFromOne`;
  - l'interruttore `MULTI_COPY_MODE`.
- **`src/printer/webusb.ts`:**
  - `printCopies` usa la coda dei comandi e il blocco della libreria. Sono campi privati, letti con controlli; se mancano si passa a una copia alla volta, con una nota nel registro;
  - con 1 copia resta `print()` della libreria.
- **«Ultime stampe» in un posto solo:** `send()` in `src/printer/print-flow.ts`.
  - Le porte restituiscono un esito (`PrintOutcome`: modo, etichette inviate, fermata, conteggi USB).
  - In caso di errore, le stesse informazioni stanno in `AppError.partial`.
  - La stampante simulata non registra più niente da sé.
- **Copie passate direttamente:** `printer.print(doc, prepare, copie)`. La stampa rapida non modifica più `printer.copies`.
- **Interfaccia:**
  - nella barra in basso e nel pannello del testo «Stampa» diventa **«Ferma 2/10»**, perché «Ferma · 2 di 10» non entrava a 412 px; durante la stampa «×1» è nascosto;
  - nell'anteprima il testo è **«Ferma · 2 di 10»**;
  - dopo «Ferma» il messaggio è «Fermata: stampate N copie su M».
- **Differenze dal piano:**
  - con un errore a metà, il titolo dice **«Stampa interrotta dopo N etichette inviate su M»** e il testo spiega la causa. Avevo previsto «Stampate N copie su M»: le etichette *inviate* si sanno con certezza, quelle *uscite* dalla stampante no;
  - l'avanzamento conta le etichette inviate.
- **Test:**
  - 8 unitari in `tests/unit/copies.test.ts`, con il driver vero della libreria e un trasporto finto che risponde a `ESC A 2` solo dopo l'etichetta successiva. Uno riproduce il guasto: la sequenza della libreria si blocca, la nostra finisce;
  - 2 e2e nuovi: avanzamento e «Ferma»; 3 copie complete.
