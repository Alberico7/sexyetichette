# Tastierino numerico per il numero di copie

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**, senza numeri rapidi, su richiesta dell'utente

## Perché

Oggi «Quante copie?» (pulsante «×1» accanto a «Stampa») offre:

- i numeri rapidi 2 · 3 · 4 · 5 · 10;
- i pulsanti −/+;
- una casella in cui si può scrivere, che apre la tastiera del telefono.

Per un numero come 24 servono molti tocchi su «+», oppure la tastiera di sistema, che copre metà schermo e va chiusa. L'utente propone un tastierino numerico.

## Cosa cambia

Il riquadro «Quante copie?» diventa così, dall'alto in basso:

1. **Numero grande** al centro, per esempio «24 copie», con «⌫» accanto per cancellare l'ultima cifra.
2. **Tastierino 3×4** dentro l'app, senza la tastiera del telefono:

   ```
   1   2   3
   4   5   6
   7   8   9
   C   0   ⌫
   ```

   - tasti grandi, almeno 56 px di altezza, comodi col pollice;
   - **C** azzera;
   - si scrivono al massimo 2 cifre: il limite resta **99** copie, e un numero oltre 99 non si può comporre;
   - il riquadro si apre con il numero vuoto, e finché non si scrive niente il pulsante dice «Scrivi il numero di copie» ed è disattivato.
3. **Pulsante «Stampa N copie»**, grande, in fondo. Con 1 dice «Stampa 1 copia». Con 0 o vuoto è disattivato.

I numeri rapidi (2 · 3 · 4 · 5 · 10), i pulsanti −/+ e la casella con la tastiera di sistema vengono tolti: l'utente non li ritiene necessari (2026-11-06).

## Cosa non cambia

- Le regole della stampa rapida: se c'è un avviso (stampante non pronta, etichetta vuota…) si apre l'anteprima con il numero scelto.
- «Ferma» durante la stampa.
- Le copie tornano a 1 dopo la stampa.
- Nel pannello «Anteprima e stampa» restano i −/+ di oggi: lì il numero di copie è solo una delle impostazioni.

## Accessibilità

- Ogni tasto ha un nome leggibile dagli screen reader («cifra 4», «cancella l'ultima cifra», «azzera»).
- Il numero composto è annunciato quando cambia.
- Contrasto dei tasti ad almeno 7:1, come il resto dell'interfaccia.
- Il tastierino del computer funziona: cifre, Backspace, Canc e Invio per stampare.

## Test

- **Unitari** della logica del numero:
  - comporre «2», «4» dà 24;
  - un terzo tasto con 2 cifre già scritte viene ignorato;
  - ⌫ e C funzionano;
  - 0 iniziale ignorato;
  - vuoto → stampa disattivata.
- **E2E:**
  - «×1» → 2 → 4 → «Stampa 24 copie»: 1 lavoro da 24 copie e messaggio «Stampate 24 copie ✓»;
  - con un avviso, «×1» → 7 → stampa: si apre l'anteprima con 7 copie;
  - la tastiera del telefono non si apre (nessuna casella di testo attiva);
  - nessuno scorrimento orizzontale a 412×915;
  - screenshot nei due temi.

## Note di implementazione (2026-11-06)

- **Logica:** `src/composables/copies-keypad.ts` (`pressDigit`, `backspace`, `copiesOf`).
- **Componente:** `src/components/CopiesPicker.vue`. Funziona anche dalla tastiera del computer: cifre, Backspace, Canc/Esc, Invio.
- **Differenza dal piano:** niente «⌫» accanto al numero grande, perché c'è già nel tastierino.
- **Test:**
  - 4 unitari in `tests/unit/copies-keypad.test.ts`;
  - i test e2e delle copie usano il tastierino: 3 copie, 24 copie con ⌫/C e il limite di 99, avviso → anteprima con le copie scelte, «Ferma» con 10;
  - controllato che nel riquadro non ci siano caselle di testo, quindi la tastiera del telefono non si apre;
  - screenshot nei due temi.
