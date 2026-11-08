# Grassetto attivo di default per il testo nuovo

- Data: 2026-11-08
- Stato: **confermato e realizzato (2026-11-08)**

## Perché

Il carattere predefinito «Tecnico ISO 3098» (osifont) ha un tratto sottile. L'utente vuole le scritte più spesse senza dover premere **G** ogni volta.

## Cosa cambia

- Ogni **testo nuovo** («+ Testo», o il testo creato scrivendo sull'etichetta vuota) nasce con **G già attivo**.
- Si può sempre togliere con **G**, come oggi.
- Vale per tutti i caratteri, non solo per l'ISO: il grassetto di default è un'impostazione del testo, non del carattere.

## Dove

- `src/model/document.ts`: nuova costante `DEFAULT_BOLD = true`, usata da `createTextElement` al posto di `bold: false`.

## Cosa non cambia

- **Le etichette già salvate** («Recenti») restano come sono state create: se avevano G spento, lo hanno ancora spento.
- **Il carattere predefinito** resta «Tecnico ISO 3098».
- **L'adattamento automatico** tiene già conto del grassetto: il testo resta dentro il riquadro, solo un po' più piccolo se serve.
- **La stampa:** il grassetto è già disegnato nel bitmap, come oggi quando si preme G.

## Test

- **Unitario:** `createTextElement` crea il testo con `bold: true`.
- **E2E:**
  - «+ Testo» → il pulsante G risulta premuto (`aria-pressed="true"`);
  - premendo G si spegne.
- **Test esistenti:** quelli che confrontano i pixel del testo normale indicheranno `bold: false` in modo esplicito, così non cambiano significato.

## Note di implementazione (2026-11-08)

- **Codice:** `DEFAULT_BOLD = true` in `src/model/document.ts`, usato da `createTextElement`.
- **Test:**
  - nuovo test unitario in `tests/unit/iso-font.test.ts`;
  - l'e2e «stile: pulsanti G, C, S» ora parte da G premuto e controlla che il tocco lo spenga;
  - in `label-store.test.ts`, il test «contenuto diverso» ora inverte il grassetto invece di accenderlo.
- **Differenza dal piano:** i test di rendering non hanno avuto bisogno di `bold: false` esplicito: nessun confronto di pixel dipendeva dal valore di default.
