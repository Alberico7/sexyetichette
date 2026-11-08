# Uso in orizzontale

- Data: 2026-11-08
- Stato: **confermato e realizzato (2026-11-08)**, da provare sul telefono con la tastiera aperta

## Perché

Il 2026-11-08 ho controllato l'app in orizzontale alle misure del Pixel 7a (915×412) e del Realme (873×393), e a 915×340. 340 px è l'altezza reale del Pixel in orizzontale, una volta tolte la barra del browser e quella di Android.

Funziona già:
- nessuno scorrimento orizzontale;
- l'editor a riposo: etichetta grande, barra dei pulsanti intera.

Problemi trovati:

1. **Modifica del testo (grave).**
   - Il pannello del testo prende quasi tutta l'altezza: a 340 px «Elimina / Fine / Stampa» escono in parte dallo schermo, e ⌀ Diametro, AFKEUR e N. R. sono coperti.
   - L'etichetta sopra diventa una miniatura.
   - Con la tastiera del telefono aperta lo spazio è ancora meno.
2. **Pannelli dal basso (medio): anteprima, quante copie, formato, diagnostica, recenti.**
   - Sono una colonna stretta al centro, pensata per il verticale.
   - Il pulsante principale resta sotto e bisogna scorrere: «Stampa N copie» è a 454 px di altezza su 340, «Stampa» dell'anteprima a 603 px.
3. **Difetti minori (solo in orizzontale).**
   - La scritta «Tocca «+ Testo» per scrivere sull'etichetta» si sovrappone al bordo inferiore dell'etichetta.
   - Il pulsante del formato copre un pezzo del bordo superiore.

## Quando vale

Solo con lo schermo **più largo che alto e basso**:

```css
@media (orientation: landscape) and (max-height: 500px)
```

**In verticale non cambia niente:** stesse regole di oggi, verificate dai test e2e esistenti, che girano tutti a 412×915. Anche tablet e computer, più alti di 500 px, restano come oggi.

## Cosa cambia

### 1. Testo: pannello a destra

- Il pannello del testo diventa una **colonna a destra**, larga circa metà schermo (al massimo 460 px) e alta quanto lo spazio sotto la barra in alto.
- **L'etichetta resta a sinistra**, grande, e si continua a vedere cosa si scrive.
- Nel pannello:
  - in alto la casella del testo e i pulsanti ⌀ / AFKEUR / N. R.;
  - poi «Adatta automaticamente» e «Altre opzioni», che scorrono;
  - **in fondo, sempre visibili, Elimina / Fine / Stampa ×1.**
- La barra dei pulsanti in basso (+ Testo, Recenti…) è nascosta mentre il pannello è aperto, come oggi.
- **La barra in alto** si abbassa da circa 70 a circa 56 px: logo da 32 px e meno margine. Pulsanti comunque alti almeno 44 px, per il pollice.

### 2. Pannelli a due colonne

I pannelli che si aprono dal basso usano tutta l'altezza disponibile, con un'intestazione più bassa.

| Pannello | In orizzontale |
|---|---|
| **Anteprima e stampa** | A sinistra l'etichetta; a destra misure, copie, densità e **Stampa** in fondo, sempre visibile. |
| **Quante copie?** | A sinistra il numero grande e **«Stampa N copie»**; a destra il tastierino 3×4, con i tasti un po' più bassi (almeno 48 px). |
| **Formato, Diagnostica, Recenti** | Una colonna, più larga (fino a 720 px), alta quanto lo schermo. Sono elenchi da scorrere: due colonne non aiuterebbero. |

### 3. Difetti minori

- Il pulsante del formato e la scritta d'aiuto si spostano **fuori dall'etichetta**: il formato sopra, la scritta sotto.
- L'etichetta si rimpicciolisce quel poco che serve per farci stare entrambi.

## Dove

- `src/components/TextDock.vue`: disposizione a colonna in orizzontale.
- `src/App.vue`: editor e pannello del testo affiancati in orizzontale.
- `src/components/PrinterBar.vue` e `StatusLogo.vue`: barra più bassa in orizzontale.
- `src/components/BottomSheet.vue`: altezza piena e intestazione bassa in orizzontale.
- `src/components/PrintSheet.vue` e `src/components/CopiesPicker.vue`: due colonne in orizzontale.
- `src/components/LabelEditor.vue` (o il suo contenitore): spazio per il pulsante del formato e per la scritta d'aiuto.

Tutto in CSS con la media query indicata sopra, senza logica nuova.

## Cosa non cambia

- Il **verticale**.
- Le funzioni: stessi pulsanti, stessi pannelli, stessi passaggi.

## Test

- **E2E nuovi** (`tests/e2e/landscape.spec.ts`) a **915×340** e **873×393**:
  - testo in modifica: Elimina, Fine e Stampa sono interi e dentro lo schermo; anche ⌀, AFKEUR e N. R. sono visibili; l'etichetta sta a sinistra del pannello, senza sovrapposizioni;
  - anteprima: «Stampa» è visibile senza scorrere;
  - copie: «Stampa N copie» e tutti i tasti 0–9 sono visibili senza scorrere; 2 → 4 → stampa dà 24 copie;
  - formato e scritta d'aiuto non si sovrappongono all'etichetta;
  - nessuno scorrimento orizzontale;
  - screenshot nei due temi.
- **Verticale invariato:** tutti gli e2e esistenti passano. Confronto a vista delle schermate verticali prima e dopo.
- **A vista sul telefono:** orizzontale con la tastiera aperta, che non si può simulare qui.

## Note di implementazione (2026-11-08)

- **Media query:** `(orientation: landscape) and (max-height: 500px)` in ogni componente toccato.
- **Contenitori nuovi, invisibili in verticale** (`display: contents`):
  - `.stage` in `App.vue`, attorno a editor e pannello del testo / barra dei pulsanti;
  - `.print-sheet` con `.ps-preview` e `.ps-controls` in `PrintSheet.vue`;
  - `.copies-picker` in `CopiesPicker.vue`.
- **Testo:** il pannello è largo `min(460px, 52vw)` a destra, ed Elimina, Fine e Stampa ×1 stanno sempre in fondo.
- **Barra in alto:** logo da 32 px, pulsanti da 44 px, margini da 4 px.
- **Pannelli:** larghi fino a 720 px, alti quanto lo schermo meno 6 px, intestazione bassa.
  - «Stampa» dell'anteprima è *sticky* in fondo alla colonna destra.
- **Editor:** il formato e la scritta d'aiuto non sono più sovrapposti, ma sopra e sotto l'etichetta (colonna flex).
- **Test:**
  - `tests/e2e/landscape.spec.ts`, 11 test a 915×340 e 873×393, più una schermata nel tema scuro;
  - **verticale:** le 10 schermate di `theme-screens.spec.ts` (temi chiaro e scuro) sono identiche byte per byte prima e dopo la modifica, e tutti gli e2e esistenti passano.
- **Da verificare sul telefono:** orizzontale con la tastiera aperta.
