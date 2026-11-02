# Diagnostica USB

- Data: 2026-11-02
- Stato: **proposta, in attesa di conferma**

## Obiettivo

Una pagina che verifica, con **qualsiasi** dispositivo USB (per esempio una stampante HP di casa), se telefono, cavo, impostazioni di GrapheneOS e Vanadium permettono al browser di vedere una stampante e di prenderne il controllo.

**Non invia nessun dato al dispositivo:** niente stampa e niente cambi di stato. Serve a separare i problemi di collegamento da quelli del protocollo della LabelWriter 550, e resta utile anche dopo per capire dove si ferma un collegamento.

## Come ci si arriva

- Indirizzo con `?diagnostica`, per esempio `https://alberico7.github.io/sexyetichette/?diagnostica`.
- Link **«Apri la diagnostica USB»** nei messaggi d'errore di collegamento: stampante non trovata, accesso negato, dispositivo non riconosciuto, browser senza WebUSB.

La pagina si apre in un pannello sopra l'app e viene caricata solo quando serve: non appesantisce l'avvio.

## Cosa fa

Un elenco di passaggi, ciascuno con ✓ (riuscito), ✗ (fallito) o – (non eseguito), e una spiegazione in italiano:

1. **Browser.** Pagina sicura (HTTPS o localhost), WebUSB presente, nome e versione del browser.
2. **Dispositivi già autorizzati.** Quanti dispositivi il sito può già usare senza selettore.
3. **Selettore.** Il tocco su «Scegli un dispositivo» apre il selettore **senza filtri**, quindi compaiono tutti i dispositivi USB. Del dispositivo scelto mostra:
   - nome, produttore, codici del produttore e del prodotto (in esadecimale), versione USB;
   - le interfacce con il loro tipo: «stampante» per la classe 7, poi audio, HID, memoria di massa, specifico del produttore e così via;
   - se è una LabelWriter 550 (0922:0028), 550 Turbo (0922:0029) o un'altra LabelWriter.
4. **Apertura** del dispositivo (`open`).
5. **Configurazione:** viene selezionata solo se il dispositivo non ne ha già una attiva.
6. **Presa di controllo** dell'interfaccia stampante (classe 7), oppure della prima interfaccia se non ce n'è una di classe stampante. Subito dopo viene **rilasciata**. È il passaggio che la 550 dovrà superare.
7. **Chiusura** del dispositivo.

Alla fine c'è un **riepilogo**, per esempio:
- «Il telefono vede il dispositivo e il browser può comunicarci: il collegamento USB funziona.»
- «Il browser vede il dispositivo ma non può prenderne il controllo: probabilmente un'altra app o il sistema lo sta usando.»
- «Nessun dispositivo nel selettore: controlla il cavo e l'impostazione della porta USB-C di GrapheneOS.»

Ogni errore mostra il messaggio tecnico originale in «Dettagli».

## Pulsanti

- **«Scegli un dispositivo»**: avvia la prova.
- **«Copia risultati»**: copia negli appunti un testo con tutti i passaggi, da incollare in chat. Il numero di serie è troncato alle ultime 4 cifre.
- **«Dimentica questo dispositivo»**: revoca l'autorizzazione appena concessa (`device.forget()`). Utile dopo la prova con la HP, così non resta tra i dispositivi autorizzati. Anche senza questo passaggio, l'app considera solo le LabelWriter per il collegamento automatico, quindi la HP non verrebbe toccata.

## Garanzia «nessun dato inviato»

Il modulo usa solo `open`, `selectConfiguration` (se necessario), `claimInterface`, `releaseInterface`, `close` e `forget`, e **mai** `transferOut`, `controlTransferOut`, `isochronousTransferOut` o `reset`. Un test unitario lo verifica con un dispositivo finto che registra tutte le chiamate.

## Struttura

- `src/printer/usb-diagnostics.ts`: logica pura. Riceve `navigator.usb`, restituisce i passaggi e il riepilogo, e prepara il testo da copiare. Non dipende dall'interfaccia.
- `src/components/UsbDiagnostics.vue`: pannello con l'elenco dei passaggi e i pulsanti.
- `App.vue`, `ErrorBanner.vue`: apertura da `?diagnostica` e dai messaggi d'errore.

## Test

- **Unitari**, con un `navigator.usb` finto:
  - dispositivo stampante riuscito;
  - selettore chiuso;
  - apertura fallita;
  - presa di controllo fallita (interfaccia occupata);
  - dispositivo senza interfaccia stampante;
  - riconoscimento della 550 e della 550 Turbo;
  - nessuna chiamata di invio dati;
  - serie troncato nel testo copiato.
- **E2E (412×915)**, con un `navigator.usb` finto iniettato nella pagina: apertura con `?diagnostica`, prova completa con esito positivo, nessuno scorrimento orizzontale, link presente nel messaggio «Nessuna stampante selezionata».
- **Da provare con l'hardware:** la stampante HP collegata al Pixel.

## Limiti da sapere

- Su **Windows**, il driver di sistema delle stampanti spesso impedisce al browser di prenderne il controllo: lì la prova può fallire al passaggio 6 anche se tutto è a posto. Su Android questo non dovrebbe succedere, ma va verificato.
- La prova **non verifica** il protocollo della 550: comandi, lock di stampa, lettura NFC. Quelli si provano solo con la LabelWriter.

## Note di implementazione (2026-11-02)

- Stato: **confermato e realizzato**.
- La logica è in `src/printer/usb-diagnostics.ts`, il pannello in `src/components/UsbDiagnostics.vue`, caricato solo all'apertura. Il riepilogo è in cima, sopra i passaggi, così su telefono si vede senza scorrere.
- Il selettore parte direttamente dal tocco su «Scegli un dispositivo», senza attese prima, come richiede il browser.
- Test:
  - 12 unitari, tra cui la verifica che le sole chiamate siano `open`, `claimInterface`, `releaseInterface` e `close`, e mai invii di dati;
  - 3 e2e con un `navigator.usb` finto: prova completa, interfaccia occupata, link dal messaggio d'errore.
- README aggiornato con le istruzioni.
