# Cuore nascosto: «#<3» diventa ♥

- Data: 2026-11-08
- Stato: **confermato e realizzato (2026-11-08)**, codice `#<3`

## Perché

L'utente vuole poter stampare un cuore sulle etichette, senza un pulsante visibile: una funzione «nascosta».

- Si scrive un codice nel testo e diventa ♥.
- Per non trasformare per sbaglio un `<3` scritto apposta (per esempio «<3 mm»), il codice ha un carattere in più davanti.

## Cosa cambia

1. **Il codice.** Scrivendo **`#<3`** nella casella del testo, appena si digita il «3» il codice diventa **♥**.
   - Il cursore resta subito dopo il cuore.
   - Funziona anche se il codice arriva incollato, e se nel testo ce ne sono più di uno.
   - `<3` senza `#` resta com'è.
   - **Il carattere `#`** è una proposta. Su Gboard sta nella prima pagina dei simboli, e su un'etichetta tecnica è raro che stia proprio davanti a `<3`. Si può cambiare con un altro carattere, per esempio `*` o `!`.
2. **Il simbolo.** È il cuore pieno ♥ (U+2665), non l'emoji colorata ❤️, perché la stampante stampa solo in nero.
3. **Il disegno del cuore.** osifont, il carattere ISO, non contiene ♥. Lasciato al telefono, il cuore verrebbe preso da un altro font, di grandezza e forma diverse da dispositivo a dispositivo.
   - Lo aggiungo al mini-font dell'app che contiene già il simbolo ⌀, `src/assets/fonts/diametro.otf`, generato da `scripts/make-diameter-font.mjs`.
   - È disegnato con curve, **alto quanto le maiuscole** e appoggiato sulla riga, come ⌀.
   - Si adatta a ogni carattere con lo stesso meccanismo di ⌀ (`unicode-range` più `size-adjust`).
   - Con **G** (grassetto) il cuore viene un po' più pieno, come le lettere.
4. **Niente pulsante e niente spiegazione nell'interfaccia:** resta nascosto. È documentato solo qui.

## Dove

- `src/model/text.ts`:
  - `HEART_CODE = '#<3'`, `HEART = '♥'`;
  - funzione pura `replaceHeartCode(text, cursor)`, che restituisce testo e cursore.
- `src/components/TextProperties.vue`: all'`@input` della casella si applica `replaceHeartCode`. Se il testo cambia, il cursore viene rimesso al posto giusto.
- `scripts/make-diameter-font.mjs`: aggiunge il glifo ♥.
- `src/render/diameter-font.ts`: `unicode-range` diventa `U+2300, U+2665`.

## Cosa non cambia

- Il simbolo ⌀ e il suo pulsante.
- I testi già salvati: un `#<3` già presente in un'etichetta salvata resta testo finché non si modifica quel testo.

## Test

- **Unitari:**
  - `replaceHeartCode`: un codice, più codici, codice incollato, cursore corretto, `<3` da solo invariato, testo senza codice invariato;
  - il font generato contiene ⌀ e ♥, e il cuore è alto quanto le maiuscole.
- **Browser (rendering):** «A♥A» in ISO, sans-serif e serif. Il cuore viene stampato pieno e la sua altezza è entro ±10 % da quella della «A».
- **E2E:** si scrive «Ti #<3» e la casella contiene «Ti ♥». L'anteprima mostra il cuore e la stampa simulata va a buon fine.

## Note di implementazione (2026-11-08)

- **Codice:**
  - `HEART`, `HEART_CODE` e `replaceHeartCode` in `src/model/text.ts`;
  - `onTextInput` in `TextProperties.vue`.
- **Glifo:**
  - `buildHeartGlyphPath` in `scripts/make-diameter-font.mjs`: cuore largo 0,95 h, alto esattamente h, punta sulla linea di base;
  - `diametro.otf` rigenerato;
  - `unicode-range` `U+2300, U+2665` sia nel disegno dell'etichetta (`diameter-font.ts`) sia nell'interfaccia (`base.css`), così anche la casella del testo mostra lo stesso cuore.
- **Test:**
  - 5 unitari su `replaceHeartCode`;
  - 1 sul glifo e 1 sul file del font;
  - 4 di rendering: cuore pieno, alto come la «H» entro il 5 %, sulla riga, in ISO, sans-serif e serif, e «A♥B» senza sovrapposizioni;
  - 1 e2e: si scrive «Ti #<3» e la casella mostra «Ti ♥»; `<3` da solo resta; la stampa simulata va a buon fine.
- **Da verificare sulla carta:** che il cuore stampato sia netto.
