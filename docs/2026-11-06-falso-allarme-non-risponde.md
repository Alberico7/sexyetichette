# Niente falso allarme «La stampante non risponde» dopo lo schermo spento

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Cosa succede

Nel registro del 2026-11-06 l'errore «La stampante non risponde — Nessuno stato ricevuto da 30 secondi» compare due volte, alle 10:24:20 e alle 10:28:18.

- **Prima:** le richieste di stato, che partono ogni 4 secondi, si fermano rispettivamente per 32 e per 86 secondi.
- **Dopo l'errore:** la stampante risponde subito alla richiesta successiva, in pochi millisecondi.

**Causa:** il telefono aveva lo schermo spento o l'app in secondo piano. Android e Vanadium sospendono i timer della pagina, quindi si fermano sia le richieste di stato sia il controllo.

**Il difetto:** al ritorno, il controllo in [src/printer/webusb.ts](../src/printer/webusb.ts) (`onStatus`, ogni 5 s) confronta l'ora attuale con l'ultima risposta ricevuta. Conta così anche il tempo in cui **l'app** era ferma, e segnala un guasto della stampante che non c'è.

## Cosa cambia

Il controllo dà l'allarme solo se **la stampante** non ha risposto mentre **l'app** stava davvero chiedendo.

1. **Pausa rilevata.** Il controllo ricorda quando ha girato l'ultima volta. Se fra due giri passano più di 15 secondi invece di 5, la pagina era sospesa.
   - Non segnala nulla.
   - Manda subito una richiesta di stato (`ESC A`, sola lettura, come quelle che partono ogni 4 secondi).
   - Riparte a contare da quel momento.
2. **Ritorno in primo piano.** Quando la pagina torna visibile (evento `visibilitychange`), si fa lo stesso: richiesta di stato subito e conteggio da zero. Così lo stato in alto si aggiorna appena si riapre l'app, senza aspettare il giro successivo.
3. **App in secondo piano.** Se la pagina è nascosta il controllo non dà allarmi. Anche se il telefono non la sospende del tutto, nessuno guarda l'app e un allarme non servirebbe.
4. **Allarme vero, invariato.** Con la pagina visibile e i timer attivi, se per 30 secondi non arriva nessuna risposta l'errore compare come oggi. Compare anche se la richiesta fatta al ritorno non riceve risposta o dà errore.
   - Una stampante spenta o un cavo staccato vengono comunque riconosciuti subito dall'evento di scollegamento USB, come oggi.
5. **Registro della diagnostica.** Le pause vengono annotate, per esempio «APP Pagina sospesa per 86 s: stato richiesto al ritorno». Nelle prossime diagnostiche si distinguerà a colpo d'occhio una pausa del telefono da un guasto.

## Cosa non cambia

- I comandi verso la stampante: si aggiunge solo una richiesta di stato al ritorno, uguale alle altre.
- La soglia di 30 secondi e il testo dell'errore vero.
- Durante una stampa resta la tolleranza di oggi.

## Test

- **Unitari, con orologio e timer finti:**
  - risposte regolari: nessun allarme;
  - nessuna risposta per 30 s con i timer attivi: allarme, come oggi;
  - timer fermi per 86 s, poi ripresa: nessun allarme, una richiesta di stato subito e la nota nel registro;
  - dopo la ripresa la stampante non risponde: allarme;
  - pagina nascosta per 2 minuti: nessun allarme; al ritorno, richiesta di stato.
- **E2E, con la stampante simulata:** si simula la pagina nascosta e poi di nuovo visibile, e si controlla che non compaia il messaggio «La stampante non risponde» e che lo stato sia «Pronta».

## Da verificare sul telefono

Collegare la 550, spegnere lo schermo per 1–2 minuti e riaccendere: non deve comparire l'errore. Nel registro deve esserci la nota «Pagina sospesa per … s».

## Note di implementazione (2026-11-06)

- **Nuovo modulo:** `src/printer/status-watchdog.ts`. Orologio, timer e visibilità sono passati dall'esterno, così i test li possono simulare.
- **Collegamento alla stampante vera:** `onStatus` in `src/printer/webusb.ts` lo usa.
  - La richiesta di stato al ritorno chiama `getStatus()` della libreria.
  - Passa dalla stessa coda dei comandi, quindi durante una stampa aspetta il suo turno.
- **Ritorno visto due volte:** il controllo e l'evento di visibilità possono accorgersi entrambi del ritorno. In quel caso parte una sola richiesta e il registro riceve una sola nota.
- **Test:** 7 unitari in `tests/unit/status-watchdog.test.ts`, tra cui il caso vero dei 86 s del registro.
- **Differenza dal piano:** niente test e2e. La stampante simulata ha un suo polling, senza questo controllo, quindi una prova con il simulatore non verificherebbe il codice cambiato. La verifica vera resta quella sul telefono, descritta sopra.
