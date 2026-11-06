# Testo sottolineato

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Cosa

Nel pannello del testo, accanto a **Grassetto** e **Corsivo**, c'è un terzo pulsante: **Sottolineato**. Sottolinea tutto il testo dell'elemento, riga per riga, come gli altri due stili.

## Come

1. **Modello** (`src/model/types.ts`):
   - `TextElement` ha un campo nuovo, `underline?: boolean`;
   - è facoltativo, così le etichette salvate prima (Recenti compresi) restano valide e risultano non sottolineate;
   - i testi nuovi nascono con `underline: false`.
2. **Disegno** (`src/render/scene.ts`): il testo usa `textDecoration: 'underline'` di Konva.
   - È lo stesso codice per editor, anteprima e stampa, quindi quello che si vede è quello che si stampa.
   - Konva disegna la linea larga quanto il testo di ogni riga, con uno spessore di 1/15 della dimensione del carattere. A 12 pt sono circa 3 punti della testina, 0,25 mm: ben visibile.
   - Nella stampa la linea passa per la stessa conversione a 1 bit del testo, quindi è nera piena.
3. **Posizione della linea:**
   - Konva calcola la posizione per conto suo, mentre l'app sposta il testo per centrare le maiuscole (`verticalShiftEm`, vedi la correzione ISO 3098);
   - la linea deve cadere **appena sotto la riga di base**, sopra la gamba di lettere come «g» e «p», e **dentro il riquadro**;
   - lo controllo con un test per ogni carattere (ISO 3098, senza grazie, con grazie, monospazio);
   - se la posizione di Konva non va bene, la imposto io con `underlineOffset`, calcolata dalle misure reali del carattere come già si fa per il centraggio.
4. **Adattamento automatico:** la linea sta nello spazio sotto la riga di base, che il calcolo della dimensione lascia già libero per le gambe delle lettere. Il testo quindi non si rimpicciolisce. Se il test mostra che la linea esce dal riquadro, l'adattamento ne terrà conto.
5. **Bianco su nero:** la linea è bianca come il testo.
6. **Pannello** (`TextProperties.vue`):
   - il gruppo «Stile» passa da 2 a 3 pulsanti: «**G** Grassetto · *C* Corsivo · <u>S</u> Sottolineato»;
   - a 412 px, se le scritte non entrano, i pulsanti mostrano solo **G**, *C* e <u>S</u>, con il nome completo come etichetta accessibile.
7. **Salvataggio:**
   - l'etichetta corrente e i Recenti salvano il nuovo campo;
   - due etichette uguali che differiscono solo per il sottolineato **non** sono doppioni nei Recenti.

## Test

- **Unitari:**
  - un'etichetta salvata senza `underline` si carica come non sottolineata;
  - il campo si salva e si ricarica;
  - nei Recenti la chiave dei doppioni tiene conto del sottolineato.
- **Rendering (Chromium vero), per ogni carattere:**
  - con il sottolineato compare una riga continua di inchiostro sotto il testo, larga quanto il testo (±1 mm);
  - la riga sta sotto le maiuscole e dentro il riquadro;
  - senza sottolineato non c'è;
  - in bianco su nero la riga è bianca;
  - con l'adattamento automatico la dimensione calcolata non cambia.
- **E2E:**
  - il pulsante si attiva e si disattiva, e l'anteprima cambia;
  - nessuno scorrimento orizzontale a 412×915;
  - screenshot del pannello e dell'anteprima.

## Note di implementazione (2026-11-06)

- **Posizione della linea:**
  - Konva, da solo, mette il centro della linea 0,25 em sotto la riga di base. Con un testo a 40 pt la linea finiva circa 3 mm sotto le maiuscole, più in basso delle gambe di «g» e «p», staccata dal testo;
  - ora `underlineOffset` vale 0,12 em (`UNDERLINE_OFFSET_EM` in `src/render/scene.ts`), come nei browser: la linea sta subito sotto le lettere e attraversa le gambe.
- **Spessore:** quello di Konva, 1/15 della dimensione del carattere.
- **Pannello:** il pulsante «<u>S</u> Sottolineato» entra a 412 px accanto a «Grassetto» e «Corsivo», senza abbreviazioni.
- **Test:**
  - 7 di rendering in `tests/browser/underline.test.ts`, per ognuno dei 4 caratteri: sotto le maiuscole a non più di 0,1 em, dentro il riquadro, continua, larga quanto il testo ±1,5 mm (non ±1 mm: la linea copre anche lo spazio ai lati delle lettere); in più gambe, bianco su nero e adattamento automatico invariato;
  - 3 unitari sul salvataggio;
  - 1 e2e con gli screenshot `24-sottolineato-pannello.png` e `25-sottolineato-anteprima.png`.
