# Icona dell'app: pettirosso con l'etichetta nel becco

- Data: 2026-11-07
- Stato: **confermato e realizzato (2026-11-07)**: prima versione D, poi **F** (scelta dell'utente, 2026-11-07)

## Perché

Oggi l'icona della scheda del browser è un rettangolo scuro con due righe bianche, scritto dentro `index.html`. È anonimo. L'utente chiede un pettirosso con un'etichetta nel becco.

## Le bozze

I disegni stanno nella cartella `docs/2026-11-07-icona-pettirosso/`. `anteprima.png` mostra ogni bozza a 256, 96, 48, 24 e 16 px.

| | File | Com'è |
|---|---|---|
| **A** | `a-etichetta-dritta.svg` | Pettirosso intero, di profilo, con zampe e coda. Tiene nel becco un'etichetta bianca rettangolare con due righe, come quelle del rotolo. Fondo crema chiaro. |
| **B** | `b-cartellino.svg` | Stesso pettirosso. Tiene per un filo un cartellino con il buco. Fondo blu ardesia dell'app (`#274e76`). |
| **C** | `c-semplice.svg` | Pettirosso ridotto a un tondo: dorso bruno, petto arancio, occhio, becco, etichetta. Fondo antracite del tema scuro. È la più leggibile da piccola, ma è la meno "pettirosso". |
| **D** | `d-blu-etichetta-dritta.svg` | Il pettirosso di B sul fondo blu, con l'etichetta rettangolare di A nel becco. Aggiunta su richiesta dell'utente. |
| **F** | `f-diametro.svg`, `f-diametro-ritagliabile.svg` | Come D, ma sull'etichetta c'è il simbolo del diametro ⌀ dell'app al posto delle due righe. Le proporzioni sono quelle della ISO 3098 (cerchio 0,77 h, barra a 75°); il tratto è più spesso, per leggerlo nell'icona. Confronto in `anteprima-diametro.png`. Scelta dall'utente il 2026-11-07, al posto della D. |

Colori:
- dorso bruno-oliva `#8a7457`, ali più scure;
- petto arancio-rosso `#d9622b` / `#e06a30`;
- pancia crema `#f1e6d2`;
- becco ed occhio quasi neri.

**Leggibilità da piccola:**
- a 48 px si riconoscono bene tutte e tre;
- a 16 px, dimensione della scheda del browser, l'etichetta diventa un puntino; resta un uccellino arancio e bruno.
- Proposta: a 16 px usare la stessa icona, senza versione speciale. Se poi da piccola non piace, si fa una variante con solo testa e petto.

Le bozze si possono ritoccare: colori, fondo, posizione dell'etichetta, anche mescolando elementi (per esempio l'uccello di A sul fondo di B).

## Cosa cambia nell'app

1. **La versione scelta diventa un file:** `public/icona.svg`.
2. **`index.html`** usa quel file come icona, al posto del disegno scritto nella pagina:
   - `<link rel="icon" type="image/svg+xml" href="icona.svg">`.
3. **Per l'aggiunta alla schermata home** (dal menu «Aggiungi a schermata Home»), anche:
   - `icona-180.png`, l'icona richiesta da Safari/iOS;
   - `icona-192.png`.
   I PNG si generano dall'SVG, una volta sola, con uno script nella cartella `scripts/`.
4. Le bozze scartate restano nella cartella del documento, come traccia.

## Cosa non cambia

- Niente PWA: l'icona «adattiva» di Android, quella che il telefono ritaglia a cerchio o a goccia, servirà nella fase 3 e partirà da questo disegno. Il pettirosso andrà allora rimpicciolito nella zona sicura centrale.
- Il nome dell'app, il resto dell'interfaccia e la stampa.

## Test

- **E2E:**
  - la pagina dichiara l'icona;
  - il file `icona.svg` esiste nel sito costruito e si carica, con risposta 200 e tipo SVG.
- **A vista:** dopo la pubblicazione, controllare la scheda del browser e i preferiti su Pixel e Realme.

## Note di implementazione (2026-11-07)

- **Scelta:** versione **D**, copiata in `public/icona.svg`.
- **`index.html`** dichiara tre icone:
  - `icona.svg`, per la scheda del browser;
  - `icona-192.png`;
  - `icona-180.png`, come `apple-touch-icon`.
- **PNG:** li genera `scripts/make-icons.mjs` con Chromium di Playwright. Lo script toglie gli angoli arrotondati del fondo, perché la forma la dà il telefono. Va rilanciato solo se cambia il disegno.
- **Test:** e2e in `tests/e2e/app.spec.ts`: le 3 icone dichiarate rispondono 200 con il tipo giusto. Controllato anche che finiscano in `dist/`.
- **Passaggio alla F (2026-11-07):**
  - `public/icona.svg` e `public/icona-ritagliabile.svg` ora hanno il simbolo ⌀ sull'etichetta;
  - PNG rigenerati con `scripts/make-icons.mjs`;
  - test delle icone verdi, compresa la zona sicura di Android.
