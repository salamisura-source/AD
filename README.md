# Produzione Touch

Terminale da usare su tablet, in reparto, per registrare la produzione. Gli elenchi (commesse, prodotti, fasi, colori, pezzi, scarti, operatori) arrivano da `produzione_dipendenze.csv`, esportato dal foglio Excel `produzione_dipendenze.xlsx`.

## Apri l'app

https://salamisura-source.github.io/AD/

Si può anche aggiungere alla schermata Home del tablet: dal browser, *Aggiungi a Home* / *Installa app*. Dopo la prima apertura funziona anche senza rete, con gli ultimi elenchi scaricati.

## Come si registra

1. Tocca **Badge** e inserisci il numero operatore.
2. Scegli commessa, prodotto, fase e colore. I pulsanti grandi sono pensati per il dito.
3. Imposta pezzi e scarti. I numeri rapidi sono quelli del file; con `+` / `−` o toccando il numero si può inserire un altro valore.
4. Premi **REGISTRA PRODUZIONE**.

Il badge resta impostato per le registrazioni successive. **Nuova registrazione** azzera solo la scelta in corso.

## Dove finiscono i dati

Le registrazioni restano **su quel dispositivo**, nello storico del browser. Non vengono inviate a GitHub.

- **Storico** mostra la giornata, i totali e il dettaglio. Da lì si esporta il CSV (punto e virgola, apribile da Excel in italiano) o si cancella una riga.
- Nel **Menu** si può attivare *Scarica il riepilogo Excel a ogni registrazione*. Il file si chiama `riepilogo_produzione_DATA.xls`.
- Su Chrome/Edge si può anche **selezionare una cartella**: il riepilogo del giorno viene aggiornato lì, senza una nuova finestra di download ogni volta.

## Aggiornare gli elenchi

L'app legge `produzione_dipendenze.csv`. Ogni colonna è un elenco di valori ammessi, non una riga di produzione già fatta.

1. Aggiorna il foglio `Dipendenze` nell'Excel.
2. Esporta di nuovo il CSV con separatore `;` e le stesse intestazioni: `Commessa;Prodotto;Fase;Colore;Pezzi;Scarti;Operatore`.
3. Sostituisci `produzione_dipendenze.csv` in questo repository.
4. Sul tablet premi **Menu → Ricarica elenchi da GitHub**.

In alternativa, **Menu → Carica file Excel o CSV** legge un file solo per quella sessione, finché non si ricarica la pagina.

Il file `produzione_touch(4).html` è la versione precedente, lasciata come riferimento. L'app pubblicata è `index.html`.

## Nota

Il repository è pubblico: gli elenchi sono visibili a chi ha il link. Le registrazioni no, restano nel browser e nei file esportati.
