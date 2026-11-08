# Logo del pettirosso come indicatore di stato della stampante

- Data: 2026-11-08
- Stato: **confermato e realizzato (2026-11-08)**, pettirosso intero al 150 %

## Perché

Nella barra in alto, lo stato della stampante è un pallino da 14 px:
- grigio se non è collegata;
- azzurro che pulsa durante il collegamento e la stampa;
- verde se è pronta;
- arancio per gli avvisi;
- rosso per gli errori.

L'utente propone di usare il logo del pettirosso: con un anello che cambia colore, oppure grigio quando la stampante non è collegata e a colori quando lo è.

## Cosa cambia

Il pallino diventa un **logo rotondo da 40 px**: il pettirosso dell'icona, ingrandito dentro un cerchio. Le due idee vanno insieme:

| Stato | Logo | Anello | Segno |
|---|---|---|---|
| Non collegata | **grigio**, attenuato | nessuno | — |
| Collegamento… / Stampa in corso… | a colori | azzurro, **gira** | — |
| Pronta | a colori | verde | ✓ |
| Avviso (non pronta, rotolo quasi finito…) | a colori | arancio | ! |
| Errore (coperchio aperto, niente rotolo…) | a colori | rosso | ✕ |

Anteprima nei due temi: `docs/2026-11-08-logo-stato/anteprima-stati.png`. L'anello che gira è fermo nell'immagine.

**Due versioni del disegno dentro il cerchio**, confrontate in `anteprima-confronto.png`. La versione B è stata richiesta dall'utente; la scelta è ancora da fare.
- **A, ingrandito:** il pettirosso riempie il cerchio, ma la coda e le zampe vengono tagliate, come in una foto profilo.
- **B, intero:** il pettirosso si vede tutto, coda ed etichetta comprese, ma è più piccolo.
- **B+, intero più grande:** come B, ingrandito al massimo prima che si tagli (fondo al 155 % invece che al 142 %). Confronto in `anteprima-intero.png`, con una vista ingrandita ×3 per controllare i bordi. Proposta dopo la richiesta dell'utente di ingrandire B.

- **Il segno** (✓ ! ✕) è un tondino in basso a destra, dello stesso colore dell'anello. Serve a chi distingue male verde e rosso.
- **I colori** sono quelli del tema, già ad almeno 7:1. Il grigio del logo non collegato non è testo: è attenuato apposta.
- **«Riduci animazioni»:** se il telefono ha l'opzione attiva, l'anello non gira. Resta azzurro, mezzo pieno.
- **Scritta accanto** («Pronta», «Coperchio aperto»…) e annuncio agli screen reader: come oggi.

## Dove

- `src/components/StatusLogo.vue`: nuovo componente, riceve il `tone` già calcolato oggi in `PrinterBar.vue` (`off`, `busy`, `ok`, `warn`, `error`).
  - Il disegno usa `public/icona-ritagliabile.svg`, ingrandito e ritagliato a cerchio.
  - Grigio con il filtro CSS `grayscale`.
  - Anello e segno in CSS.
- `src/components/PrinterBar.vue`: `<span class="dot">` sostituito da `<StatusLogo :tone="indicator.tone" />`.

## Cosa non cambia

- La logica degli stati: quali problemi danno rosso e quali arancio.
- Il resto della barra (tema, 🔧, Collega/Scollega). La barra resta della stessa altezza, perché i pulsanti sono già alti 48 px.

## Test

- **E2E:**
  - per ogni stato simulato (non collegata, pronta, coperchio aperto, rotolo quasi finito, stampa in corso), il logo ha la classe giusta e il segno giusto;
  - non collegata → logo grigio e niente anello;
  - nessuno scorrimento orizzontale a 412 px;
  - screenshot della barra nei due temi;
  - con `prefers-reduced-motion` l'anello non ha animazione.
- **Unitario:** il componente mostra ✓ / ! / ✕ secondo lo stato e niente per `off` e `busy`.

## Note di implementazione (2026-11-08)

- **Scelta:** pettirosso intero, con il fondo al **150 %**: la B+ «rimpicciolita di pochissimo», su richiesta dell'utente.
- **Codice:**
  - `src/components/StatusLogo.vue` e `src/components/status-logo.ts` (`statusMark`);
  - in `PrinterBar.vue` il pallino è sostituito dal logo, e gli stili `.dot` sono stati tolti.
- **Anello:** gira durante collegamento e stampa (1 giro al secondo). Con «riduci animazioni» è fermo, mezzo pieno.
- **Test:**
  - unitario su `statusMark`;
  - 4 e2e in `tests/e2e/status-logo.spec.ts`: non collegata grigia e senza anello; pronta ✓; coperchio aperto ✕; stampa in corso con anello che gira e si ferma con «riduci animazioni»; screenshot nei due temi.
- **Differenza dal piano:** lo stato «avviso» non è provato negli e2e, perché il simulatore non produce «Rotolo quasi finito». È coperto dal test unitario del segno.
- **Nota:** il logo è più largo del pallino (40 px contro 14), quindi il nome del modello sotto lo stato ha un po' meno spazio. «LabelWriter 550 (simulata)» viene troncato; il nome reale è più corto.
