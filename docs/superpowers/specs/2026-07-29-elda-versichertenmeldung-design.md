# @kreiseck/elda v2 — Versichertenmeldung reduziert (E.29) Design

**Ziel:** Das Paket `@kreiseck/elda` um die Erzeugung von Versichertenmeldungen
erweitern — An-, Ab-, Änderungsmeldung, Richtigstellung und Storno — als
Festsatz-Datenbestand, der unverändert in das bestehende `senden` aus v1 geht.
Bisher transportiert das Paket nur; ab v2 kann es den Dateiinhalt auch erzeugen.

**Abgrenzung:** v2 deckt ausschließlich Kapitel E.29 „Versichertenmeldung
reduziert" ab. Die monatliche Beitragsgrundlagenmeldung (E.32, 73 Seiten), die
VSNR-Anforderung (E.30) und die Anmeldung fallweise Beschäftigter (E.18) sind
eigene Stufen mit eigenen Specs.

## Quellen (verifiziert, nicht geraten)

| Dokument | Stand | Verwendet für |
|---|---|---|
| Organisationsbeschreibung „Datenaustausch mit Dienstgebern" (DM-ORG), 42. Ergänzung, Version 42.7.0 | 07/2026 | Kapitel C.1 (Bestandsaufbau), D (Datenfelder), E.1 (Identifikationsteil), E.2 (Vorlaufsatz), E.3 (Schlusssatz), E.29 (Satzaufbau, Pflichtmatrix, Erstellvorschriften) |
| Zeichensätze | 11/2019 | Zulässiger Zeichenvorrat je Feldklasse |
| ELDA Transfer-Webservice, Schnittstellenbeschreibung V4 | 05/2026 | Vorgaben zum `dateiName` (max. 255, Pflicht) |

Alle drei sind über die ELDA-Downloadseiten öffentlich abrufbar. Die
Satzstruktur E.29 trägt Version 03, gültig ab 01.12.2025, zwingender Einsatz ab
01.02.2026 — also die derzeit verbindliche Fassung.

## Harte Vorgaben

- **Nichts raten.** Jede Feldposition, jede Länge, jeder Pflichtstatus und jeder
  Zeichenvorrat stammt belegbar aus den Quellen oben. Wo eine Regel nur in Prosa
  ohne durchgerechnetes Beispiel steht, wird sie NICHT in Code gegossen.
- **Tests aus dem Dokument.** Die 26 durchgerechneten Beispiele aus E.29.2
  (verteilt über alle sieben Satzarten) werden zu Testfällen. Damit prüfen die
  Tests nicht unsere Lesart gegen sich selbst, sondern gegen das Dokument — die
  ausdrückliche Schwäche von v1.
- **Kein stiller Datenverlust.** Ein nicht darstellbares Zeichen, ein zu langer
  Wert oder ein fehlendes Pflichtfeld führt zu einem Fehler, niemals zu
  stillschweigendem Abschneiden, Ersetzen oder Auffüllen.
- Keine neuen Laufzeitabhängigkeiten. Weiterhin nur `@kreiseck/finanzonline-core`.
- Doku und Kommentare auf Deutsch, im Stil der bestehenden Pakete.

## Der Satzaufbau (belegt)

Ein Datenbestand besteht aus einem Vorlaufsatz, den Meldungssätzen und einem
Schlusssatz. Jeder Satz beginnt mit dem 20 Zeichen langen Identifikationsteil:

| Pos. | Länge | Feld | Inhalt |
|---|---|---|---|
| 1 | 2 a/n | SART | Satzart |
| 3 | 7 n | SANR | laufende Satznummer, je Bestand bei 1 beginnend, lückenlos aufsteigend |
| 10 | 2 a/n | UVST | datenübernehmender Versicherungsträger |
| 12 | 7 n | OBUS | Ordnungsbegriff der übermittelnden Stelle (Seriennummer) |
| 19 | 2 a/n | VSTR | zuständiger Versicherungsträger |

Formatregeln aus E.1: alphanumerische Felder linksbündig, Grundstellung blank;
numerische Felder rechtsbündig, Grundstellung 0, führende Nullen, keine
Interpunktion — auch kein Dezimalkomma.

Der Vorlaufsatz (SART `00`) trägt 16 Felder, darunter `PROJ` (`DM`, oder `TM`
für Testdaten), `BEST` (Bestandsbezeichnung), Datenträgernummer, Erstellungsdatum
und -zeit, die Herstellerangaben, die Versionsnummer der Satzstrukturen und ein
Reserve-Feld. Der Schlusssatz trägt Satzanzahl, ELDA-Seriennummer,
Hersteller-Mailadresse und ebenfalls ein Reserve-Feld.

**Die Bestandskennung für Versichertenmeldungen ab 2019 ist `VR`.** Das
naheliegende `VM` gilt laut Vorlaufsatz-Beschreibung ausdrücklich nur für
Zeiträume bis 31.12.2018 und wäre ein stiller Fehler.

Die Reserve-Felder füllen Vorlauf- und Schlusssatz auf die Satzlänge der
Datensätze auf; innerhalb eines Bestands sind damit alle Sätze gleich lang. Für
einen reinen E.29-Bestand sind das 772 Zeichen.

## Die Meldung (E.29)

Ein Satzaufbau mit 39 Feldern trägt sieben Satzarten, die sich ausschließlich
darin unterscheiden, welche Felder zwingend, bedingt oder verboten sind:

| Satzart | Bedeutung |
|---|---|
| `M3` | Anmeldung |
| `M4` | Abmeldung |
| `M6` | Änderungsmeldung |
| `M8` | Richtigstellung Anmeldung |
| `M9` | Richtigstellung Abmeldung |
| `S3` | Storno Anmeldung |
| `S4` | Storno Abmeldung |

Die Pflichtmatrix aus E.29.1 kennt fünf Stufen, die eins zu eins übernommen
werden: `Z` (Angabe zwingend), `Z1` (zwingend, wenn zutreffend), `Z3` (Angabe
möglich), `V` (zwingende Angabe bei Veränderung) und `-` (keine Angabe, Feld in
Grundstellung).

Ein Feld verdient besondere Erwähnung, weil seine Kodierung nicht zu erraten
wäre: `VWAZ`, das Ausmaß der vereinbarten wöchentlichen Arbeitszeit, ist bei
Anmeldungen mit Melde­datum nach dem 31.12.2025 anzugeben. Es fasst Stunden mit
kaufmännischer Rundung auf zwei Nachkommastellen in vier Ziffern ohne
Dezimaltrenner — 15 Stunden und 40 Minuten werden laut Dokument als `1567`
übermittelt. Bei vereinbarter Überstundenpauschale ist die Normalarbeitszeit
ohne Überstunden zu melden, und eine spätere Änderung der Arbeitszeit im Lauf
der Beschäftigung ist ausdrücklich NICHT zu melden.

Prüfbar und damit durchsetzbar sind davon `Z` und `-`: Ein fehlendes `Z`-Feld ist
objektiv ein Fehler, ein belegtes `-`-Feld ebenso. `Z1` und `V` hängen an einer
fachlichen Bedingung, die das Paket nicht kennt — sie werden dokumentiert, nicht
erzwungen. `Z3` ist ohnehin freigestellt.

## Zeichensatz — die schärfste Einschränkung

Fixlängen-Dateien sind **ISO-8859-15** kodiert. Node kennt diesen Zeichensatz
nicht; `latin1` entspricht ISO-8859-1 und weicht an acht Positionen ab. Das
Paket bringt daher einen eigenen, abhängigkeitsfreien Kodierer mit: `latin1` als
Grundlage, die acht abweichenden Codepunkte (unter anderem das Eurozeichen an
`0xA4`) als Tabelle darüber.

Zusätzlich schränkt das Zeichensatz-Dokument den zulässigen Vorrat je Feldklasse
ein — deutlich strenger als der Zeichensatz selbst:

- **Personennamen:** Leerzeichen, `'`, `-`, `.`, Ziffern, `A–Z`, `a–z`, sowie
  `Ä Ö Ü ß ä ö ü`. Mehr nicht.
- **Unternehmensnamen und Adressen:** zusätzlich Interpunktion und weite Teile
  des oberen ISO-8859-15-Bereichs.

Ein Name wie „Đorđević" ist damit nicht übermittelbar. Das Paket **wirft** in
diesem Fall und nennt Feld, Zeichen und Position. Es transliteriert nicht und
ersetzt nicht: Wie ein Name behelfsweise zu schreiben ist, wenn der Zeichenvorrat
ihn nicht hergibt, ist eine fachliche Entscheidung des Dienstgebers, keine
Ersetzungstabelle im Code. Ein stillschweigend verstümmelter Name in einer
Meldung an die Sozialversicherung wäre genau der Schaden, den dieses Paket
vermeiden soll.

## Aufbau

| Datei | Verantwortung |
|---|---|
| `src/festsatz.ts` | Generische Serialisierung: aus Feldtabelle und Werten einen Satz bauen; Länge, Typ und Ausrichtung erzwingen |
| `src/zeichensatz.ts` | ISO-8859-15-Kodierung und Prüfung des zulässigen Vorrats je Feldklasse |
| `src/felder-e29.ts` | Die 39 Felder aus E.29 als Daten: Nummer, Position, Länge, Typ, Name |
| `src/pflicht-e29.ts` | Die Pflichtmatrix aus E.29.1 als Daten |
| `src/bestand.ts` | Vorlaufsatz, laufende Satznummer, Schlusssatz; erzeugt den fertigen Dateiinhalt |
| `src/versichertenmeldung.ts` | Die sieben Builder über den obigen Bausteinen |

Die Trennung folgt der Doku: `festsatz` und `zeichensatz` sind meldungsunabhängig
und für spätere Stufen (mBGM, VSNR-Anforderung) wiederverwendbar; `felder-e29`
und `pflicht-e29` sind reine Datenabbilder je eines Dokumentkapitels und damit
gegen das Dokument prüfbar, ohne Logik zu enthalten.

## Öffentliches API (Entwurf)

```ts
const bestand = erstelleBestand({
  umgebung: 'kundentest',        // steuert PROJ: 'DM' im Echtbetrieb, 'TM' im Test
  seriennummer, versicherungstraeger, hersteller: { … },
  meldungen: [
    anmeldung({ bkNr, dienstgebername, vsnr, adat, beschaeftigungsbereich, … }),
    abmeldung({ … }),
  ],
});

await elda.senden({ dateiName: 'meldung.txt', inhalt: bestand });
```

Die Builder liefern Sätze, `erstelleBestand` klammert sie und liefert einen
`Buffer` in ISO-8859-15 — genau die Form, die `senden` erwartet. Der `dateiName`
bleibt Sache des Aufrufers; das Paket prüft lediglich vorab, was die
Schnittstellenbeschreibung fordert (gesetzt, höchstens 255 Zeichen), damit der
Fehler lokal auffällt statt als Status `401`/`402` von ELDA.

## Was das Paket zusichert — und was nicht

**Zugesichert:** Der erzeugte Bestand ist strukturell korrekt — Feldpositionen,
Längen, Ausrichtung, Zeichensatz, Satznummerierung, Umschlag, sowie die
objektiv prüfbaren Teile der Pflichtmatrix.

**Nicht zugesichert:** dass die Meldung fachlich richtig ist. Die
Erstellvorschriften aus E.29.2 enthalten Regeln, deren Verletzung eine
strukturell einwandfreie, inhaltlich falsche Meldung erzeugt — etwa: bleibt bei
einer Richtigstellung das Feld `BVAB` unbelegt, wird die Zeit der betrieblichen
Vorsorge storniert. Solche Regeln werden in der README wörtlich zitiert und dem
Aufrufer überlassen, soweit das Dokument sie nicht selbst durchrechnet.

Wo das Dokument ein Beispiel liefert, wird die Regel kodiert und gegen genau
dieses Beispiel getestet. Wo es keines liefert, bleibt sie Dokumentation. Diese
Grenze verläuft damit nicht nach Bauchgefühl, sondern danach, ob die Quelle die
Regel überprüfbar macht.

## Testing

- Die 26 Beispiele aus E.29.2 als Testfälle, jeweils mit Quellenangabe
  (Kapitel und Satzart) im Testnamen.
- Die Feldtabelle gegen das Dokument: lückenlose Positionen, Summe der Längen
  ergibt die Satzlänge, keine Überlappung.
- Zeichensatz: je Feldklasse ein zulässiges und ein unzulässiges Zeichen; das
  Eurozeichen als Unterscheidungsfall zwischen ISO-8859-1 und ISO-8859-15.
- Umschlag: Satznummern lückenlos ab 1, Satzanzahl im Schlusssatz stimmt,
  Vorlauf- und Schlusssatz auf Satzlänge aufgefüllt, `PROJ` folgt der Umgebung.
- Pflichtmatrix: je Satzart ein fehlendes `Z`-Feld und ein belegtes `-`-Feld
  führen zum Fehler.

## Offene Punkte

- Der Prüfkatalog zur 42. Ergänzung (Excel) enthält feldweise Prüfregeln, die
  über die DM-ORG hinausgehen. Er wird vor der Umsetzung gesichtet; Regeln, die
  sich als Daten abbilden lassen, kommen hinzu, der Rest wird dokumentiert.
- Die Software-Identifikationsnummer (`SOID`) im Vorlaufsatz ist optional. Ob
  ELDA sie für Übermittlungen aus Fremdsoftware erwartet, ist mit dem
  Kundentest-Zugang zu klären.
- Ob ELDA für den Dateinamen eine Konvention erwartet, geht aus den Quellen nicht
  hervor — nur Pflicht und Maximallänge sind belegt.
- Wie bei v1 gilt: Erst ein Durchlauf gegen das Kundentestsystem macht diese
  Stufe produktionsreif.
