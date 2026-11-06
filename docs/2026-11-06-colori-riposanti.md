# Colori del tema più riposanti

- Data: 2026-11-06
- Stato: **realizzato e approvato a vista (2026-11-06)**

## Perché

I colori di oggi sono molto contrastati:

- **tema chiaro:** testo quasi nero (`#111827`) su grigio quasi bianco;
- **tema scuro:** testo quasi bianco su nero quasi puro (`#111318`);
- in entrambi il contrasto del testo è di circa **16:1**;
- l'azzurro dei pulsanti principali è saturo (`#1d4ed8` / `#3b82f6`).

Sullo schermo OLED del Pixel 7a, soprattutto la sera in laboratorio, questo affatica la vista. L'utente chiede colori meno fastidiosi.

## Cosa cambia

Colori **attenuati e leggermente caldi**:

- il testo principale non è più nero puro su bianco, né bianco su nero, e quindi abbaglia meno;
- **tutto il testo resta ad almeno 7:1** (soglia WCAG AAA): testo secondario, scritte sui pulsanti, colori di stato. Richiesta dell'utente del 2026-11-06.

Contrasti calcolati sul fondo **meno favorevole** fra fondo, pannelli e pannelli secondari.

### Tema chiaro: «carta»

| Colore | Oggi | Nuovo | Contrasto oggi | Contrasto nuovo |
|---|---|---|---|---|
| Fondo | `#f3f4f6` | `#efece6` (grigio caldo) | — | — |
| Pannelli | `#ffffff` | `#f8f6f1` (bianco sporco) | — | — |
| Pannelli secondari | `#f9fafb` | `#f2efe9` | — | — |
| Testo | `#111827` | `#2e2c29` (grafite) | 17,7 | **11,8** |
| Testo secondario | `#6b7280` | `#4f4c46` | 4,8 | **7,3** |
| Accento (testo e pulsanti) | `#1d4ed8` | `#274e76` (blu ardesia) | 6,7 | **7,3** |
| Scritta bianca sui pulsanti blu | | | 6,7 | **8,6** |
| OK | `#15803d` | `#205636` | 5,0 | **7,3** |
| Avviso | `#b45309` | `#6f420e` | 5,0 | **7,2** |
| Errore | `#b91c1c` | `#843131` | 6,5 | **7,2** |
| Bordi | `#d1d5db` | `#cfcac0` | — | — |

### Tema scuro: «crepuscolo»

| Colore | Oggi | Nuovo | Contrasto oggi | Contrasto nuovo |
|---|---|---|---|---|
| Fondo | `#111318` | `#1c1e22` (antracite, non nero) | — | — |
| Pannelli | `#1c1f26` | `#24272c` | — | — |
| Pannelli secondari | `#232730` | `#2b2e34` | — | — |
| Testo | `#f3f4f6` | `#e0ddd5` (avorio) | 15,0 | **10,0** |
| Testo secondario | `#9ca3af` | `#c1bdb7` | 6,5 | **7,3** |
| Accento (testo e pulsanti) | `#3b82f6` | `#a6c0df` (azzurro polvere) | 4,7 | **7,3** |
| Scritta sui pulsanti azzurri | bianca | scura `#16202c` | 3,7 | **8,8** |
| OK | `#22c55e` | `#93c9a6` | 8,0 | **7,2** |
| Avviso | `#f59e0b` | `#e0b77b` | 7,8 | **7,3** |
| Errore | `#f87171` | `#ebaeae` | 6,3 | **7,3** |
| Bordi | `#374151` | `#41454d` | — | — |

Il fondo non è nero puro: sugli OLED il nero assoluto accanto al testo chiaro crea un effetto di sbavatura quando si scorre, e affatica di più.

**Testo disattivato:** i pulsanti non disponibili (per esempio «−» con 1 copia) restano più chiari apposta, per far capire che non si possono usare. Le linee guida WCAG li escludono dal requisito di contrasto, quindi restano come oggi.

**Bordi dei pulsanti:** non sono testo e oggi hanno contrasto basso, circa 1,5:1. Portarli a 3:1, la soglia WCAG per i contorni dei controlli, li renderebbe molto più marcati (`#928770` nel chiaro, `#707784` nello scuro) e l'interfaccia più «pesante». Propongo di lasciarli tenui; si possono rinforzare se servono.

### Colori dell'editor

- **Selezione, contorno dell'area stampabile, zona non stampabile e strisce di sicurezza:** stesse tinte dell'accento e dell'errore, attenuate.
- **L'etichetta** nell'editor e nell'anteprima resta **bianca con il nero vero**, perché deve mostrare esattamente cosa si stampa.
- **Nel tema scuro** il bianco dell'etichetta è molto luminoso accanto al fondo scuro. Propongo di attenuarlo leggermente **solo nell'editor** (`#e9e6df`, carta un po' grigia), lasciando bianca pura l'**anteprima di stampa**, che deve restare fedele. È una scelta da confermare: si può anche lasciare tutto bianco.

## Dove

- `src/styles/base.css`: i colori stanno tutti nelle variabili `--…` con `light-dark()`, quindi il cambio è quasi tutto qui.
- `src/components/LabelEditor.vue`: il colore di riserva della selezione (`#1d4ed8`) e il fondo dell'etichetta nel tema scuro.
- Le ombre e il velo dietro i pannelli (`BottomSheet`, `TextDock`, `PrintSheet`) diventano un po' più morbide.

## Cosa non cambia

- Disposizione, testi, dimensioni dei pulsanti.
- La stampa: i colori dell'interfaccia non entrano nel bitmap. C'è già un test che lo verifica, «stesso bitmap con tema chiaro e scuro».
- Il pulsante del tema (automatico, chiaro, scuro).

## Test

- **Unitari:** un piccolo controllo calcola il contrasto WCAG delle coppie testo/fondo dalle variabili in `base.css`, per entrambi i temi:
  - tutte le coppie di testo ≥ 7:1: testo principale, testo secondario, accento, OK, avviso ed errore su fondo, pannelli e pannelli secondari, più la scritta sui pulsanti principali.
  - Così una modifica futura che peggiora la leggibilità fa fallire i test.
- **Rendering:** la stampa resta identica con tema chiaro e scuro (test esistente).
- **E2E:**
  - screenshot di editor, pannello del testo, anteprima e diagnostica, nei due temi, da confrontare a vista;
  - nessuno scorrimento orizzontale.

## Note di implementazione (2026-11-06)

- **Colori:** variabili in `src/styles/base.css`, con i valori delle tabelle sopra. Nuove variabili:
  - `--paper`: l'etichetta nell'editor, `#e9e6df` nel tema scuro. L'anteprima di stampa resta bianca;
  - `--accent-text` diverso per tema: scritta scura sui pulsanti azzurri nel tema scuro.
- **Colori del browser che restavano accesi, ora presi dal tema:**
  - la casella di spunta (`accent-color`);
  - la selezione del testo (`::selection`);
  - il riquadro celeste che compariva su «Altre opzioni» dopo un tocco: era la selezione della scritta, ora `summary` non è selezionabile.
- **Altro:**
  - barra del browser (`theme-color`) con il colore dei pannelli;
  - velo e ombre dei pannelli più morbidi.
- **Test:**
  - `tests/unit/theme-contrast.test.ts`, 16 controlli: tutto il testo ≥ 7:1 e testo principale ≤ 13:1, nei due temi;
  - `tests/e2e/theme-screens.spec.ts` salva le schermate principali nei due temi (cartella `SCREENS_DIR`). Le schermate prima e dopo sono state confrontate a vista.
- **Reversibilità:** tutto in un commit; per tornare ai colori di prima basta annullarlo.
