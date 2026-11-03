# Codici europei delle etichette LabelWriter

- Data: 2026-11-03
- Stato: **confermato e realizzato**

## Perché

Il rotolo usato nella prima prova con la 550 è un originale DYMO 25×54 mm, codice europeo **S0722520**. Il catalogo della libreria (`@thermal-label/labelwriter-core` 0.6.4) conosce quasi solo i codici americani (30336, 1976411…), con due sole eccezioni europee (11354, S0722540).

Un codice che manca dal catalogo non impedisce di usare il rotolo: l'app usa le misure scritte nel tag. Con i codici europei nel catalogo, però:
- il rotolo letto via NFC viene riconosciuto come formato noto, con nome italiano e lunghezza esatta del catalogo;
- la ricerca «S0722520» o «11352» nell'elenco dei formati trova l'etichetta giusta.

Non è la causa della mancata lettura del rotolo: quella si capirà con la diagnostica.

## Fonte

La tabella ufficiale DYMO Europa «LabelWriter labels overview» (https://dymo.eu/Footer/Technical-Info/LabelWriter-labels-overview/), consultata il 2026-11-03. Per ogni etichetta riporta:
- il codice articolo europeo;
- il numero breve (99010, 11352…), quando esiste;
- le misure e il numero di etichette per rotolo.

Non so quale codice sia scritto nel tag NFC di un rotolo europeo: potrebbe essere il codice articolo, il numero breve o un altro. Per questo associo **tutti i codici** di uno stesso formato, comprese le confezioni multiple: un codice in più non fa danni. Quando la lettura del rotolo funzionerà, la diagnostica mostrerà il codice vero del tag.

## Associazioni proposte

Le misure sono nel formato della tabella DYMO: larghezza × lunghezza in mm.

| Misure | Codici europei | Formato del catalogo dell'app |
|---|---|---|
| 13 × 25 (2 per riga) | S0722530, 11353 | Multiuso extra piccola 13×25 |
| 19 × 51 | S0722550, 11355, 2234186, 2234184 | Indirizzo mittente 19×51 |
| 19 × 64 | 2112284 (adesivo forte) | Codice a barre 19×64 |
| 25 × 25 | S0929120, 2112286 (adesivo forte) | Multiuso quadrata 25×25 |
| **25 × 54** | **S0722520, 11352**, 2177564, 2223589, 2112283 (adesivo forte) | **Multiuso piccola 25×54** |
| 25 × 89 | 2112285 (adesivo forte) | Scaffale 25×89 |
| 28 × 89 | S0722370, 99010, 2093091, 13188, 1983173 | Indirizzo 28×89 |
| 32 × 57 | S0722540, 11354, 2093094, 2093095, 2223590 (removibili) | Multiuso media removibile 32×57 (ha già 11354 e S0722540) |
| 32 × 57 | 2112289 (adesivo forte) | Multiuso media 32×57 |
| 36 × 89 | S0722400, 99012, 2093093, 13187, 1983172 | Indirizzo grande 36×89 |
| 36 × 89 | S0722410, 99013 (plastica semitrasparente) | Indirizzo grande 36×89 |
| 51 × 89 | S0929100 (biglietti, non adesive) | Biglietto da visita / appuntamento 51×89 |
| 54 × 70 | S0722440, 99015, 2234188, 2234185 | Multiuso grande 54×70 |
| 54 × 101 | S0722430, 99014, 2093092, 13186, 2223588, 2133399 (rosse), 2133400 (gialle) | Spedizione 54×102 (1 mm di differenza: stessa etichetta, misura arrotondata diversamente) |
| 59 × 102 | 2112290 (adesivo forte) | Spedizione grande 59×102 |
| 59 × 190 | S0722480, 99019 | Dorso raccoglitore 59×190 (ha già 99019) |
| 57 continuo | 2191636 (non adesivo) | Rotolo continuo 57 mm non adesivo |

### Formati della tabella DYMO che oggi mancano nel catalogo

Li aggiungo come **formati nuovi**. La lunghezza in punti è calcolata dalle misure, perché la libreria non fornisce la lunghezza esatta: è **da verificare con la stampa di prova**.

| Misure | Codici | Nome in italiano |
|---|---|---|
| 12 × 50 | S0722460, 99017 | Cartella sospesa 12×50 |
| 38 × 190 | S0722470, 99018 | Dorso raccoglitore stretto 38×190 |
| 41 × 89 | S0722560, 11356, 2234187, 2234183 | Badge piccolo 41×89 |

### Esclusi

- **Solo per 4XL/5XL**, cioè testina larga, non utilizzabili sulla 550: S0947410, S0947420, 2166659, 2177565, S0904980, 2128307, 2238107, 2112287.
- **Etichette gioielli 10 × 19 (2191635):** la tabella non dice se sono 2 per riga come il «Cartellino prezzo 10×19» del catalogo. Non le associo per non indovinare. Se ne usi, la diagnostica mostrerà le misure del tag.

## Come

- Nuovo file `src/printer/eu-skus.ts` con la tabella qui sopra: codice → id del formato, più i tre formati nuovi. Contiene un commento con la fonte e la data.
- `CATALOG` (`src/printer/media.ts`) unisce ai codici di ogni formato quelli europei, e aggiunge i tre formati nuovi. `findMediaBySku`, la ricerca nell'elenco e il confronto della diagnostica usano già `skus`, quindi funzionano senza altre modifiche.
- Nell'elenco dei formati, sotto ogni nome, compaiono anche i codici europei, che permettono la ricerca. Per non allungare troppo le righe mostro i codici articolo (S07…) e i numeri brevi, non quelli delle confezioni multiple; anche quelli però vengono trovati dalla ricerca e dalla lettura NFC.

## Test

- **Unitari:**
  - S0722520 e 11352 → Multiuso piccola 25×54;
  - ogni codice della tabella porta a un formato con le misure della tabella, con tolleranza di 1 mm;
  - nessun codice associato a due formati con misure diverse;
  - i tre formati nuovi hanno larghezza ≤ 57 mm e lunghezza in punti coerente con le misure;
  - un tag con il codice S0722520 letto con il driver reale diventa «Multiuso piccola 25×54» dal catalogo.
- **E2E:** la ricerca «S0722520» nell'elenco dei formati mostra Multiuso piccola 25×54.

## Note di implementazione (2026-11-03)

- Tabella in `src/printer/eu-skus.ts` (`EU_CODES`, `EU_NEW_FORMATS`).
- In `CATALOG` ogni formato riceve i codici europei «mostrati», cioè codici articolo e numeri brevi, e si aggiungono i tre formati nuovi. I codici delle confezioni multiple restano in una mappa a parte: `findMediaBySku` e la ricerca li trovano (`allSkus()`), ma non compaiono nell'elenco.
- Nella tabella DYMO l'ordine delle misure non è sempre lo stesso del catalogo. Per esempio 32×57: nel catalogo è larga 57 mm attraverso il rotolo e lunga 32. I test confrontano quindi le misure in entrambi i versi.
- Test:
  - 6 unitari, tra cui la lettura con il driver reale di un tag con codice S0722520, che porta al catalogo con 638 punti di lunghezza;
  - 1 e2e: la ricerca di «S0722520» e del codice di una confezione multipla.

  Tutti i test passano, comprese le prestazioni.
