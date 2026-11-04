# @kreiseck/finanzonline

Clients für FinanzOnline-Verfahren jenseits der Registrierkasse:

- **Umsatzsteuervoranmeldung (U30)** — prüfen, berechnen, XML bauen, senden,
  Übermittlungsprotokoll lesen.
- **DataBox** (`getDatabox`/`getDataboxEntry`) — Bescheide, Protokolle und
  sonstige Zustellungen abholen (z. B. RKSV-Ergebnisprotokolle, UID-Bescheide).
- **FileUpload** (`upload`) — Erklärungen als XML übermitteln.

## Installation

```bash
npm install @kreiseck/finanzonline
```

Node ≥ 20.18. Baut auf [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Session/Transport).

## Umsatzsteuervoranmeldung (U30)

Kennzahlen rein, amtlich korrektes XML raus — mit getrennten Schritten, damit
vor dem Senden alles sichtbar und prüfbar ist. Alle Beträge in **ganzen Cent**.

```ts
import { createSession } from '@kreiseck/finanzonline-core';
import { berechneU30, createU30, istUebernommen, pruefeU30, type U30Paket } from '@kreiseck/finanzonline';

const paket: U30Paket = {
  paketNr: 1003, // vom Aufrufer, eindeutig halten (Zuordnung des Protokolls)
  erklaerungen: [
    {
      steuernummer: '911234565', // 9 Ziffern, wird mit Prüfziffer geprüft
      zeitraum: { jahr: 2026, quartal: 3 }, // oder { jahr: 2026, monat: 9 }
      kennzahlen: {
        kz000: 1489092, kz022: 1489092, kz057: 35227,
        kz070: 643490, kz072: 643490,
        kz060: 79284, kz065: 128698, kz066: 35227,
      },
      kundeninfo: 'Q3-2026',
      erwarteteSteuer: { kz022: 297818 }, // optional: Kontrolle gegen eigene Belegsummen
    },
  ],
};

// 1. Prüfen (ohne Netz): alle Fehler auf einmal, je mit stabilem Code
const fehler = pruefeU30(paket); // [] = gültig, sonst z. B. { code: 'SUMME_STEUERPFLICHTIG_UNGLEICH', … }

// 2. Rechnen wie FinanzOnline (ohne Netz): Steuer je Satz, Zahllast/Gutschrift
const { ergebnis, art } = berechneU30(paket.erklaerungen[0]!.kennzahlen); // 218534, 'zahllast'

// 3. Senden — Standard ist der Testmodus (T)
const vorher = new Date();
const session = await createSession({ /* tid, benid, pin, herstellerid */ });
const u30 = createU30(session);
const r = await u30.sende(paket); // Test (T)
// const r = await u30.sende(paket, { echt: true }); // Echtbetrieb (P) — nur so
// r.angenommen: rc 0 = zur Prüfung übernommen (noch nicht eingebracht!), r.xml: gesendetes XML

// 4. Protokoll abholen (kommt nach Sekunden bis Minuten; markiert als gelesen)
const [eintrag] = await u30.protokolle({ von: vorher, bis: new Date(), paketNr: 1003 });
// eintrag.xml: Roh-XML (aufbewahren); eintrag.protokoll fehlt, wenn unlesbar (Grund in eintrag.fehler)
if (eintrag?.protokoll) {
  istUebernommen(eintrag.protokoll, 1); // true | false | undefined (= Protokoll sagt es nicht sicher)
  // eintrag.protokoll.saetze[0]?.fehler: FEHLTEXT von FinanzOnline
}
await session.logout();
```

Wichtig:

- **Standard ist immer der Testmodus (`T`).** Echt nur mit `echt: true`; jeder
  andere Wert wirft, bevor etwas gesendet wird. `sende` wiederholt nie
  automatisch.
- `sende` prüft immer zuerst und sendet bei Fehlern nichts (`U30PruefError`
  mit allen Befunden). Geprüft werden Form, Zeitraum (in Wiener Zeit, nur
  abgeschlossene Zeiträume ab 01/2022), Wertebereiche, Vorzeichen, Zeichensatz
  (nur ISO-8859-1 in `kundeninfo`) und alle BMF-Prüfregeln „Prüfungen UVA ab
  7/2026". FinanzOnline selbst prüft den XSD-Wertebereich nicht — darum prüft
  die Bibliothek ihn.
- Nicht prüfbar ist nur, was FinanzOnline kennt: bereits eingebracht,
  Umsatzsteuersignal, Monat/Quartal passend zum Unternehmen. Der Testmodus
  prüft diese Punkte ebenfalls nicht.
- **Berichtigung** = vollständige neue U30 desselben Zeitraums mit allen
  Kennzahlen; `berichtigung: true` sperrt dann den Antrag auf
  Überschussverwendung (ARE). Wie oft ein Zeitraum schon übermittelt wurde,
  führt der Aufrufer.
- Steuer je Satz wird je Zeile auf Cent gerundet, halbe Cent auf (§ 204 BAO,
  BMF-Formular). Eigene Belegsummen können um Cent abweichen —
  `erwarteteSteuer` macht das vor dem Senden sichtbar (`STEUER_WEICHT_AB`).
- Testprotokolle löscht FinanzOnline 31 Tage nach Zustellung; das Roh-XML
  steht in `eintrag.xml` zum Aufbewahren.
- **Eingebracht ist eine Erklärung erst, wenn das Protokoll es belegt.**
  `istUebernommen` liefert `true` nur bei positivem Beleg, `false` bei
  Ablehnung und `undefined`, wenn das Protokoll es nicht sicher sagt
  (`ergebnis: 'unbekannt'`, z. B. ein noch unbekanntes Format) — dann nicht als
  eingebracht werten und das Roh-XML ansehen.
- **Unklarer Ausgang nach dem Senden** (Zeitüberschreitung, `FonTransportError`,
  `FonProtocolError`, HTTP-Fehler ohne Fault): Ob FinanzOnline das Paket
  bekommen hat, ist dann unbekannt. **Nicht neu senden**, sondern zuerst
  `protokolle({ paketNr })` abfragen. Eine zweite echte Übermittlung desselben
  Zeitraums gilt als Berichtigung — und davon nimmt die Schnittstelle laut
  Anbietern nur eine an.
- Die Eingabe muss reine Daten sein: Es zählen nur eigene, aufzählbare
  Eigenschaften (je einmal gelesen). Unbekannte Felder (`FELD_UNBEKANNT`) und
  Schalter, die nicht `true`/`false` sind (`SCHALTER_UNGUELTIG`), werden
  gemeldet statt still ignoriert.

Hintergrund, Quellen und Testlauf: `docs/research/2026-11-03-finanzonline-inventar.md`,
Design: `docs/superpowers/specs/2026-11-04-u30-design.md` (im Repository).

## FileUpload

`createFileUpload(session)` sendet ohne weitere Angabe im **Testmodus (`T`)**;
Echtbetrieb nur mit `createFileUpload(session, { uebermittlung: 'echt' })`.

## DataBox-Einträge auflisten und abholen

```ts
import { createSession } from '@kreiseck/finanzonline-core';
import { createDatabox } from '@kreiseck/finanzonline';

const session = await createSession({ /* … */ });
const databox = createDatabox(session);

// Ohne erltyp: nur ungelesene Einträge. Mit erltyp: auf einen Erledigungstyp
// eingrenzen (z. B. 'P' für Protokolle).
const eintraege = await databox.liste({ erltyp: 'P' });

for (const e of eintraege) {
  console.log(e.applkey, e.filebez, e.gelesen);
}

const erster = eintraege[0];
if (erster) {
  const { fileart, inhalt } = await databox.eintrag(erster.applkey, erster.fileart);
  // inhalt: Buffer — je nach fileart XML oder PDF
}
```

**Achtung:** `databox.eintrag(...)` markiert den Eintrag in der DataBox als
gelesen (`getDataboxEntry` setzt serverseitig den Gelesen-Status). Ein erneuter
Abruf desselben `applkey` liefert den Inhalt zwar weiterhin, der Eintrag taucht
in `liste()` ohne `erltyp`-Filter danach aber nicht mehr unter den ungelesenen
Einträgen auf.

## Zeitfenster bei `liste()`

Wird `von`/`bis` angegeben, gilt laut BMF-Spezifikation:

- **`von` maximal 31 Tage** in der Vergangenheit.
- **Die Spanne zwischen `von` und `bis` maximal 7 Tage.**

Verstöße quittiert der Dienst mit einem fachlichen Fehlercode (`rc != 0`), der
als `FonRcError` (Unterklasse von `FonProtocolError`) geworfen wird.

FinanzOnline liest `von`/`bis` als **Wiener Ortszeit** ohne Offset. Die
Bibliothek rechnet die übergebenen `Date`-Werte deshalb nach `Europe/Vienna` um,
unabhängig von der Zeitzone des Servers. Das gelieferte `tsZust` trägt den
Offset (z. B. `2026-11-03T20:20:59.206+01:00`) und lässt sich direkt mit
`new Date(e.tsZust)` vergleichen. Die beiden Grenzen oben gelten in Wiener Zeit.

## UID-Bescheid über die DataBox abholen

Nach einer FON-UID-Abfrage der Stufe 1/2 (siehe [`@kreiseck/uid`](https://www.npmjs.com/package/@kreiseck/uid))
legt das BMF den Bescheid am Folgetag in der DataBox ab (§ 132 BAO). Um ihn zu
finden, `liste()` ohne engen `erltyp`-Filter abrufen und über das Feld
`anbringen` auf den UID-Vorgang eingrenzen:

```ts
const eintraege = await databox.liste({ von: gestern, bis: heute });
const bescheid = eintraege.find((e) => e.anbringen === 'UID' /* Wert offen, siehe unten */);
```

**Offener Punkt:** Der genaue Wert von `anbringen` für UID-Bescheide ist noch
nicht an einer echten FinanzOnline-Antwort verifiziert. Vor produktivem
Einsatz gegen eine Testumgebung bestätigen und diesen Abschnitt entsprechend
aktualisieren.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
