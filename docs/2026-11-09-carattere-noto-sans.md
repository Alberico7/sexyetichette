# Carattere Noto Sans per le etichette

- Data: 2026-11-09
- Stato: **confermato e realizzato (2026-11-09)**

## Perché

L'utente vuole un carattere simile a **Segoe UI**, soprattutto **nei numeri**.

Segoe UI non si può includere: è di Microsoft, con licenza chiusa, e sui telefoni Android non c'è.

## La ricerca (2026-11-09)

Ho disegnato le cifre 0–9 con Segoe UI, installato sul computer, e con sette caratteri liberi, a parità di altezza delle maiuscole. Poi ho misurato quanto si sovrappongono:

| Carattere | Normale | Grassetto |
|---|---|---|
| Selawik | 85 % | 86 % |
| **Noto Sans** | 83 % | **91 %** |
| Open Sans | 82 % | 90 % |
| Roboto | 76 % | 84 % |
| Inter, Source Sans 3, Lato | 70–78 % | 74–82 % |

**Scelta dell'utente: Noto Sans.**
- Con il grassetto, che è il default dell'app, ha le cifre più simili a Segoe UI.
- Le cifre sono un po' più larghe: circa il 4 % nel normale.
- Su tutte le lettere e i numeri insieme, Noto Sans è secondo dopo Selawik: 83 % contro 88 %.

## Cosa cambia

1. **Nuova voce** in «Altre opzioni → Carattere»: **«Noto Sans (simile a Segoe UI)»**, dopo «Tecnico ISO 3098».
2. **Il carattere è incluso nell'app**, con quattro file:
   - normale, grassetto, corsivo, grassetto corsivo;
   - solo l'alfabeto latino, accenti italiani compresi;
   - **circa 13 KB l'uno**.
   - Così è identico su ogni telefono e in stampa, e non dipende da Internet una volta scaricato.
3. **Si scarica solo al primo uso**, come il carattere ISO:
   - non rallenta l'avvio;
   - prima di stampare l'app aspetta che sia pronto, come già fa per ISO.
4. **I simboli ⌀, ∅ e ♥** con Noto Sans vengono, come per gli altri caratteri, dal mini-font dell'app, che si adatta all'altezza delle sue maiuscole.
5. **Il carattere dei nuovi testi resta ISO 3098.** Noto Sans si sceglie testo per testo.

## Dove

- `src/assets/fonts/`: i quattro file `noto-sans-latin-{400,700}-{normal,italic}.woff2`, presi dal pacchetto `@fontsource/noto-sans` (versione fissa), copiati una volta e non scaricati a ogni build.
- `public/licenses/noto-sans/OFL.txt`: la licenza SIL Open Font License 1.1, che va distribuita con il carattere.
- `src/model/fonts.ts`:
  - `NOTO_SANS_FACE = 'Etichettatrice Noto Sans'`;
  - `NOTO_SANS = '"Etichettatrice Noto Sans", sans-serif'`;
  - la nuova voce in `FONT_OPTIONS`.
- `src/render/web-fonts.ts`: registra le quattro varianti con il peso e lo stile giusti, come già fa per ISO.

## Cosa non cambia

- Gli altri caratteri e il default ISO.
- Le etichette già fatte.

## Test

- **Unitari:** la nuova voce c'è in `FONT_OPTIONS`; i file dei font e la licenza esistono.
- **Browser (rendering):**
  - un testo in Noto Sans viene disegnato con Noto Sans e non con il carattere di riserva: la larghezza di «0123456789» corrisponde a quella attesa;
  - il grassetto è più pieno del normale;
  - ⌀ resta alto quanto le maiuscole.
- **E2E:**
  - si sceglie «Noto Sans (simile a Segoe UI)», l'anteprima si aggiorna e la stampa simulata va a buon fine;
  - la scelta resta salvata riaprendo il testo.
- **Da verificare sulla carta:** i numeri in grassetto.

## Note di implementazione (2026-11-09)

- **File:**
  - i quattro woff2 latini da `@fontsource/noto-sans` 5.1.1, da 13,1 a 13,9 KB l'uno;
  - licenza in `public/licenses/noto-sans/`, con `OFL.txt` e `README.txt` sull'origine;
  - una riga nel README del progetto.
- **Registrazione:** `registerNotoSans()` in `src/render/web-fonts.ts` aggiunge le quattro varianti (`weight` 400/700, `style` normal/italic). Il browser scarica solo quella che serve, quando serve.
- **Test:**
  - 2 unitari: posizione nell'elenco, default ISO invariato, file woff2 sotto i 20 KB, licenza presente;
  - 4 di rendering:
    - la stampa usa il font vero, in tre varianti;
    - le proporzioni delle cifre sono quelle che il browser misura per Noto Sans;
    - il grassetto è più pieno;
    - ⌀ è alto come le maiuscole.
    - Senza la registrazione del font, 2 su 4 falliscono.
  - 1 e2e:
    - il font non viene scaricato all'avvio;
    - scegliendo Noto Sans si scarica il grassetto;
    - anteprima e stampa simulata vanno a buon fine;
    - la scelta resta sul testo.
