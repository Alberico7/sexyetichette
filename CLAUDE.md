# Istruzioni di progetto

## Flusso di lavoro per nuove funzionalità

Ogni volta che l'utente chiede di sviluppare una nuova funzionalità o implementazione:

1. **Verificare prima la data e ora corrente** (non assumerla, controllarla).
2. Creare un **documento di progetto** nella cartella `/docs` che descriva l'implementazione che si andrà a fare (cosa verrà sviluppato e come).
3. Il file va nominato `yyyy-mm-dd-nome-funzionalita.md` (es. `2026-07-31-import-startlist.md`), usando la data corrente verificata al punto 1.
4. **Attendere la conferma dell'utente** sul documento prima di iniziare a scrivere codice. Non procedere all'implementazione finché la conferma non arriva.

## Niente che si accumula o resta aperto

Questa regola nasce da un caso reale nel progetto "compilatore misure". Vosk salvava una copia del modello da 91 MB a ogni preparazione, perché il nome della copia dipendeva da un indirizzo `blob:` diverso ogni volta. Dopo 12 giorni la scheda del telefono andava in crash. Per ogni modifica che salva dati nel browser, apre risorse o usa una libreria esterna:

1. **Nomi fissi o pulizia.** Tutto quello che resta nel browser (localStorage, Cache Storage, IndexedDB, OPFS) deve avere un nome fisso, oppure una pulizia che tolga le copie vecchie. Un nome che cambia ogni volta (indirizzo `blob:`, data, numero casuale) va bene solo se c'è la pulizia.
2. **Librerie esterne: guardare cosa salvano da sole.** Prima di usare una libreria, o cambiare come la si usa, verificare se salva qualcosa per conto suo (archivi, cache, file virtuali) e con quale nome. Se serve, leggere il suo codice, anche quello del worker. Scrivere nel documento di progetto cosa salva e dove.
3. **Ogni cosa aperta si chiude, anche in caso di errore.** Vale per worker, AudioContext, microfono, collegamenti Bluetooth e USB, connessioni IndexedDB, indirizzi `URL.createObjectURL` (con `revokeObjectURL`), timer e ascoltatori aggiunti più volte.
4. **Nessuna attesa infinita.** Se una libreria può non rispondere mai, ascoltare anche il suo errore e mettere un tempo massimo. Esempio: `Vosk.createModel` non risponde mai quando il worker fallisce.
5. **Cambio di versione o di nome.** Quando cambia il nome di una cosa salvata (un modello nuovo, una cache nuova), togliere quella vecchia.
6. **Test ripetuto.** Per queste parti serve un test che ripeta l'operazione almeno 2–3 volte e controlli che non cresca niente: numero di chiavi, cartelle o cache, e la memoria quando conta.
7. **Nel documento di progetto**, quando la modifica tocca questi punti, aggiungere una sezione **"Memoria e spazio"**. Deve dire cosa resta salvato nel browser, quanto pesa, quando si pulisce e cosa resta aperto in memoria.
