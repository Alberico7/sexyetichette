# Orizzontale con la tastiera aperta

- Data: 2026-11-08
- Stato: **confermato e realizzato (2026-11-08)**, da provare sul telefono con la tastiera vera

## Perché

Dopo `docs/2026-11-08-orizzontale.md`, l'utente ha provato sul Pixel. In orizzontale, **con la tastiera aperta non si vede niente**.

**Le misure:**
- in orizzontale il Pixel 7a ha circa 412 punti di altezza;
- la barra del browser ne prende circa 56, la tastiera circa 200–230;
- restano **circa 120–150 punti**.

**Cosa succede oggi:**
- La pagina già si restringe allo spazio sopra la tastiera, grazie a `interactive-widget=resizes-content` in `index.html`.
- In quella striscia però l'app mette:
  - la barra in alto (circa 52 punti);
  - il pannello del testo, con la casella, i simboli ⌀ / AFKEUR / N. R., «Adatta automaticamente» ed Elimina / Fine / Stampa.
- Per la casella del testo non resta spazio.

## Cosa cambia

Una disposizione **compatta**, solo quando lo spazio è **alto al massimo 260 punti**: in pratica, orizzontale con la tastiera aperta.
- **In verticale non scatta mai:** con la tastiera aperta restano circa 500 punti.
- **In orizzontale senza tastiera non scatta:** ci sono circa 340 punti.

Mentre si scrive un testo:

```
┌─────────────────────────────┬──────────────────────────────┐
│                             │ Barattolo zucchero▌          │
│   [ etichetta, grande ]     │                              │
│                             ├──────────────┬───────────────┤
│                             │     Fine     │    Stampa     │
└─────────────────────────────┴──────────────┴───────────────┘
                 (sotto c'è la tastiera)
```

- **Barra in alto nascosta.** Lo stato della stampante torna appena si chiude la tastiera.
- **A sinistra l'etichetta**, alta quanto tutto lo spazio: si vede cosa si sta scrivendo.
- **A destra la casella del testo**, che prende lo spazio rimasto, e sotto due pulsanti da 40 punti:
  - **Fine** chiude il testo, e con lui la tastiera;
  - **Stampa** stampa subito.
- **Nascosti finché la tastiera è aperta:** ⌀ / AFKEUR / N. R., «Adatta automaticamente», «Altre opzioni», Elimina e ×N copie. Ricompaiono appena si chiude la tastiera, per esempio con il tasto «giù» di Android: si torna alla disposizione orizzontale normale, con il testo ancora aperto.
  - Il cuore si scrive comunque, con `#<3`.

### Telefoni piccoli in verticale (aggiunta dell'utente, 2026-11-08)

**Mentre si scrive un testo**, se lo spazio visibile è **alto al massimo 480 punti**, la **barra in alto si nasconde** anche in verticale.

Spazio sopra la tastiera in verticale:

| Telefono | Spazio |
|---|---|
| Pixel 7a | ~560 punti |
| Realme GT Master | ~520 punti |
| Telefono piccolo, per esempio 360×640 | ~300 punti |

- **Pixel e Realme in verticale:** non cambia niente.
- **Telefoni piccoli:** si guadagnano circa 70 punti per l'etichetta e il pannello.
- La barra torna appena si chiude la tastiera o si preme «Fine».
- Scelta dell'utente: soglia a 480 punti, invece di 600, per non nascondere lo stato della stampante su Pixel e Realme.

**Pannelli dal basso con la tastiera:** l'unica casella di testo nei pannelli è «Cerca formato o codice». In quel pannello, a 260 punti o meno, si nasconde il riquadro «Rotolo rilevato», così la ricerca e i primi risultati restano visibili.

## Dove

- `src/App.vue`: `@media (max-height: 260px)`, con barra in alto nascosta e `.stage` a due colonne.
- `src/components/TextDock.vue` e `src/components/TextProperties.vue`, nella stessa media query:
  - si vedono solo la casella del testo, che si allunga a riempire lo spazio, e Fine / Stampa;
  - Elimina e ×N copie sono nascosti.
- `src/components/MediaPicker.vue`: «Rotolo rilevato» nascosto a 260 punti o meno.

Solo CSS, senza logica nuova: le funzioni restano le stesse.

## Cosa non cambia

- Il verticale, con o senza tastiera.
- L'orizzontale senza tastiera, cioè la disposizione appena pubblicata.

## Test

- **E2E** (`tests/e2e/landscape.spec.ts`) a **915×130** e **873×150**, che simulano la tastiera aperta:
  - mentre si scrive, la casella del testo è visibile e alta almeno 40 punti; «Fine» e «Stampa» sono interi nello schermo; l'etichetta è visibile, alta almeno 80 punti;
  - si scrive, il testo compare sull'etichetta, e «Fine» chiude il pannello;
  - «Cerca formato» nel pannello del formato è visibile;
  - nessuno scorrimento orizzontale.
- **Verticale piccolo** a **360×300**, con la tastiera aperta su un telefono piccolo: mentre si scrive, la barra in alto è nascosta, e la casella e «Fine» sono visibili. A **412×560** (il Pixel con la tastiera) la barra resta.
- **Passaggio dei 260 punti:** a 915×340 la disposizione è quella di oggi, e i test esistenti la coprono.
- **Verticale:** le schermate di riferimento devono restare identiche byte per byte.
- **Sul telefono:** prova con la tastiera vera, nei due browser.

## Note di implementazione (2026-11-08)

- **Forma dello schermo invece di `orientation`.**
  - **Il problema:** su un telefono piccolo in verticale, con la tastiera aperta, lo spazio visibile diventa più largo che alto (per esempio 360×300). La media query `orientation: landscape` lo scambiava per orizzontale, e succedeva già con la versione dell'orizzontale appena pubblicata.
  - **La soluzione:** `src/screen-shape.ts` imposta `data-screen="landscape" | "portrait"` su `<html>`, da `screen.width` e `screen.height`, che seguono solo la rotazione del telefono. Lo aggiorna a ogni rotazione.
  - Tutte le regole dell'orizzontale ora sono `@media (max-height: 500px)` con `:root[data-screen='landscape']`, al posto di `orientation: landscape`.
- **Compatto con la tastiera** (`max-height: 260px`, schermo orizzontale):
  - `App.vue`: barra in alto nascosta mentre si scrive (classe `editing` su `.app`);
  - `TextDock.vue`: nascosti Elimina e ×N, Fine e Stampa alti 40;
  - `TextProperties.vue`: nascosti simboli, «Adatta automaticamente», avviso di testo troppo lungo e «Altre opzioni»; la casella riempie lo spazio;
  - `MediaPicker.vue`: nascosto «Rotolo rilevato».
- **Verticale piccolo** (`max-height: 480px`, schermo verticale): barra in alto nascosta mentre si scrive.
- **Test:**
  - `landscape.spec.ts` usa `screen` (forma del telefono) oltre a `viewport` (spazio visibile). 17 test, di cui 6 nuovi:
    - tastiera aperta a 915×130 e 873×150: testo e ricerca del formato;
    - verticale piccolo a 360×300: barra nascosta, pannello sotto l'etichetta e non a destra;
    - Pixel in verticale con la tastiera, 412×560: la barra resta;
  - più un test unitario di `screenShape`.
- **Verticale normale:** le 10 schermate di riferimento sono identiche. Nelle due della diagnostica cambia solo la riga con la versione dell'app.

## Correzione dopo la prova sul telefono (2026-11-08)

- **Problema:** con la tastiera vera, Fine e Stampa occupavano lo spazio e non si vedeva cosa si scriveva.
- **Correzione:** con la tastiera aperta (orizzontale, fino a 260 punti) nel pannello resta **solo la casella del testo**, e a sinistra l'etichetta.
  - Fine, Stampa ed Elimina tornano chiudendo la tastiera con il tasto «giù», e il testo resta aperto.
  - Nei pannelli dal basso l'intestazione diventa minima, così la ricerca del formato ci sta anche a 100 punti.
- **Test:**
  - aggiunta l'altezza 915×100;
  - con la tastiera aperta Fine e Stampa sono nascosti;
  - riportando l'altezza a quella senza tastiera ricompaiono, e il testo scritto resta.
