# Icona ritagliabile per la schermata home (manifest)

- Data: 2026-11-07
- Stato: **confermato e realizzato (2026-11-07)**, da verificare a vista su GrapheneOS

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
