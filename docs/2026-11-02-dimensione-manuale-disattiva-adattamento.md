# Dimensione scritta a mano → adattamento automatico disattivato

- Data: 2026-11-02
- Stato: **confermato e realizzato il 2026-11-02**
- Riferimento: [adattamento automatico del testo](2026-11-02-adattamento-automatico-testo.md)

## Oggi

Con «Adatta automaticamente» attivo, il campo «Dimensione» mostra il valore calcolato ma è **di sola lettura**. Per scegliere una dimensione bisogna prima disattivare l'opzione e poi scrivere il numero: due passaggi.

## Proposta

1. Il campo «Dimensione» è **sempre modificabile**.
2. Con l'adattamento attivo, il campo mostra la dimensione calcolata, con l'etichetta «Dimensione (auto)».
3. **Appena scrivi un numero valido** (tra 4 e 200 pt):
   - l'adattamento automatico si **disattiva da solo**;
   - il testo prende la dimensione che hai scritto;
   - l'interruttore «Adatta automaticamente» risulta spento e l'etichetta del campo torna «Dimensione (pt)».
4. Un valore non valido (vuoto, 0, oltre 200) non cambia nulla: l'adattamento resta com'era e il campo, quando esci, torna al valore precedente.
5. Per tornare all'adattamento basta riattivare l'interruttore, come oggi.

## Test

- E2E (412×915):
  - con l'adattamento attivo, scrivere «18» nel campo spegne l'interruttore e lascia 18 pt;
  - l'anteprima usa 18 pt;
  - riattivando l'interruttore, la dimensione torna calcolata;
  - un valore non valido non spegne l'adattamento.
- Rendering: il testo a 18 pt dopo lo spegnimento è identico a un testo creato direttamente a 18 pt senza adattamento.

## File coinvolti

- `src/components/TextProperties.vue`: campo sempre modificabile e logica di spegnimento.
- `tests/e2e/`, `tests/browser/`.

## Note di implementazione (2026-11-02)

- Il campo non è più di sola lettura. Ogni valore valido scritto (4–200 pt) imposta subito la dimensione e spegne l'adattamento. Le cifre intermedie non valide, per esempio «1» prima di «18», vengono ignorate. All'uscita dal campo, un valore non valido torna a quello effettivo.
- Test: 1 e2e (valore non valido, valore valido, anteprima, riattivazione) e 1 di rendering (bitmap identico a un testo creato direttamente a 18 pt).
