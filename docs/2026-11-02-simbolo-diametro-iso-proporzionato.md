# Simbolo del diametro ISO (⌀) proporzionato al testo

- Data: 2026-11-02
- Stato: **confermato il 2026-11-02**: soluzione A, forma secondo la ISO (vedi §Decisioni)

## Problema

Il simbolo ⌀ (U+2300) non esiste nei caratteri usati dall'app: senza grazie, con grazie e monospaziato di sistema. Il browser lo prende da un altro font, scelto dal sistema, e il risultato varia:
- sul computer di sviluppo esce **molto più piccolo** delle lettere, come si è visto negli screenshot;
- su Android dipende dai font del telefono: può uscire di misura diversa o, nel caso peggiore, come quadratino vuoto.

L'anteprima mostra comunque ciò che verrà stampato, ma il simbolo non è proporzionato al testo.

## Soluzioni possibili

### A. Mini-font con il solo simbolo ⌀ (consigliata)

Creo un piccolo font, di circa 1 KB e scritto da me (licenza MIT come il progetto), che contiene **solo il glifo ⌀**, disegnato come cerchio più barra diagonale e proporzionato come una lettera maiuscola:
- cerchio alto quanto le maiuscole (circa 0,70 della dimensione del carattere, come la «O» dei caratteri più comuni), appoggiato sulla linea di base;
- barra diagonale che sporge leggermente dal cerchio, come nel simbolo tecnico;
- spessore del tratto simile a quello del testo normale; con il grassetto il browser lo ispessisce in automatico.

Viene dichiarato con `@font-face` e `unicode-range: U+2300`, e messo **per primo** nell'elenco dei caratteri di ogni testo. Grazie a `unicode-range`, il browser lo usa **solo per ⌀**; tutte le altre lettere continuano a venire dal carattere scelto.

**Vantaggi:**
- ⌀ ha sempre la stessa misura, proporzionata al testo, su qualunque dispositivo, anche senza connessione;
- elimina il rischio del quadratino vuoto su Android;
- funziona con l'adattamento automatico, l'allineamento e la rotazione senza toccare la loro logica;
- anteprima e stampa restano identiche, perché usano lo stesso motore.

**Limiti:**
- la forma è la stessa con tutti e tre i caratteri: non segue le grazie del carattere con grazie. Per un simbolo geometrico non è un problema;
- il corsivo viene inclinato dal browser: accettabile.

Il font viene generato con uno script (`scripts/make-diameter-font.mjs`) basato su `opentype.js` (MIT), usato solo in sviluppo. Il file generato viene incluso nel progetto, così la build non dipende dallo script.

### B. Disegno del testo «a pezzi»

Sostituire il testo di Konva con un disegno fatto da me, che misura e disegna ⌀ a parte con la dimensione adatta.
- Permetterebbe di regolare ⌀ diversamente per ogni carattere.
- Però bisognerebbe riscrivere a mano a capo, allineamenti e adattamento automatico: molto più codice e rischio di errori.

**Sconsigliata.**

## Cosa farò (con la soluzione A)

1. `scripts/make-diameter-font.mjs` genera `src/assets/fonts/diametro.otf`.
2. In `src/styles/base.css` aggiungo `@font-face { font-family: 'Etichettatrice Diametro'; src: url(...); unicode-range: U+2300; }`.
3. In `render/scene.ts`, il carattere di ogni testo diventa `'Etichettatrice Diametro', <carattere scelto>`, sia nel disegno sia nella misura per l'adattamento automatico.
4. Prima di disegnare o stampare, l'app aspetta che il mini-font sia caricato (come già fa per gli altri font), così la prima anteprima non usa il simbolo sbagliato.
5. Nel pannello, il pulsante «⌀ Diametro ISO» mostra anche lui il simbolo con il mini-font, e la nota «può risultare più piccolo» viene tolta.

## Test

- **Rendering (Chromium):**
  - con lo stesso carattere e la stessa dimensione, l'altezza dell'inchiostro di ⌀ è tra il 90 % e il 110 % di quella della «O», e la larghezza tra l'80 % e il 120 %. Con tutti e tre i caratteri;
  - le altre lettere non cambiano: il bitmap di «Tubo 20» è identico con e senza il mini-font;
  - ⌀ si distingue da Ø, e grassetto e adattamento automatico funzionano.
- **Unitari:** lo script genera un font valido, con un solo glifo mappato su U+2300.
- **E2E:** il pulsante ⌀ inserisce il simbolo e l'anteprima si genera senza errori.
- **Da verificare sul Pixel:** aspetto di ⌀ in Vanadium.

## Decisioni (2026-11-02)

1. Soluzione **A** (mini-font).
2. La forma **deve essere quella ISO**.

### Geometria del simbolo

Le misure del simbolo sono nella norma ISO 3098-2, a pagamento; le anteprime pubbliche delle ISO 3098-0 e 3098-1 non le riportano. Ho quindi **misurato** il glifo ⌀ di [osifont](https://github.com/hikikomori82/osifont), un font open source disegnato secondo la ISO 3098.

Non copio il disegno di osifont, che è GPL e quindi incompatibile con la licenza MIT del progetto: riprendo solo le proporzioni e disegno il glifo da zero. In unità della altezza delle maiuscole (h):

| Elemento | Valore |
|---|---|
| Barra | inclinata di **~75°** sull'orizzontale, passa per il centro del cerchio, va da −0,06 h a 0,95 h, estremità arrotondate |
| Cerchio | diametro esterno **~0,77 h**, centro a 0,44 h dalla linea di base |
| Spessore del tratto | **~0,083 h**, uguale per cerchio e barra |
| Ingombro | avanzamento ~0,90 h, margine sinistro ~0,066 h |

**Da notare:** queste proporzioni vengono da un font che dichiara la conformità alla ISO 3098, non dal testo della norma. Se hai la norma o un disegno di riferimento, le confronto e le correggo.

### Adattamento al carattere del dispositivo

Il glifo è disegnato per un'altezza delle maiuscole di 0,716 em. All'avvio l'app misura l'altezza reale delle maiuscole del carattere scelto sul dispositivo (lettera «H»). Poi registra una variante del mini-font con `size-adjust` tale che ⌀ sia alto esattamente quanto le maiuscole di quel carattere. Ne viene registrata una per ciascun carattere: senza grazie, con grazie, monospaziato, di sistema.

### Criteri di test aggiornati

La larghezza della «O» varia molto da un carattere all'altro, mentre il simbolo ISO ha una larghezza fissa rispetto ad h. Per questo il confronto sulla larghezza viene sostituito da:
- l'altezza totale dell'inchiostro di ⌀ è tra il **95 % e il 112 %** dell'altezza della «H» dello stesso carattere;
- l'inclinazione della barra, misurata sul bitmap, è di **75° ± 4°**.

## Note di implementazione (2026-11-02)

- `scripts/make-diameter-font.mjs` genera `src/assets/fonts/diametro.otf`: 1,9 KB, un solo glifo su U+2300, disegnato da zero con `opentype.js`. Il glifo è un anello più una barra con estremità arrotondate, nelle proporzioni della tabella sopra. Il font è sotto i 4 KB, quindi Vite lo incorpora nel pacchetto: nessuna richiesta di rete in più.
- `src/render/diameter-font.ts` registra una variante per ciascun carattere usato:
  - prima misura l'altezza della «H» sul dispositivo;
  - poi crea la variante con `size-adjust` e `unicode-range: U+2300`.

  La registrazione avviene la prima volta che un testo contiene ⌀. Prima di ogni anteprima o stampa l'app aspetta che la variante sia pronta, e l'editor si ridisegna quando lo diventa.
- Nel pannello, il pulsante «⌀ Diametro ISO» mostra il simbolo con lo stesso font. La nota «può risultare più piccolo» è stata tolta.
- Test:
  - unitari: un solo glifo, proporzioni, file incluso uguale a quello generato dallo script;
  - Chromium, con i caratteri senza grazie, con grazie e monospaziato: altezza tra il 95 % e il 112 % della «H», barra a 75° ± 4°, il grassetto ispessisce il simbolo, le altre lettere restano identiche;
  - e2e: inserimento e anteprima.
- **Bug trovato e corretto durante i test**, preesistente ma emerso solo ora: se si toccava «Collega» subito all'apertura, il ricollegamento automatico in sottofondo poteva creare un secondo collegamento. L'indicatore diceva «Pronta», ma la stampa rispondeva «Stampante non collegata». Ora il collegamento viene creato una sola volta, e il ricollegamento automatico non interferisce con quello manuale. Un nuovo test e2e copre il caso.
- **Da verificare sul Pixel:** aspetto del simbolo in Vanadium, e confronto con la norma ISO 3098-2 se disponibile.

## Modifica successiva (2026-11-02)

Su richiesta dell'utente è stato **tolto il pulsante «Ø Diametro»**: resta un solo pulsante «⌀ Diametro», con il simbolo ISO. I testi che contengono già Ø restano invariati e vengono stampati normalmente.
