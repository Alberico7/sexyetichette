# Carattere tecnico ISO 3098 per lettere e numeri

- Data: 2026-11-04
- Stato: **confermato e realizzato**, come carattere predefinito

## Cosa

Nel pannello Testo, alla voce *Carattere*, oltre a «Senza grazie», «Con grazie» e «Monospaziato» compare **«Tecnico ISO 3098»**. È la scrittura dei disegni tecnici: lettere e numeri a tratto uniforme, come nei cartigli.

## Quale font

**Proposta: osifont** (https://github.com/hikikomori82/osifont).
- È un font libero disegnato apposta per rispettare la ISO 3098: è nato perché i CAD gratuiti non avevano un font conforme.
- Il simbolo ⌀ dell'app è stato misurato proprio da osifont, quindi lettere e simbolo hanno lo stesso stile, con la barra a 75°.
- È un file TrueType pronto: il browser lo usa direttamente, sia per l'editor sia per la stampa a 300 dpi.
- **Copertura:** 931 glifi. Ho controllato:
  - tutte le lettere maiuscole e minuscole e le cifre;
  - le accentate italiane (à è é ì ò ù, À È É Ì Ò Ù);
  - punteggiatura, parentesi, `+ − = / % ° ± × ⌀ Ø € & @ #`.

  Non manca niente.
- **Licenza:** uso il file `osifont-lgpl3fe.ttf`, cioè LGPL 3 con *font exception*. Si può distribuire insieme all'app, che è MIT, e le etichette stampate non hanno vincoli. Metto il testo della licenza accanto al file e una nota nel README, con il link ai sorgenti.

### Perché non i file SVG di Wikimedia Commons

I file «ISO 3098» in SVG che si trovano su Commons, e simili raccolte di pubblico dominio, sono **disegni delle lettere a linea singola**, cioè il centro del tratto, oppure *font SVG*. I browser attuali non usano i font SVG nei testi. Per usarli bisognerebbe convertire ogni lettera in un font vero, ingrossando il tratto, e disegnare a mano spaziature e coppie di lettere. È molto lavoro, con un risultato peggiore di osifont, che è già un font completo e con la spaziatura sistemata.

Non ho aperto il file specifico che hai visto. Se mi mandi il link lo controllo, e se ha qualcosa che osifont non ha te lo dico.

## Come

- **File:**
  - `src/assets/fonts/osifont-lgpl3fe.ttf`, preso dall'ultima versione del repository (commit `2e9aa86`, 2026-04-16), con `OSIFONT-LICENSE.txt` accanto;
  - circa 124 KB.
- **Caricamento solo quando serve:**
  - il font è dichiarato con `@font-face` ma il browser lo scarica **solo** quando un testo lo usa, quindi l'avvio dell'app non rallenta;
  - dopo il primo uso resta nella cache del browser.
- **Stampa:**
  - prima di disegnare l'etichetta a 300 dpi l'app aspetta già che i font dei testi siano caricati (`waitForFonts`), quindi la stampa usa sempre il font vero e mai un sostituto;
  - l'adattamento automatico della dimensione funziona come per gli altri caratteri.
- **Grassetto e corsivo:**
  - osifont ha solo il peso normale, quindi grassetto e corsivo li simula il browser: il grassetto ispessisce il tratto, il corsivo lo inclina;
  - la scrittura inclinata della ISO 3098 è a 75°, e il corsivo simulato del browser è molto vicino.
- **⌀:** con questo carattere il simbolo continua a venire dal mini-font del diametro, che è lo stesso disegno di osifont. Non cambia niente.
- **Dove compare:** nella scelta *Carattere* del pannello Testo. È il carattere predefinito dei nuovi testi (vedi *Decisione*).
- Le etichette salvate e le *Recenti* ricordano il carattere come oggi.

## Test

- **Unitari:**
  - il file è presente e leggibile;
  - contiene tutti i caratteri dell'elenco sopra.
- **Rendering (Chromium):**
  - un testo in «Tecnico ISO 3098» viene stampato con osifont e non con un sostituto: il bitmap è diverso da quello di «Senza grazie»;
  - l'adattamento automatico entra nel riquadro;
  - ⌀ resta alto quanto le maiuscole.
- **E2E (412×915):**
  - scelgo «Tecnico ISO 3098», scrivo «Tubo ⌀20 AFKEUR» e controllo che anteprima e stampa simulata siano coerenti;
  - nessuno scorrimento orizzontale.
- **Build e prestazioni:**
  - il font non finisce nel JavaScript principale;
  - all'avvio non viene scaricato;
  - le prove di digitazione e apertura dell'anteprima restano nei limiti.

## Decisione

«Tecnico ISO 3098» è il **carattere predefinito** dei nuovi testi (risposta dell'utente, 2026-11-04). Le etichette già salvate mantengono il loro carattere.

## Note di implementazione (2026-11-04)

- **File:** `src/assets/fonts/osifont-lgpl3fe.woff` (78 KB), cioè la versione WOFF ufficiale dello stesso commit, non modificata. Licenza e avviso in `public/licenses/osifont/`, che viene pubblicata con il sito.
- **Registrazione:** il font è registrato con `FontFace` in `src/render/web-fonts.ts` invece che con `@font-face` nel CSS, così è disponibile anche nei test di rendering.
- **Caricamento:**
  - dato che è il predefinito, viene scaricato in sottofondo dopo il primo disegno dell'app, così è pronto al primo «+ Testo»;
  - il canvas non avvia da solo il caricamento di un font, quindi lo chiede `requestFont()`, e l'editor si ridisegna quando il font arriva.
- **Elenco dei caratteri:** «Tecnico ISO 3098» è il **primo** dell'elenco, non l'ultimo come scritto nella proposta, perché è il predefinito. Elenco in `src/model/fonts.ts`.
- **Test:**
  - 3 unitari: file, licenza, copertura dei caratteri, predefinito;
  - 3 di rendering: font vero in stampa, adattamento automatico, ⌀ alto come le maiuscole e barra a 75° anche con osifont;
  - 1 e2e: predefinito, scaricato, anteprima diversa da «Senza grazie».

  Tutti i test passano, comprese le prestazioni. Il JavaScript principale cresce di 0,3 KB compressi; il font è un file a parte.

## Correzione: testo ISO più in alto degli altri (2026-11-04)

- **Problema segnalato:** a parità di riquadro, il «Tecnico ISO 3098» stava più in alto degli altri caratteri.
- **Causa misurata:** osifont dichiara uno spazio sopra le lettere di 0,75 em e sotto di 0,34 em. È molto sbilanciato: per gli altri font è circa 0,9 e 0,2. Konva centra questo spazio, non le lettere, quindi con un testo a 40 pt le maiuscole uscivano **28 punti (≈ 2,4 mm) più in alto** del centro. Con gli altri caratteri lo scarto era di 1–3 punti.
- **Correzione:** per ogni carattere e stile misuro altezza delle maiuscole e spazio dichiarato, e sposto il testo in modo che le **maiuscole** siano centrate sulla riga (`verticalShiftEm` in `src/render/scene.ts`). Vale per editor, anteprima e stampa, e per allineamento in alto, al centro e in basso.
- La regola è la stessa per tutti i caratteri, quindi anche «Senza grazie», «Con grazie» e «Monospaziato» si spostano, di 1–2 punti al massimo (circa 0,1 mm).
- **Test** in `tests/browser/vertical-center.test.ts`:
  - con tutti i caratteri, normale e grassetto, le maiuscole sono al centro del riquadro entro 4 punti;
  - allineando in alto e in basso, ISO e «Senza grazie» stanno alla stessa altezza entro 8 punti.

  Dopo la correzione lo scarto misurato è di 1–1,5 punti per tutti i caratteri.
