# Densità predefinita «Scura»

- Data: 2026-11-06
- Stato: **confermato e realizzato (2026-11-06)**

## Perché

Sulla 550 vera l'utente stampa sempre con «Scura». La densità è **relativa**: è una percentuale del calore normale della 550, mandata con il comando `ESC C`.

I valori restano quelli della libreria:

| Livello | Calore |
|---|---|
| Chiara | 70% |
| Media | 85% |
| Normale | 100% |
| Scura | 130% |

## Cosa cambia

- La densità **predefinita** passa da «Normale» a **«Scura»**: è quella usata quando non c'è una scelta salvata, cioè al primo avvio o con l'archivio del browser vuoto.
- Una scelta già salvata resta com'è. Chi ha già scelto «Scura» non vede differenze.
- I quattro livelli e i loro valori non cambiano.
- Una prima proposta voleva riscalare tutti i livelli di 1,3 volte, con «Normale» a 130% e «Scura» a 169%, correggendo il byte `ESC C` prima dell'invio. È stata **scartata** su indicazione dell'utente: questa soluzione è più semplice e non tocca i byte inviati.

## Dove

- `src/stores/printer.ts`: valore iniziale di `density`.

## Test

- **E2E:** con l'archivio vuoto la stampa rapida usa «high», e in «Ultime stampe» compare «densità high».
