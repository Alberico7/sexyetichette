# Adattamento automatico della dimensione del testo

- Data: 2026-11-02
- Stato: **confermato il 2026-11-02**

## Obiettivo

Un'opzione **«Adatta automaticamente»** accanto alla dimensione del carattere: il testo prende la dimensione più grande che entra nel suo riquadro. Se si ridimensiona il riquadro o si cambia il testo, la dimensione si aggiorna da sola.

## Comportamento proposto

1. Nel pannello **Testo**, sotto «Carattere» e «Dimensione (pt)», compare l'interruttore **Adatta automaticamente**.
2. **Attivo:**
   - la dimensione viene calcolata e il campo «Dimensione» mostra il valore calcolato in sola lettura (es. «24 pt (auto)»);
   - **ogni riga resta come l'hai scritta**: il testo va a capo solo dove hai premuto Invio, non si spezza da solo. È il comportamento più prevedibile per le etichette: «Tubo Ø 20» resta su una riga e diventa più piccolo se il riquadro è stretto;
   - la dimensione scelta è la più grande per cui **la riga più lunga sta nella larghezza** e **tutte le righe stanno nell'altezza** del riquadro;
   - grassetto, corsivo, carattere, bianco su nero e allineamento continuano a funzionare;
   - limiti: minimo 4 pt e massimo 200 pt. Se il testo non entra nemmeno a 4 pt, resta a 4 pt e compare l'avviso «Il testo non entra nel riquadro».
3. **Disattivo:** comportamento attuale. La dimensione la scegli tu e il testo va a capo automaticamente sulla larghezza del riquadro. Quando disattivi, il campo riparte dall'ultima dimensione calcolata, così il testo non salta.
4. **Nuovi testi:** propongo che l'adattamento sia **attivo di predefinito**: aggiunto un testo, riempie subito il riquadro.

## Come lo realizzo

- **Modello:** nuovo campo `autoFit: boolean` in `TextElement`. Il valore predefinito per gli elementi già esistenti è `false`, così non cambiano.
- **Calcolo:** funzione pura `fitFontSize(lines, box, measure)` in `src/render/fit.ts`, con ricerca binaria sulla dimensione e passo di 0,5 pt.
  - La misura usa lo stesso motore del disegno: la larghezza di ogni riga si misura con Konva, con lo stesso carattere, stile e interlinea (1,1) usati per disegnare.
  - Il calcolo avviene in `render/scene.ts` al momento della costruzione della scena, quindi editor, anteprima e stampa usano **la stessa dimensione**. Prima del calcolo aspetto il caricamento dei font, come già succede per la stampa.
  - Il riquadro ha un piccolo margine interno di sicurezza (2 %), così i caratteri con code o accenti non toccano il bordo.
- **Editor:** durante il ridimensionamento con le maniglie il testo si allarga o si stringe; la dimensione definitiva viene ricalcolata al rilascio.
- **Pannello:** con l'opzione attiva, il campo dimensione mostra il valore calcolato e non è modificabile.

## Test

- **Unitari:**
  - `fitFontSize` con una misura finta: una riga lunga è limitata dalla larghezza, molte righe sono limitate dall'altezza;
  - limiti a 4 e 200 pt, testo vuoto, riquadro minuscolo;
  - il risultato è monotono (un riquadro più grande non dà mai un testo più piccolo).
- **Rendering (Chromium):**
  - con l'opzione attiva l'inchiostro sta dentro il riquadro e ne occupa la larghezza o l'altezza per almeno il 90 %;
  - raddoppiando la larghezza del riquadro di un testo su una riga, la dimensione cresce;
  - lo stesso documento dà lo stesso bitmap in anteprima e in stampa.
- **E2E (412×915):** si attiva l'opzione, si scrive un testo lungo, la dimensione mostrata diminuisce, l'anteprima si genera senza errori.

## File coinvolti

- `src/model/types.ts`, `src/model/document.ts`: campo `autoFit` e valore predefinito.
- `src/render/fit.ts` (nuovo) e `src/render/scene.ts`: calcolo e uso della dimensione.
- `src/components/TextProperties.vue`: interruttore e dimensione calcolata.
- Test in `tests/unit`, `tests/browser` e `tests/e2e`.

## Decisioni (2026-11-02)

1. Con l'adattamento attivo il testo va a capo **solo dove si preme Invio**.
2. L'adattamento è **attivo di predefinito** sui nuovi testi.
3. Richiesta aggiuntiva: un secondo pulsante per il simbolo del diametro **⌀** (U+2300), accanto a **Ø**.
   - Inserisce il carattere così com'è.
   - Come visto in precedenza, molti font non contengono ⌀: il browser lo prende da un altro font, e può risultare più piccolo del testo o, su alcuni dispositivi, mancare. L'anteprima mostra comunque esattamente ciò che verrà stampato.
   - Il pulsante riporta l'avviso breve «può risultare più piccolo».
   - Test: in Chromium ⌀ produce inchiostro e si distingue da Ø.

## Note di implementazione (2026-11-02)

- Il calcolo è in `src/render/fit.ts`: ricerca binaria a passi di 0,5 pt, tra 4 e 200 pt, con margine interno del 2 % per lato. La misura delle righe usa `Konva.Text.measureSize`, cioè lo stesso motore che disegna il testo. `resolveFontSize()` in `render/scene.ts` è l'unico punto che decide la dimensione, e lo usano editor, anteprima, stampa e pannello.
- Con l'adattamento attivo il nodo Konva usa `wrap: 'none'`, quindi le righe sono solo quelle scritte con Invio.
- Il campo `autoFit` è facoltativo nel modello: se manca, l'opzione è disattivata, quindi i documenti creati prima restano invariati.
- Disattivando l'opzione, la dimensione riparte dal valore calcolato.
- Il pulsante «⌀ Diametro ISO» inserisce U+2300. Un'indicazione al passaggio del puntatore avvisa che con alcuni caratteri può risultare più piccolo.
- Test aggiunti: 7 unitari (larghezza, altezza, limiti, testo vuoto, monotonia, passi, valore predefinito), 8 di rendering (riempimento entro il riquadro, nessun a capo automatico, crescita con la larghezza, due righe, dimensione fissa, testo che non entra, determinismo, ⌀) e 2 e2e.
