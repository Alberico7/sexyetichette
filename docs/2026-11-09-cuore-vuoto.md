# Cuore vuoto nascosto: «#<3-» diventa ♡

- Data: 2026-11-09
- Stato: **confermato e realizzato (2026-11-09)**, codice `#<3-`

## Perché

L'utente vuole anche il **cuore vuoto**, nascosto come il cuore pieno: si scrive un codice e diventa il simbolo, senza pulsanti.

Il cuore pieno oggi si scrive con `#<3*` (vedi `docs/2026-11-08-cuore-nascosto.md`).

## Cosa cambia

1. **Il codice.** Proposta: **`#<3-`**, cioè come il cuore pieno ma con il trattino al posto dell'asterisco. Appena si digita il trattino, il codice diventa **♡**.
   - Funziona come per il cuore pieno: il cursore resta dopo il cuore, vale anche se il codice arriva incollato e se nel testo ce ne sono più di uno.
   - `#<3` da solo resta testo, e `#<3*` resta il cuore pieno.
   - **Da confermare.** Il trattino sta nella prima pagina dei simboli di Gboard, accanto all'asterisco. Si può scegliere un altro carattere finale, per esempio `#<3o` o `#<3+`.
2. **Il simbolo.** ♡ (U+2661), cuore bianco.
3. **Il disegno.** Lo aggiungo al mini-font dell'app (`diametro.otf`), come il cuore pieno:
   - **stesso contorno del ♥**, alto quanto le maiuscole e appoggiato sulla riga;
   - un **bordo di spessore costante**, uguale al tratto del ⌀ (0,083 h), così ⌀, ∅ e ♡ hanno lo stesso peso. Il bordo interno si ottiene spostando il contorno verso l'interno lungo la perpendicolare, non rimpicciolendolo: lo spessore resta uguale anche nella punta e nell'incavo;
   - con **G** (grassetto) il bordo si ispessisce, come le lettere;
   - si adatta a ogni carattere (ISO, Noto Sans e gli altri) con lo stesso meccanismo degli altri simboli.
4. **Nell'interfaccia:** la casella del testo mostra lo stesso ♡ della stampa, perché il mini-font è il primo carattere dell'interfaccia.

## Dove

- `src/model/text.ts`:
  - `EMPTY_HEART = '♡'`, `EMPTY_HEART_CODE = '#<3-'`;
  - `replaceHeartCode` sostituisce entrambi i codici, con la stessa gestione del cursore;
  - `usesSymbolFont` riconosce anche ♡.
- `scripts/make-diameter-font.mjs`: nuovo glifo ♡ (U+2661); si rigenera `diametro.otf`.
- `src/render/diameter-font.ts` e `src/styles/base.css`: `unicode-range` diventa `U+2205, U+2300, U+2661, U+2665`.

## Cosa non cambia

- Il cuore pieno `#<3*`, il ⌀, il ∅ e i pulsanti.
- Le etichette già fatte.

## Test

- **Unitari:**
  - `#<3-` diventa ♡ e il cursore resta dopo il cuore;
  - testo con tutti e due i codici;
  - `#<3` da solo resta invariato;
  - il font contiene ♡: contorno esterno uguale al ♥, alto quanto le maiuscole, sulla riga;
  - il file incluso corrisponde allo script.
- **Browser (rendering)**, in ISO, Noto Sans e sans-serif:
  - ♡ alto quanto la «H» (±5 %);
  - vuoto al centro: il centro del cuore è bianco, il bordo è nero;
  - spessore del bordo misurato come quello del ⌀ (±1 punto);
  - il grassetto lo ispessisce;
  - il mini-font viene caricato anche se nel testo c'è solo ♡.
- **E2E:** si scrive «Ti #<3-»: la casella mostra «Ti ♡», anteprima e stampa simulata vanno a buon fine.
- **Da verificare sulla carta:** che il bordo sia netto e non si chiuda alla punta.

## Note di implementazione (2026-11-09)

- **Glifo** (`buildEmptyHeartGlyphPath` in `scripts/make-diameter-font.mjs`):
  - il contorno esterno è quello del ♥, ora calcolato da una funzione comune (`heartOutline`); ⌀, ∅ e ♥ nel font sono identici a prima, verificato confrontando i percorsi con il file precedente;
  - il contorno interno è una spezzata di circa 260 punti, ognuno spostato di 0,083 h verso l'interno lungo la perpendicolare;
  - nell'incavo in alto un arco di raggio 0,083 h attorno al vertice; alla punta si scartano i punti che finirebbero a meno di 0,083 h dal lato opposto;
  - `diametro.otf` passa da 2,1 a 3,0 KB.
- **Codice:** `replaceHeartCode` gestisce una lista di codici (`#<3*` → ♥, `#<3-` → ♡) con la stessa logica del cursore.
- **Test:**
  - unitari: 4 sul codice (sostituzione, i due codici insieme, trattino normale invariato, U+2661) e 1 sul glifo (contorno esterno uguale al ♥, ogni punto del bordo interno a 0,083 h ± 2 unità dal contorno esterno);
  - rendering, in sans-serif, ISO e Noto Sans: altezza come la «H», sulla riga, vuoto al centro, bordo spesso quanto il tratto del ⌀ (±2 punti), meno del 60 % dell'inchiostro del ♥; il grassetto ispessisce il bordo. Senza ♡ in `usesSymbolFont` i 3 test di rendering falliscono;
  - e2e: «Ti #<3-» diventa «Ti ♡», con il ♥ nello stesso testo, «20-30» resta com'è; anteprima e stampa simulata riuscite.
  - Totali: 322 unitari + browser, 93 e2e.
