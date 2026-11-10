# Dettatura del testo delle etichette (Vosk, sul telefono)

- Data: 2026-11-10
- Stato: **confermato e realizzato (2026-11-10)**

## Perché

L'utente vuole dettare il testo delle etichette invece di scriverlo.

La prova sul telefono (`docs/2026-11-10-prova-dettatura.md`) ha portato a scegliere **Vosk** con il modello italiano 0.22. Sul Pixel 7a con Vanadium, con il JIT attivo per il sito:

- il testo arriva 0,05–0,15 s dopo aver lasciato il pulsante;
- 6 frasi su 7 sono identiche al testo letto;
- l'audio non esce dal telefono.

## Come si usa

1. Nella casella del testo c'è un **pulsante microfono** 🎤, a destra della casella. La riga dei simboli (⌀ ISO, ∅ 45°, AFKEUR, N. R.) resta com'è.
2. **Si tiene premuto e si parla.** Mentre si parla, sotto la casella compare il testo provvisorio, in grigio. Lasciando il pulsante, il testo finito si inserisce **dove si trova il cursore**, come i simboli.
   - Se il testo prima del cursore non finisce con uno spazio o un a capo, l'app aggiunge uno spazio.
   - Si può dettare più volte di seguito: ogni frase si aggiunge alla precedente.
3. **La prima volta:**
   - il telefono chiede il permesso del microfono;
   - l'app chiede «Scaricare il riconoscimento vocale? Circa 50 MB, una volta sola» e mostra l'avanzamento.
   - Dopo, il modello resta nel telefono.
4. **Le volte successive** il modello si prepara già quando si apre la casella del testo (circa 5 s sul Pixel), così è pronto quando si preme il microfono. Questo avviene solo se il modello è già stato scaricato: senza la conferma dello scaricamento non si scarica niente.
5. **Se il riconoscimento è lento**, ad esempio su Vanadium con il JIT spento, l'app lo nota: il testo arriva dopo più della durata della frase. Allora mostra una volta l'avviso «Riconoscimento lento: su Vanadium attiva "JavaScript JIT" per questo sito, nelle impostazioni del sito».

## Dalle parole al testo dell'etichetta

Vosk scrive tutto in lettere minuscole («tubo diametro iso venti virgola cinquanta»). L'app lo trasforma con regole fisse, uguali ogni volta:

| Si dice | Diventa |
|---|---|
| «tubo diametro ISO venti virgola cinquanta» | TUBO ⌀20,50 |
| «diametro dodici punto settantacinque» | ∅12.75 |
| «diametro otto virgola zero cinque» | ∅8,05 |
| «diametro otto» | ∅8.00 |
| «diametro dodici punto cinque» | ∅12.50 |
| «centoventicinque barra quattro» | 125/4 |
| «venti per trenta» (fra due numeri) | 20×30 |
| «tre trattino quattro» | 3-4 |
| «non riparabile» | NON↵RIPARABILE (come il pulsante N. R.) |
| «scarto» | AFKEUR (Vosk non conosce la parola olandese) |
| «a capo» | nuova riga |

- **Numeri:** da zero a 9999, scritti in cifre. «Centoventicinque», «cento venticinque» e «milleduecento» sono tutti riconosciuti.
- **Decimali:** dopo «virgola» o «punto», ogni numero detto si scrive così com'è, uno dopo l'altro. «Cinquanta» → 50, «zero cinque» → 05, «settantacinque» → 75. Il separatore resta quello detto.
- **Numeri dopo «diametro» e «diametro ISO»** (scelta dell'utente, 2026-11-10): formato 00.00 se non si detta diversamente.
  - Solo intero: si aggiunge «.00», col punto («diametro otto» → ∅8.00). Le cifre intere restano quelle dette, senza zero davanti.
  - «virgola» o «punto» senza decimali dopo sceglie il separatore: «diametro venti virgola» → ∅20,00 (scelta dell'utente). Senza «diametro», «venti virgola» diventa «20,» e «venti punto» diventa «20.»: il segno attaccato al numero (scelta dell'utente, 2026-11-10).
  - Un solo decimale: si completa a due, con il separatore detto («punto cinque» → .50, «virgola cinque» → ,50).
  - Due decimali: restano come detti. Tre o più decimali: restano come detti, senza tagliare.
  - Senza «diametro» i numeri restano come detti («dodici punto cinque» → 12.5).
- **Simboli del diametro:** ∅ e ⌀ si attaccano al numero che segue, senza spazio, come nelle etichette fatte finora («Tubo ⌀20»).
- **Tutto in maiuscolo** (scelta dell'utente): «tubo diametro venti» → «TUBO ∅20». I simboli non cambiano.
- **Tutto il resto** resta com'è, in maiuscolo. Anche i numeri isolati diventano cifre: «tre quarti di pollice» → «3 QUARTI DI POLLICE». «Un» e «una» restano parole, perché sono quasi sempre articoli. Altre regole si possono aggiungere in seguito.

## Dove

- **`src/voice/`**, codice spostato dalla pagina di prova e reso comune:
  - `audio.ts`: conversione a 16 kHz;
  - `tar.ts`: conversione dello zip del modello;
  - `vosk-model.ts`: scaricamento, controllo dell'impronta, conservazione;
  - `recognizer.ts`: microfono e Vosk, con «inizia», «testo provvisorio» e «fine»;
  - `dictation.ts`: dalle parole al testo, cioè numeri, decimali, simboli e parole speciali. Sono regole pure, senza audio, facili da testare.
- **`src/components/TextProperties.vue`:** il pulsante microfono, il testo provvisorio e l'inserimento al cursore, con la stessa logica dei simboli (anche in orizzontale).
- **Un piccolo riquadro** per la conferma dello scaricamento e l'avanzamento.
- **Librerie:** `vosk-browser` (5,8 MB) e `fflate` si caricano **solo alla prima pressione del microfono** o alla preparazione del modello. L'avvio dell'app non cambia.
- **La pagina di prova:** resta online finché la dettatura non è collaudata sui telefoni. Poi la tolgo insieme a Whisper (`@huggingface/transformers`). Così il sito perde i 27 MB del motore di Whisper.

## Cosa non cambia

- La tastiera e i pulsanti dei simboli.
- Le etichette già fatte.
- Senza toccare il microfono non si scarica niente e non si chiede nessun permesso.

## Test

- **Unitari, sulla trasformazione delle parole:**
  - tutte le frasi della tabella;
  - numeri da zero a 9999, comprese le forme abbreviate (ventuno, ventotto, trentuno…);
  - decimali con zeri iniziali e finali;
  - «diametro» seguito da qualcosa che non è un numero;
  - «per» fuori da due numeri, che resta «per»;
  - spazi e a capo.
- **Unitari:** l'inserimento al cursore, con lo spazio aggiunto solo quando serve.
- **E2E**, con un riconoscitore simulato, solo in sviluppo come la stampante simulata:
  - premendo il microfono compare il testo provvisorio; lasciando, il testo finito va nella casella al punto giusto;
  - la conferma dello scaricamento compare la prima volta;
  - in orizzontale la tastiera non si riapre.
  - La build continua a non contenere niente di simulato.
- **Sul PC, a mano:** il microfono simulato con la voce sintetica di Windows e il vero Vosk, come nella prova.
- **Sui telefoni (tu):** le stesse frasi della prova, direttamente nell'app.

## Scelte dell'utente (2026-11-10)

1. **«scarto»** diventa AFKEUR.
2. **Tutto in maiuscolo** («TUBO ∅20,50»).
3. **Nessuna unità abbreviata:** «millimetri» resta parola («MILLIMETRI»).
4. **Pulsante microfono a destra della casella del testo.**

## Note di implementazione (2026-11-10)

- **File in `src/voice/`:**
  - `audio.ts`, `tar.ts`, `vosk-model.ts`: spostati dalla pagina di prova;
  - `model-cache.ts`: dove resta il modello. Ha lo stesso nome usato dalla pagina di prova, quindi il modello scaricato lì vale anche per l'app;
  - `engine.ts`: interfaccia comune e scelta del motore;
  - `vosk-engine.ts`: Vosk e microfono;
  - `simulated.ts`: motore finto per gli e2e, solo in sviluppo con `?sim`;
  - `dictation.ts`: dalle parole al testo;
  - `useDictation.ts`: stato del pulsante.
- **Caricamento a richiesta:** aprendo la casella del testo si controlla solo se il modello è nel telefono, con un modulo leggero. `vosk-browser` (5,8 MB) e `fflate` si caricano solo dopo «Scarica», oppure se il modello c'è già. Lo verifica un e2e sull'app vera, senza `?sim`, che fallisce con il comportamento sbagliato.
- **Microfono:** si apre alla prima pressione e resta aperto finché la casella del testo è aperta, così l'inizio della frase non si perde. Si chiude con «Fine».
- **Tocco breve sul microfono:** il pannello del testo è ancorato in basso e cresce verso l'alto. Quando compariva la conferma, il «click» finale del tocco cadeva su «Annulla». Ora il microfono blocca `touchstart`, che elimina quel click; gli eventi pointer continuano ad arrivare. L'ha trovato l'e2e.
- **In orizzontale, con la tastiera aperta,** il microfono si nasconde come i simboli.
- **Numeri:** anche i numeri isolati diventano cifre («tre quarti» → «3 QUARTI»). «Un» e «una» restano parole.
- **Build:** `scripts/check-no-simulator.mjs` cerca anche `SimulatedVoice` e `__simVoice`. Ha trovato davvero un resto del simulatore nell'app, già corretto.
- **Prova sul PC con il vero Vosk** (voce sintetica di Windows al posto del microfono): mentre si parla compare «tubo diametro iso venti»; lasciando, nella casella c'è «TUBO ⌀20,50».
- **Test:**
  - 65 unitari sulla trasformazione: tutte le frasi della tabella, i decimali dopo «diametro», ogni numero da 0 a 9999 detto come lo scrive Vosk, parole che non vanno toccate, inserimento con lo spazio;
  - 3 e2e: conferma e scaricamento la prima volta, dettatura al cursore e a capo, modello già scaricato e stampa simulata, avviso di lentezza;
  - 1 e2e: le librerie non si caricano all'apertura della casella.
  - Totali: 396 unitari + browser, 99 e2e.
- **Prova sul telefono (2026-11-10):** sul Pixel 7a con Vanadium la dettatura nell'app funziona (prova dell'utente).
