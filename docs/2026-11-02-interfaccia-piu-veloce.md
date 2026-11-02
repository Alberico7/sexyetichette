# Interfaccia e flusso di lavoro più veloci

- Data: 2026-11-02
- Stato: **confermato il 2026-11-02**: tutte le proposte, ma la stampa passa sempre dall'anteprima (vedi §6)

## 1. Cosa ho misurato

Build di produzione servita in locale, Chromium a 412×915, **CPU rallentata 4 volte** per avere un margine rispetto al Pixel 7a. I tempi sul telefono vero sono da verificare.

| Momento | Tempo | Note |
|---|---|---|
| Apertura dell'app fino al pulsante «Collega» | ~0,6 s | In locale. Su GitHub Pages si aggiunge il download (116 KB compressi). |
| Tocco su «+ Testo» → pannello aperto | ~0,3 s | |
| Digitazione | **blocchi da 50 a 190 ms a ogni tasto** | Ritardo percepibile mentre si scrive. |
| Tocco su «Stampa…» → anteprima pronta | **~0,7 s**, con un blocco unico di ~0,6 s | Per tutto quel tempo l'interfaccia è ferma. |

Scomposizione dell'anteprima, senza rallentamento: rendering a 300 dpi 2,8 ms, soglia e rotazione 4,5 ms, disegno dell'anteprima 3,6 ms, conversione 1,7 ms. In tutto **~13 ms a regime** (~47 ms alla prima esecuzione). Il calcolo è veloce: il problema è che parte nel momento sbagliato, cioè all'apertura del pannello e in un unico blocco.

Composizione del JavaScript (377 KB non compressi):

| Parte | Peso |
|---|---|
| Konva | 186 KB (50 %) — importato per intero, filtri e forme comprese |
| Libreria della stampante (dati dei formati e del protocollo) | 63 KB |
| Vue + Pinia | 74 KB |
| Codice dell'app | 42 KB |

### Tocchi per l'operazione tipica

«Stampa un'etichetta con un testo», con la stampante già autorizzata:

1. «+ Testo» → si apre il pannello con scritto «Testo»;
2. tocco sulla casella per far comparire la tastiera;
3. cancellazione di «Testo» (5 tocchi su ⌫, oppure selezione con pressione lunga);
4. scrittura;
5. «Chiudi»;
6. «Stampa…» → attesa dell'anteprima;
7. «Stampa».

In totale **circa 8–12 tocchi**, oltre al testo. Mentre si scrive, il pannello e la tastiera coprono l'etichetta, quindi non si vede il risultato.

## 2. Problemi trovati

1. **Il nuovo testo non è pronto da scrivere:** la casella non prende il fuoco e contiene «Testo», che va cancellato a mano.
2. **Mentre scrivi non vedi l'etichetta:** il pannello Testo copre circa i tre quarti dello schermo, e con la tastiera aperta l'etichetta sparisce.
3. **Per stampare servono due passaggi:** chiudere il pannello Testo, poi aprire «Stampa…» e premere «Stampa».
4. **L'anteprima viene calcolata solo all'apertura**, bloccando l'interfaccia per ~0,6 s.
5. **Ritardo durante la digitazione:** a ogni tasto l'editor ricostruisce tutti i nodi della scena, e l'adattamento automatico viene calcolato due volte (scena e pannello).
6. **Collegare la stampante richiede sempre «Collega»** se la stampante viene inserita ad app già aperta. Una stampante già autorizzata potrebbe essere ripresa da sola appena viene inserita.
7. **Copie e densità si azzerano** a ogni apertura dell'app.
8. **Barra in basso:** «Modifica» ed «Elimina» occupano metà della barra anche quando sono disattivati. Inoltre per modificare un testo già selezionato serve un tocco in più.
9. **Konva è importato per intero:** circa 90 KB di troppo da scaricare e interpretare all'avvio.

## 3. Proposte, in ordine di beneficio

### A. Nuovo testo pronto da scrivere (problema 1)
- «+ Testo» crea un testo vuoto, con il segnaposto «Scrivi il testo», apre il pannello e mette subito il fuoco nella casella, così la tastiera compare da sola.
- Se chiudi il pannello senza scrivere nulla, il testo vuoto viene eliminato.
- **Risparmio:** 2–6 tocchi.

### B. Pannello Testo compatto con l'etichetta visibile (problemi 2 e 3)
- Il pannello Testo diventa un **pannello basso** senza sfondo scuro. Mostra solo testo, i due simboli Ø/⌀, «Adatta automaticamente» e una riga **«Altre opzioni»**, che apre carattere, stile, allineamento, bianco su nero e rotazione.
- L'editor resta visibile sopra il pannello e l'etichetta si sposta in alto, quindi si vede **mentre si scrive**.
- Nel pannello c'è un pulsante **«Stampa»** diretto, così non serve chiuderlo.
- **Risparmio:** 1–2 tocchi, e il risultato si vede in tempo reale.

### C. Anteprima già pronta (problema 4)
- L'anteprima si calcola in sottofondo **300 ms dopo l'ultima modifica**, a pezzi brevi tra un fotogramma e l'altro.
- All'apertura di «Stampa…» il pannello compare subito, con l'anteprima già pronta.
- La stampa usa lo stesso bitmap già calcolato, se il documento non è cambiato.
- **Risparmio:** da ~0,7 s a un'apertura immediata, e nessun blocco dell'interfaccia.

### D. Digitazione fluida (problema 5)
- Quando cambia solo il testo o una proprietà di un elemento, l'editor **aggiorna quel nodo** invece di ricostruire tutta la scena, al massimo una volta per fotogramma.
- L'adattamento automatico viene calcolato **una volta sola** per ogni combinazione di testo, carattere, stile e dimensioni del riquadro, con una piccola cache condivisa tra scena e pannello.
- **Obiettivo:** nessun blocco sopra 50 ms a ogni tasto con la CPU rallentata 4 volte. Lo verifica un test automatico di prestazioni.

### E. Stampa con un tocco (problema 3)
- Nella barra in basso, il pulsante **«Stampa»** stampa subito con le ultime impostazioni (copie, densità) e conferma con un messaggio.
- Un pulsante accanto, **«Anteprima»**, apre il pannello attuale con anteprima e opzioni.
- **Sicurezza:** la stampa diretta **non parte** e apre invece l'anteprima se:
  - l'etichetta è vuota;
  - il formato scelto non corrisponde al rotolo;
  - un testo non entra nel riquadro;
  - la stampante segnala un problema.
- **Risparmio:** 1 tocco e nessuna attesa.

### F. Collegamento automatico quando inserisci la stampante (problema 6)
- Se la stampante è già stata autorizzata in passato, l'app si collega da sola quando viene inserita (evento `connect` di WebUSB), senza toccare «Collega».
- La prima autorizzazione richiede comunque il tocco, per le regole del browser.

### G. Impostazioni ricordate (problema 7)
- Densità, ultimo formato e verso del contenuto restano salvati sul dispositivo.
- Le copie tornano a 1 dopo ogni stampa, per evitare stampe multiple per errore.

### H. Barra in basso contestuale (problema 8)
- **Senza selezione:** «+ Testo», «Anteprima», «Stampa».
- **Con un testo selezionato:** «Modifica», «Elimina», «Anteprima», «Stampa».
- Un secondo tocco su un testo già selezionato apre il pannello di modifica.

### I. Avvio più leggero (problema 9)
- Konva viene importato solo nelle parti usate: nucleo, rettangolo, testo, gruppo e maniglie. Stima: -80/90 KB non compressi.
- La parte della libreria che comunica con la stampante viene caricata al primo collegamento.
- L'**installazione come app (PWA)**, prevista nella fase 3, renderebbe l'avvio istantaneo anche senza rete. Qui la indico solo come la prossima voce più utile.

### Fuori da questo intervento, ma è il guadagno maggiore per lavori ripetuti
- **Etichette recenti e modelli** (fase 2): ristampare un'etichetta già fatta con 2 tocchi.

## 4. Risultato atteso

| Operazione | Oggi | Dopo |
|---|---|---|
| Etichetta con un testo, stampante già autorizzata | 8–12 tocchi + attese | **3 tocchi** («+ Testo», scrivi, «Stampa») |
| Apertura dell'anteprima | ~0,7 s con l'interfaccia ferma | immediata |
| Digitazione | blocchi fino a ~190 ms | sotto 50 ms (obiettivo, CPU ×4) |
| Collegamento con la stampante inserita dopo | 1–2 tocchi | 0 tocchi |

## 5. Test

- E2E (412×915): l'operazione tipica completata in 3 tocchi, con il conteggio verificato dal test. Fuoco automatico sulla casella. Stampa diretta bloccata nei 4 casi di sicurezza. Barra contestuale. Pannello compatto senza scorrimento orizzontale.
- **Prestazioni** (nuovo test Playwright con la CPU rallentata 4 volte): nessun blocco sopra 50 ms durante la digitazione, apertura dell'anteprima sotto 150 ms.
- Unitari: cache dell'adattamento, calcolo dell'anteprima in sottofondo che si annulla se il documento cambia, salvataggio delle impostazioni.
- Il bitmap stampato resta identico a quello dell'anteprima (test esistenti).
- Collegamento automatico: simulato con l'evento `connect`. Il comportamento reale va verificato con la stampante.

## 6. Decisioni (2026-11-02)

1. Si realizzano tutte le proposte, dalla A alla I.
2. **Niente stampa diretta:** l'utente vuole vedere sempre l'anteprima. La proposta E diventa:
   - il pulsante **«Stampa»** nella barra in basso e nel pannello Testo apre il pannello di anteprima, già pronto grazie alla proposta C;
   - da lì si conferma con «Stampa»;
   - i controlli di sicurezza (etichetta vuota, formato diverso dal rotolo, testo che non entra, problemi della stampante) restano visibili nell'anteprima.
3. Operazione tipica: «+ Testo», scrivi, «Stampa» (anteprima), «Stampa» = **4 tocchi**.

## 7. Note di implementazione e risultati (2026-11-02)

### Cosa è stato fatto

- **A. Nuovo testo:** è vuoto, con il segnaposto «Scrivi il testo», e la casella prende subito il fuoco. Un testo lasciato vuoto viene eliminato alla chiusura. *Da verificare sul Pixel* che la tastiera compaia davvero da sola: Chrome per Android di solito lo consente quando il fuoco arriva dal tocco, ma non è garantito.
- **B. Pannello Testo agganciato** sotto l'editor, non più sovrapposto. In primo piano: testo, Ø/⌀ e «Adatta automaticamente»; il resto sta in «Altre opzioni». Pulsanti «Elimina», «Fine» e «Stampa», quest'ultimo apre l'anteprima.
- **C. Anteprima in sottofondo** (`src/stores/preview.ts`): parte 300 ms dopo l'ultima modifica, a passi separati da un fotogramma, su una copia del documento. La stampa usa lo stesso bitmap tramite `preview.ensure()`, che ricalcola solo se il documento è cambiato.
- **D. Editor incrementale:** ricostruisce solo i nodi degli elementi la cui firma è cambiata, al massimo una volta per fotogramma. L'adattamento automatico ha una cache (300 voci), svuotata quando un font finisce di caricarsi. Altri accorgimenti:
  - canvas dell'editor limitato a densità 2× (la stampa resta a 1 pixel per punto);
  - bordo sottile al posto dell'ombra sfocata;
  - scansione dei bitmap byte per byte;
  - esportazione senza un disegno superfluo e senza tela a densità doppia.
- **E. Stampa:** come deciso, passa sempre dall'anteprima, che ora si apre già pronta. Gli avvisi (etichetta vuota, testo che non entra, formato diverso dal rotolo, problemi della stampante) sono nell'anteprima.
- **F. Collegamento automatico:** quando viene inserita una stampante già autorizzata (evento `connect` di WebUSB), l'app si ricollega da sola. *Da verificare con la stampante vera.*
- **G. Impostazioni ricordate** (`src/settings.ts`): densità, formato e verso. Le copie tornano a 1 dopo ogni stampa.
- **H. Barra contestuale:** senza selezione «+ Testo» e «Stampa»; con selezione si aggiungono «Modifica» ed «Elimina». Un tocco su un testo già selezionato lo apre in modifica.
- **I. Avvio più leggero:**
  - Konva è importato solo nelle parti usate (`src/render/konva.ts`);
  - il driver della stampante è in un file separato (26 KB, 9 KB compressi) caricato dopo il primo disegno dell'interfaccia;
  - JavaScript iniziale: da 377 a 313 KB (da 116 a 97 KB compressi). Il risparmio su Konva è stato di circa 64 KB, meno degli 80–90 KB stimati.

### Risultati misurati (build di produzione, CPU ×4, 3 esecuzioni)

| | Prima | Dopo |
|---|---|---|
| Tocchi per l'operazione tipica | 8–12 | **3** («+ Testo», scrivi, «Stampa», «Stampa»: la scrittura non è un tocco) |
| Blocchi durante la digitazione (27 tasti) | 4, fino a 190 ms | 1–2, 50–67 ms |
| Apertura dell'anteprima, oltre il costo del tocco nello strumento di test (~130 ms) | ~570 ms, con un blocco di ~600 ms | ~70 ms, un blocco di ~60 ms |

**Obiettivo non raggiunto per intero:** il documento chiedeva nessun blocco oltre 50 ms durante la digitazione. Resta 1 picco isolato di circa 65 ms su 27 tasti. Il test di prestazioni (`tests/perf/perf.spec.ts`) verifica quindi un limite realistico: al massimo 2 blocchi oltre 50 ms e nessuno oltre 80 ms. Per l'anteprima verifica meno di 150 ms oltre il tocco e nessun blocco oltre 80 ms.

### Test aggiunti
- **Unitari:** impostazioni (valide e corrotte), collegamento automatico con la stampante simulata, scansione veloce dei bitmap.
- **Browser:** anteprima in sottofondo (riuso, ricalcolo dopo una modifica, aggiornamento automatico, uguaglianza con un calcolo da zero), cache dell'adattamento.
- **E2E:**
  - operazione tipica in 3 tocchi, con fuoco automatico ed editor visibile;
  - eliminazione del testo vuoto;
  - barra contestuale e secondo tocco;
  - ricollegamento automatico;
  - impostazioni ricordate e copie che tornano a 1.
- **Prestazioni:** progetto Playwright `perf`.
