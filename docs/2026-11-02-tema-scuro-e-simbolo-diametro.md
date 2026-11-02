# Tema scuro selezionabile e simbolo del diametro

- Data: 2026-11-02
- Stato: **confermato il 2026-11-02** (diametro come Ø; per ora solo il diametro)

## 1. Tema scuro

### Situazione attuale

L'app segue già il tema del sistema (`prefers-color-scheme`): in `src/styles/base.css` i colori sono variabili, ridefinite per il tema scuro. Ho controllato con uno screenshot a 412×915 in modalità scura:
- barre, pulsanti e pannelli diventano scuri correttamente;
- non c'è modo di scegliere il tema a mano;
- alcuni colori dentro il canvas sono fissi e pensati per il chiaro: bordo e maniglie di selezione blu scuro (poco contrasto sul fondo scuro), zona non stampabile rosa chiaro, ombra dell'etichetta invisibile.

### Cosa farò

1. **Scelta del tema** con tre opzioni: **Automatico** (segue il sistema, predefinito), **Chiaro**, **Scuro**.
   - Pulsante con icona nella barra in alto, accanto a «Collega». A ogni tocco passa all'opzione successiva; l'etichetta accessibile dice quella attiva (es. «Tema: scuro»).
   - La scelta resta salvata sul dispositivo (`localStorage`, con `try/catch`: se il salvataggio non è disponibile si torna ad «Automatico»).
   - Viene applicata prima del primo disegno della pagina, per evitare il lampo bianco all'apertura.
2. **CSS:** l'attributo `data-theme="light" | "dark"` sull'elemento `<html>` forza il tema. Senza attributo vale il tema del sistema. Le variabili del tema scuro vengono definite una sola volta e riusate nei due casi.
3. **Canvas dell'editor:** i colori di Konva (selezione, maniglie, area stampabile, zona non stampabile, ombra) vengono letti dalle variabili CSS e ridisegnati quando cambia il tema.
4. **L'etichetta resta bianca** nell'editor e nell'anteprima anche nel tema scuro, perché rappresenta la carta vera. L'immagine di stampa non dipende in nessun modo dal tema.
5. **Barra del browser:** il `meta theme-color` si aggiorna con il tema, così la barra di stato di Android si abbina.

### Test

- Test e2e: il pulsante cicla Automatico → Chiaro → Scuro, la scelta sopravvive al ricaricamento della pagina, e in tema scuro lo sfondo della pagina è scuro.
- Test di rendering: lo stesso documento produce lo stesso bitmap di stampa con tema chiaro e scuro.
- Controllo a vista con screenshot a 412×915 in entrambi i temi.

## 2. Simbolo del diametro

### Il problema dei caratteri

Esistono due caratteri:

| Carattere | Codice | Pro | Contro |
|---|---|---|---|
| **⌀** | U+2300, "diameter sign" | È il simbolo tecnicamente corretto (ISO). | Molti font non lo contengono. Il browser lo prende da un altro font: nello screenshot esce **più piccolo** del testo. Su Android dipende dai font di sistema e potrebbe uscire come quadratino vuoto. |
| **Ø** | U+00D8, lettera O barrata | È in tutti i font, ha la dimensione delle maiuscole e si stampa sempre. È l'uso più comune su etichette e cartellini. | Tecnicamente è una lettera, non il simbolo. |

Anteprima e stampa sono sempre identiche, quindi il rischio non è stampare qualcosa di diverso dall'anteprima, ma ottenere un simbolo brutto o mancante.

### Cosa farò (proposta)

1. Nel pannello **Testo**, sotto la casella del testo, un pulsante grande **Ø Diametro**. Altri simboli (° ± × µ ² ³) sono rimandati.
2. Il tocco inserisce il simbolo **nella posizione del cursore**, non solo in fondo, e lascia il cursore dopo il simbolo.
3. **Carattere inserito:** **Ø** (U+00D8).
4. I simboli sono normali caratteri del testo: si salvano, si modificano e si cancellano come gli altri.

### Test

- Test unitario della funzione di inserimento: inizio, metà e fine del testo, con selezione attiva.
- Test di rendering: un testo con «Ø 8 mm» produce punti neri, e la larghezza del simbolo è simile a quella di una «O» maiuscola dello stesso font.
- Test e2e: tocco su Ø → il testo contiene il simbolo nella posizione del cursore.

## 3. File coinvolti

- `src/styles/base.css`: variabili per i due temi e `data-theme`.
- `src/theme.ts` (nuovo): lettura, salvataggio e applicazione del tema.
- `index.html`: piccolo script inline che applica il tema salvato prima del caricamento.
- `src/components/PrinterBar.vue`: pulsante del tema.
- `src/components/LabelEditor.vue`: colori del canvas dalle variabili CSS e ridisegno al cambio di tema.
- `src/components/TextProperties.vue` e `src/model/text.ts` (nuovo): pulsante del diametro e funzione di inserimento.
- Test in `tests/unit`, `tests/browser` e `tests/e2e`.

## 4. Decisioni (2026-11-02)

1. Il diametro si inserisce come **Ø** (U+00D8).
2. Per ora solo il diametro.

## 5. Note di implementazione (2026-11-02)

- I colori usano la funzione CSS `light-dark()`, quindi ogni colore è definito una volta sola. Serve Chromium 123 o successivo; Vanadium segue le versioni recenti di Chromium. Il canvas non sa leggere `light-dark()`, perciò `cssColor()` in `src/theme.ts` risolve il colore applicandolo a un elemento di prova.
- Il pulsante del tema è nella barra in alto e mostra ◐ (automatico), ☀ (chiaro) o ☾ (scuro). La scelta è salvata in `localStorage` con la chiave `etichettatrice.tema`.
- Il pulsante «Ø Diametro» inserisce U+00D8 nella posizione del cursore e lascia il cursore dopo il simbolo.
- Correzione collegata: il testo dentro caselle e menu usava il grigio dell'etichetta del campo; ora usa il colore normale del testo.
- Test aggiunti: 12 unitari e di rendering (Ø stampato con larghezza simile a una O nei tre font, bitmap di stampa identico con tema chiaro e scuro) e 3 e2e (ciclo del tema, persistenza dopo il ricaricamento, tema automatico che segue il sistema, inserimento di Ø nella posizione del cursore).
