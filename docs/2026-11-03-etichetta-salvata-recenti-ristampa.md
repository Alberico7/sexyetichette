# Etichetta salvata, etichette recenti e ristampa

- Data: 2026-11-03
- Stato: **confermato e realizzato**

## Perché

Oggi l'app ricorda densità, formato e verso, ma **non il contenuto dell'etichetta**: se ricarichi la pagina o Android chiude la scheda in sottofondo, il testo si perde. Inoltre, per stampare di nuovo un'etichetta già fatta bisogna riscriverla.

Tre migliorie, pensate per l'uso con una mano:
1. l'etichetta attuale viene salvata da sola;
2. un elenco delle ultime etichette stampate, da riaprire o ristampare;
3. ~~un pulsante «Ristampa» subito dopo la stampa~~: tolto, vedi sotto.

Tutto resta **solo sul telefono** (memoria del browser, `localStorage`): niente server, niente account. La diagnostica continua a escludere i testi delle etichette.

## 1. Etichetta attuale salvata

- A ogni modifica l'etichetta viene salvata, con un ritardo di mezzo secondo per non rallentare la digitazione. Viene salvata subito anche quando l'app va in sottofondo (cambio app, schermo spento).
- All'apertura l'app riprende l'ultima etichetta: testi, posizioni, formato, verso e lunghezza del rotolo continuo. Il pannello Testo resta chiuso e nessun testo è selezionato.
- I testi rimasti vuoti non vengono ripristinati.
- Se i dati salvati sono rovinati o di una versione sconosciuta, vengono ignorati e si parte da un'etichetta nuova, come oggi.
- Se all'avvio il rotolo letto è diverso dal formato dell'etichetta ripresa, vale il comportamento di oggi: il formato si adotta da solo solo se l'etichetta è vuota, altrimenti compare l'avviso «Usa il rotolo rilevato».

**Nessun pulsante «Nuova etichetta».** Per ricominciare si modifica l'etichetta salvata: si cambiano o si eliminano i testi.

## 2. Etichette recenti

- Dopo ogni **stampa riuscita** l'etichetta stampata entra in cima all'elenco *Recenti*.
- Fino a **20** etichette. Le più vecchie escono da sole.
- Se ristampi un'etichetta identica, cioè con gli stessi testi, posizioni, stili, formato e verso, non si crea un doppione: quella esistente torna in cima, con la data aggiornata.
- Ogni riga mostra:
  - una **miniatura** in bianco e nero, presa dall'anteprima di stampa;
  - i testi, uniti da « · » e accorciati se lunghi;
  - formato e quando è stata stampata («oggi 14:32», «ieri», «28 ott»).
- **Dove:** con nessun testo selezionato, la barra in basso diventa **«＋ Testo» · «Recenti» · «Stampa»**. «Recenti» apre un pannello dal basso, come gli altri.
- **Azioni di ogni riga:**
  - un tocco sulla riga **apre** l'etichetta nell'editor, al posto di quella attuale;
  - **«Ristampa»** apre l'etichetta e passa subito ad *Anteprima e stampa*. Restano quindi i controlli di sempre: avviso se il rotolo inserito è diverso, copie e densità;
  - **✕** la toglie dall'elenco.
- Aprire un'etichetta recente sostituisce quella attuale, senza avvisi né «Annulla».
- In fondo all'elenco c'è **«Svuota l'elenco»**, con una richiesta di conferma.
- **Spazio:** ogni miniatura è un PNG piccolo, circa 2–6 KB. 20 etichette occupano meno di 200 KB. Se la memoria del browser è piena, l'app toglie le recenti più vecchie e riprova; se non basta, la stampa funziona comunque, ma l'etichetta non entra nell'elenco.

## 3. Ristampa subito dopo la stampa: tolta

Realizzata e poi **tolta su richiesta** (2026-11-03). L'etichetta stampata resta nell'editor, quindi per ristamparla bastano «Stampa» → «Stampa». Passando dall'anteprima si ricontrollano ogni volta rotolo, copie e densità. Dopo la stampa resta l'avviso di sempre, «Etichetta inviata alla stampante», per 3 secondi e senza pulsanti.

## Come

- **`src/storage/label-store.ts`** (nuovo):
  - lettura e scrittura dell'etichetta attuale (chiave `etichettatrice.etichetta`) e delle recenti (chiave `etichettatrice.recenti`);
  - controllo dei dati letti: formato, versione, tipi dei campi. Un elemento non valido viene scartato, non blocca tutto;
  - ogni accesso a `localStorage` è in `try/catch`, come per le impostazioni attuali.
- **`src/stores/recent.ts`** (nuovo):
  - elenco delle recenti, aggiunta dopo la stampa con confronto del contenuto, rimozione e svuotamento;
  - la miniatura viene ricavata dal bitmap già calcolato per l'anteprima, rimpicciolito a 240 px di lato al massimo.
- **`src/stores/document.ts`:**
  - all'avvio legge l'etichetta salvata;
  - un `watch` con ritardo la salva, più il salvataggio immediato su `visibilitychange`/`pagehide`.
- **`PrintSheet.vue`:** dopo una stampa riuscita aggiunge l'etichetta alle recenti, con il bitmap appena stampato.
- **`App.vue`:** pulsante «Recenti» nella barra, nuovo pannello `RecentSheet.vue`.
- Il codice che parla con la stampante non cambia.

## Test

- **Unitari:**
  - lettura dell'etichetta salvata: dati validi, rovinati, versione sconosciuta, elementi non validi scartati, testi vuoti tolti;
  - recenti: aggiunta in cima, nessun doppione per etichette identiche, limite di 20, rimozione, memoria piena (le più vecchie escono);
  - la miniatura è un PNG con le proporzioni dell'etichetta.
- **E2E (412×915, stampante simulata):**
  - scrivo un testo e ricarico la pagina: il testo c'è ancora;
  - dopo una stampa l'etichetta compare in *Recenti*. Toccandola si riapre; «Ristampa» della riga apre l'anteprima con quell'etichetta;
  - ristampando la stessa etichetta l'elenco non ha doppioni;
  - dopo la stampa l'etichetta resta e «Stampa» → «Stampa» manda un secondo lavoro;
  - nessuno scorrimento orizzontale nel pannello *Recenti*.
- **Prestazioni:** la prova di digitazione esistente deve restare entro i limiti di oggi con il salvataggio automatico attivo.

## Fuori da questa proposta

- Nomi alle etichette, cartelle o modelli preferiti: sono i «modelli salvati» della fase 2.
- Esportazione e importazione in JSON: fase 2.
- Sincronizzazione tra dispositivi: non prevista, l'app non ha server.

## Note di implementazione (2026-11-03)

- Salvataggio e controllo dei dati in `src/storage/label-store.ts`, elenco in `src/stores/recent.ts`, miniatura in `src/render/thumbnail.ts`, pannello in `src/components/RecentSheet.vue`.
- Dopo una stampa riuscita nessun testo resta selezionato, così la barra mostra di nuovo «Recenti».
- L'avviso «Etichetta inviata alla stampante» sparisce quando si apre un pannello (Recenti, Formato…), che altrimenti lo coprirebbe.
- Il pulsante «Ristampa» nell'avviso è stato realizzato e poi tolto su richiesta.
- Test:
  - 11 unitari: salvataggio, dati rovinati, recenti, doppioni, limite, memoria piena, riassunto e data;
  - 3 di rendering: miniatura e verso di lettura;
  - 5 e2e: ricaricamento, sottofondo, recenti, recenti dopo il ricaricamento, ristampa con «Stampa» → «Stampa».

  Tutti i test passano, comprese le prestazioni. Il bundle principale passa da 103,96 a 106,51 KB compressi.
