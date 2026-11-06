# Riordino di App.vue

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Perché

È il punto 6 del controllo di manutenibilità del 2026-11-06. [src/App.vue](../src/App.vue) è di circa 400 righe e mette insieme compiti diversi:

- pannelli (quale è aperto e come si passa dall'uno all'altro);
- stampa rapida e messaggio «Stampata ✓»;
- adozione del formato del rotolo letto e della sua misura vera;
- avvio in sottofondo (ricollegamento e carattere);
- due copie identiche della coppia di pulsanti «Stampa ×1», una nella barra in basso e una nel pannello del testo;
- circa 130 righe di stile.

Prima di aggiungere funzioni nuove (immagini, QR, regolazione del bordo) conviene che ogni parte stia in un posto suo.

## Cosa cambia

Nessuna modifica per chi usa l'app: stessi pulsanti, testi, `data-testid` e comportamento.

1. **`src/composables/roll-media.ts` — `useRollMedia()`.** Raccoglie i due `watch` sul rotolo letto, oggi in App.vue:
   - un'etichetta vuota prende il formato del rotolo;
   - stesso formato con la misura arrotondata del catalogo: prende la misura vera del chip.

   Diventa provabile senza montare l'app intera.
2. **`src/composables/toast.ts` — `useToast()`.** Il messaggio breve in basso: testo, durata di 3 s e cancellazione quando si apre un pannello.
3. **`src/components/PrintButtons.vue`.** La coppia «Stampa» e «×1», con lo stato «Stampa…» durante la stampa e il proprio stile.
   - Usata due volte, con un prefisso per i `data-testid`: `open-print`/`open-copies` nella barra, `text-print`/`text-copies` nel pannello.
   - Emette `print` e `copies`.
4. **`src/components/ActionBar.vue`.** La barra in basso: «＋ Testo», «Recenti» oppure «Modifica · Elimina», 👁 e la coppia di stampa, con le sue colonne a 412 px. Riceve lo stato (testo selezionato o no) ed emette le azioni.
5. **`src/composables/startup.ts` — `useBackgroundStartup()`.** Ricollegamento e carattere predefinito caricati dopo il primo disegno, oggi in `onMounted`.
6. **Resta in App.vue:**
   - quale pannello è aperto e le funzioni che lo cambiano (`addText`, `openEdit`, `closeText`, `quickPrint`…);
   - lo schema della pagina: barra in alto, avvisi, editor, pannello del testo o barra in basso, pannelli;
   - lo stile della pagina.

   Obiettivo: meno di 220 righe.

## Cosa non cambia

- Comportamento, testi, aspetto e prestazioni.
- I test esistenti, unitari ed e2e, devono passare senza modifiche, perché `data-testid` e ruoli restano uguali.
- L'app costruita: per gli stessi contenuti, stessi testi e stesse regole di stile; cambiano solo i nomi interni dei componenti.

## Test

- Tutti i test di oggi: 245 vitest e 46 e2e, più il test di prestazioni in locale.
- **Nuovi unitari per `useRollMedia()`:**
  - etichetta vuota e rotolo letto: formato adottato;
  - etichetta con testi: formato invariato;
  - stesso formato con 25 mm salvati e 25,4 mm dal chip: misura vera, testi agli stessi millimetri;
  - formato diverso dal rotolo: niente cambia.
- **Nuovi unitari per `useToast()`:** compare, sparisce dopo 3 s, un messaggio nuovo sostituisce il precedente.
- Screenshot della barra in basso a 412 px, con e senza testo selezionato, confrontati a vista con quelli di oggi.

## Note di implementazione (2026-11-06)

- **Nuovi file:**
  - `src/composables/roll-media.ts`, `toast.ts` e `startup.ts`;
  - `src/components/PrintButtons.vue` e `ActionBar.vue`;
  - **in più rispetto al piano:** `src/components/TextDock.vue`, il pannello del testo agganciato con i suoi stili.
- **Stili:** le regole sui pulsanti della barra e del pannello sono passate nei rispettivi componenti, con `:deep(button)`, così valgono anche per i pulsanti di `PrintButtons` come prima.
- **App.vue:** da 418 a 267 righe. **Differenza dal piano:** l'obiettivo era meno di 220. Per arrivarci bisognerebbe creare componenti minuscoli (avviso del browser, messaggio breve) che non semplificano niente, quindi non l'ho fatto.
- **Test:**
  - 5 nuovi in `tests/browser/app-parts.test.ts`: 3 per `useRollMedia`, 2 per `useToast`;
  - tutti i test di prima passano senza modifiche: 250 vitest, 46 e2e e il test di prestazioni;
  - gli screenshot della barra in basso, con e senza testo selezionato, e quello del pannello del testo sono identici a prima, controllati a vista.
