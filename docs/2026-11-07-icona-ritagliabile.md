# Icona ritagliabile per la schermata home (manifest)

- Data: 2026-11-07
- Stato: **confermato, realizzato e verificato sul Pixel con GrapheneOS (2026-11-07)**: niente bordo bianco, pettirosso intero alla scala 0,65

## Perché

L'utente ha aggiunto l'app alla schermata home su GrapheneOS con «Aggiungi a schermata Home» di Vanadium. Il risultato è il quadrato blu del pettirosso **dentro un quadrato bianco**.

Il motivo:
- Android vuole icone **adattive**, che il telefono ritaglia nella sua forma (cerchio, quadrato arrotondato, goccia…).
- Oggi l'app offre solo icone "normali": `icona-192.png` e `icona-180.png`, vedi `docs/2026-11-07-icona-pettirosso.md`.
- Senza un'icona dichiarata ritagliabile, il browser non sa se può tagliarla. Allora la rimpicciolisce e la mette su un fondo bianco.

## Cosa cambia

1. **Nuova icona ritagliabile:** `public/icona-ritagliabile.svg`, bozza in `docs/2026-11-07-icona-pettirosso/e-ritagliabile.svg`.
   - Fondo blu pieno fino ai bordi.
   - Pettirosso ed etichetta più piccoli, dentro la **zona sicura**: il cerchio centrale che resta visibile con qualunque ritaglio.
   - `anteprima-ritagli.png` la mostra tagliata a cerchio, quadrato arrotondato e goccia.
   - Da questa si generano `icona-ritagliabile-192.png` e `icona-ritagliabile-512.png`, con lo stesso script `scripts/make-icons.mjs`.
2. **Nuovo file `public/manifest.webmanifest`**, collegato da `index.html` con `<link rel="manifest">`. Contiene:
   - nome «Etichettatrice»;
   - colori del tema (blu `#274e76` per lo sfondo d'avvio);
   - le icone: quelle normali (`purpose: "any"`) e quelle ritagliabili (`purpose: "maskable"`);
   - `display: "browser"`: l'app si apre **come oggi**, nella scheda del browser con la barra dell'indirizzo.
3. Le icone di oggi restano per la scheda del browser e per iPhone.

## Da scegliere

Con il manifest, l'app potrebbe aprirsi anche **a tutto schermo, senza la barra del browser** (`display: "standalone"`). Lo propongo **per dopo**, come parte della PWA (fase 3), perché cambia il comportamento:
- il tasto indietro;
- l'aggiornamento della pagina;
- come si apre la diagnostica.

Queste cose vanno provate sulla stampante. Per ora `browser` corregge solo l'icona, senza altri effetti.

## Cosa non cambia

- Niente service worker né funzionamento offline: restano alla fase 3.
- Il WebUSB, la stampa e l'interfaccia.

## Attenzione

- **Il collegamento già messo sulla home non si aggiorna da solo:** va tolto e rimesso dopo la pubblicazione.
- Vanadium è basato su Chromium, che usa le icone ritagliabili anche per «Aggiungi a schermata Home». Il risultato va comunque verificato a vista sul Pixel, perché non posso provarlo qui.
  - Se Vanadium mostrasse ancora il bordo bianco, l'alternativa è aspettare la PWA completa.

## Test

- **E2E:**
  - la pagina collega il manifest;
  - il manifest si carica ed è JSON valido, con nome, `display: "browser"`, almeno un'icona `any` e una `maskable`;
  - ogni icona dichiarata si carica con il tipo giusto e le dimensioni giuste.
- **Unitario:** l'icona ritagliabile sta nella zona sicura. Si controlla il PNG a 512: fuori dal cerchio di raggio 40 % c'è solo il blu dello sfondo.
- **A vista:** sul Pixel con GrapheneOS, togliere e rimettere l'app sulla home, poi controllare che il bianco sia sparito.

## Note di implementazione (2026-11-07)

- **Icona ritagliabile:** `public/icona-ritagliabile.svg`. Il pettirosso è ridotto al 76 % rispetto alla bozza D, e i PNG da 192 e 512 sono generati da `scripts/make-icons.mjs`.
- **Manifest:** `public/manifest.webmanifest`, con `display: "browser"`, collegato da `index.html`.
- **Test:** spostati tutti in `tests/e2e/icons.spec.ts`, 3 test:
  - le icone della pagina;
  - il manifest, con tipi e dimensioni di ogni icona;
  - la zona sicura: fuori dal cerchio di raggio 40 % i pixel sono solo blu.
- **Differenza dal piano:** il controllo della zona sicura è un test e2e e non unitario, perché leggere i pixel del PNG è più semplice nel browser.

## Correzione dopo la prova su GrapheneOS (2026-11-07)

- **Prova sul Pixel:** il bordo bianco è sparito, ma etichetta e coda erano un po' tagliate.
- **Causa:** Vanadium passa l'icona ad Android come icona adattiva nativa:
  - livello da 108dp, di cui sono visibili i 72dp centrali (66,7 %);
  - zona sicura: cerchio da 66dp, cioè il **61 %**, più stretto dell'80 % dello standard web.
- **Correzione:**
  - pettirosso ridotto al 60 % (`translate(100 76) scale(0.6)`);
  - il test controlla il cerchio di raggio 30,5 %;
  - `anteprima-ritagli.png` simula il taglio di Android.
- **Da verificare di nuovo sul Pixel:** togliere e rimettere l'icona.

## Pettirosso un po' più grande (2026-11-07)

- **Risultato sul Pixel con la scala 0,6:** etichetta e coda intere. L'utente chiede il pettirosso leggermente più grande.
- **Nuova scala 0,65** (`translate(87 61) scale(0.65)`): il disegno arriva al 32 % circa del raggio. Il ritaglio a cerchio di Android mostra fino al 33,3 %.
- **Cosa si perde:** si esce di poco dalla zona sicura teorica del 30,5 %. Su un launcher che ritaglia più stretto, o durante le animazioni, la punta dell'etichetta potrebbe sfiorare il bordo. È una scelta accettata per avere il pettirosso più grande.
- **Test:** controlla il raggio del 32,5 %.
