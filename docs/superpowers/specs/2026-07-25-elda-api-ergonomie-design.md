# @kreiseck/elda — API-Ergonomie (v0.2) Design

**Ziel:** Das öffentliche API von `@kreiseck/elda` so umbauen, dass es sich nicht
falsch benutzen lässt, ohne dabei Information zu verlieren. Die Transport-Schicht
selbst (Envelope, Security, Parsing, Retry, Status-Tabelle) bleibt unverändert —
dies ist ausschließlich ein Schnitt durch die Oberfläche.

Grundlage ist die bestehende Umsetzung aus
`2026-07-25-elda-transfer-webservice-design.md`; diese Spec ersetzt deren
Abschnitt „Öffentliches API (v1)".

**Anlass:** In v0.1 muss der Aufrufer nach jedem Aufruf `ok` prüfen. Vergisst er
es, läuft der Code nach einer von ELDA abgelehnten Meldung weiter, als wäre alles
in Ordnung — der teuerste Fehler, den man mit dem Paket machen kann. Gleichzeitig
darf die Korrektur nicht dazu führen, dass Status-Codes und Meldungen von ELDA
unterschlagen werden.

## Harte Vorgaben

- **Kein stiller Fehlschlag.** Ein Zustand, den der Aufrufer nicht sinnvoll
  behandeln kann, darf nicht ignorierbar sein.
- **Kein Informationsverlust.** Alles, was ELDA sagt, bleibt für den Aufrufer
  erreichbar — auch im Fehlerfall.
- **Erwartete Zustände sind kein Kontrollfluss über Exceptions.**
- **Volle Kontrolle bleibt möglich.** Wer die Rohdaten will, bekommt sie.
- Keine neuen Laufzeitabhängigkeiten. Weiterhin nur `@kreiseck/finanzonline-core`.
- Breaking Changes sind erlaubt: Das Paket ist weder gepusht noch publiziert.

## Die Leitunterscheidung: Fehler vs. Zustand

Die 18 Status-Codes des Transfer-Webservice zerfallen in zwei Klassen, die
unterschiedlich behandelt gehören.

**Ausnahmen — der Aufruf ist kaputt, Zugang falsch oder ELDA hat ein Problem.**
Niemand behandelt diese an der Aufrufstelle sinnvoll; sie zu übersehen ist immer
ein Bug. Diese Codes werfen:

| Code | Bedeutung |
|---|---|
| `500` | Interner Verarbeitungsfehler |
| `551` | Request abgelaufen (`created` älter als 60 Sekunden) |
| `552` | Nonce wurde bereits verwendet |
| `553` | Seriennummer für dieses Service nicht berechtigt |
| `554` | Nonce nicht gesetzt |
| `555` | `created` nicht gesetzt |
| `557` | API-Key ungültig |
| `558` | Seriennummer und/oder Kundenpasswort falsch |
| `559` | Unerlaubter Content-Type |
| `401` | `dateiName` zu lang (max. 255) |
| `402` | `dateiName` nicht gesetzt |
| `403` | Datei nicht verarbeitet |
| `407` | Keine Berechtigung, Datei zu empfangen |

**Erwartete Zustände — legitime Auskünfte im Poll-Betrieb.** Wer nach einem
Timeout erneut sendet, bekommt `405`; das ist kein Fehler, sondern die Auskunft
„habe ich schon". Diese Codes kommen als Wert zurück:

| Code | Bedeutung | Repräsentation |
|---|---|---|
| `000` | OK | `zustand: 'angenommen'` bzw. `'datei'` |
| `404` | Datei wird noch verarbeitet | `zustand: 'nochInArbeit'` |
| `405` | Datei ist Duplikat | `zustand: 'duplikat'` |
| `406` | Datei mit Protokollnummer nicht vorhanden | `zustand: 'nichtVorhanden'` |
| `408` | Datei wurde bereits empfangen | `zustand: 'bereitsEmpfangen'` |

Beide Methoden benennen ihren Ausgang über dasselbe Feld `zustand`. Das ist aus
TypeScript heraus eine verengbare Union und aus JavaScript heraus ein lesbarer
String — anders als mehrere unabhängige Boolean-Flags, die sich widersprechen
könnten.

Ein Code, der in keiner der beiden Listen steht (ELDA erweitert die Tabelle),
wird wie eine Ausnahme behandelt — Werfen ist die sichere Vorgabe.

## Öffentliches API (v0.2)

### Client bauen

```ts
const elda = createEldaTransfer({
  seriennummer: string,
  kundenpasswort: string,   // Klartext, wird intern SHA-512-gehasht
  apiKey: string,
  umgebung: EldaUmgebung,   // PFLICHT: 'produktion' | 'kundentest' | 'sit'
  endpoint?: string,        // Vorrang vor umgebung
  transport?: TransportOptions,
});
```

`umgebung` verliert seinen Default. Ein vergessenes Feld darf keine echten
SV-Meldungen in den Echtbetrieb schicken. Zusätzlich prüft die Factory zur
Laufzeit — für Aufrufer aus reinem JavaScript, wo der Compiler nicht greift:

- `umgebung` ist einer der drei Werte, sonst `EldaError` mit Nennung der
  gültigen Werte. Ist `endpoint` gesetzt, ist `umgebung` optional.
- `seriennummer`, `kundenpasswort`, `apiKey` sind nicht-leere Strings, sonst
  `EldaError`. Ein leerer API-Key soll beim Bauen scheitern, nicht später als
  `557` bei ELDA.

### senden

```ts
senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<Gesendet>

interface Gesendet {
  /**
   * `'angenommen'` (000), `'nochInArbeit'` (404 — angenommen, Verarbeitung
   * dauert an) oder `'duplikat'` (405 — lag ELDA bereits vor). In allen drei
   * Fällen liegt die Datei bei ELDA; kein Fall ist ein Fehler.
   */
  zustand: 'angenommen' | 'nochInArbeit' | 'duplikat';
  /** Von ELDA vergebene Protokollnummer. Bei `'duplikat'` die der Originalsendung, falls ELDA sie im Feld mitliefert. */
  protokollnummer?: string;
  dateiId?: string;
  eldaZeitstempel?: string;
  /** Klartext-Meldung von ELDA; bei `'duplikat'` nennt sie die Protokollnummer des Originals. */
  meldung?: string;
  /** Der Status-Code, der zu diesem Ergebnis geführt hat. */
  statusCode: string;
}
```

Kein `ok`-Feld mehr: Die Methode kehrt nur zurück, wenn ELDA die Datei hat. Wer
den Normalfall will, prüft nichts; wer die drei Fälle unterscheiden muss, liest
`zustand`.

`protokollnummer` bleibt optional, weil nicht live verifiziert ist, dass ELDA
sie bei `000` immer mitschickt und ob sie bei `405` im Feld oder nur im
Meldungstext steht — siehe „Offene Punkte". Sobald das am Kundentest geklärt
ist, kann das Feld für den `000`-Fall verpflichtend werden.

### ruecksendungenAuflisten

```ts
ruecksendungenAuflisten(): Promise<Ruecksendung[]>
```

Wirft bei Ausnahme-Codes, liefert sonst direkt die Liste. Leeres Array heißt
„keine offen" — und das ist jetzt eindeutig, weil ein Zugangsfehler geworfen
hätte. `AuflistenErgebnis` verschwindet damit aus dem Rückgabewert der
komfortablen Methode; als Typ der rohen Variante bleibt es bestehen. Sein Zweck
— den Status nicht zu verlieren — ist hier durch das Werfen erfüllt.

### empfangen

```ts
empfangen(protokollnummer: string | number): Promise<Empfangen>

type Empfangen =
  | { zustand: 'datei'; datei: EldaDatei; statusCode: string; meldung?: string }
  | { zustand: 'nichtVorhanden'; statusCode: string; meldung?: string }
  | { zustand: 'bereitsEmpfangen'; statusCode: string; meldung?: string }
  | { zustand: 'nochInArbeit'; statusCode: string; meldung?: string };

interface EldaDatei {
  inhalt: Buffer;
  id?: string;
  name?: string;
  dateiTyp?: number;
  md5?: string;
}
```

Die häufige Prüfung ist eine einzige und wird von TypeScript verengt:

```ts
const erg = await elda.empfangen(nr);
if (erg.zustand === 'datei') speichere(erg.datei.inhalt);
```

Die Verzweigung läuft über `zustand`, nicht über `erg.datei`: In einer
diskriminierten Union trägt nur die `'datei'`-Variante das Feld, ein direkter
Zugriff wäre ein Compile-Fehler. `zustand` existiert, damit die drei
Nicht-Datei-Fälle unterscheidbar bleiben, statt in einem `undefined` zu
verschwinden.

### Rohe Variante

```ts
elda.roh.senden(args): Promise<SendenErgebnis>
elda.roh.ruecksendungenAuflisten(): Promise<AuflistenErgebnis>
elda.roh.empfangen(nr): Promise<EmpfangenErgebnis>
```

Verhalten und Typen exakt wie in v0.1: `{ ok, statusCode, meldung, … }`, wirft
bei keinem fachlichen Status-Code. Damit bleibt jede Information und jede
Entscheidungsfreiheit erhalten — nur eben für den, der sie ausdrücklich sucht.
Beide Wege teilen sich denselben Transport- und Parsing-Code; die
komfortable Variante ist eine dünne Schicht über `roh`.

### findeRuecksendung

```ts
findeRuecksendung(sendungsProtokollnummer: string, ruecksendungen: Ruecksendung[]): Ruecksendung | undefined
```

Umbenennung von `zuordnung` — Verb statt Substantiv. Verhalten unverändert
(Ziffern-Grenzen-Match, wirft `EldaError` bei leerer Protokollnummer).

Bewusst **keine** Methode, die Auflisten und Abholen zusammenfasst, und **kein**
Iterator, der lazy abholt: `empfangen` ist unwiderruflich. Bricht ein Aufrufer
die Schleife ab oder stirbt der Prozess zwischen Abholen und Persistieren, ist
das Protokoll bei ELDA für immer weg. Die unwiderrufliche Operation bleibt ein
sichtbarer Einzelaufruf.

## Fehlerbehandlung

Neu: `EldaStatusError extends EldaError`.

```ts
class EldaStatusError extends EldaError {
  readonly statusCode: string;   // z. B. '558'
  readonly meldung?: string;     // Klartext von ELDA
  readonly ergebnis: unknown;    // das vollständige rohe Ergebnisobjekt
}
```

`message` setzt sich aus Status-Code und der Klartextbeschreibung aus
`ELDA_STATUS` zusammen, ergänzt um die ELDA-Meldung, sofern vorhanden. Über
`ergebnis` bleibt alles erreichbar, was die rohe Variante geliefert hätte — das
ist die Zusicherung „kein Informationsverlust" in konkreter Form.

Unverändert: `EldaProtocolError` für technisch unbrauchbare Antworten,
`FonSoapFaultError`/`FonTransportError`/`FonProtocolError` aus dem Core für
Fault, Transport und Nicht-XML.

## Öffentliche Oberfläche

Exportiert bleibt, was man im Betrieb braucht:

`createEldaTransfer`, `EldaConfig`, `EldaTransfer`, `Gesendet`, `Empfangen`,
`EldaDatei`, `Ruecksendung`, `findeRuecksendung`, `EldaUmgebung`,
`ELDA_ENDPOINTS`, `ELDA_STATUS`, `EldaError`, `EldaStatusError`,
`EldaProtocolError` sowie die drei rohen Ergebnistypen `SendenErgebnis`,
`AuflistenErgebnis`, `EmpfangenErgebnis` (für Nutzer von `elda.roh`).

Intern werden: `baueSecurity`, `SecurityFelder`, `SecurityQuelle`,
`baueEldaEnvelope`, `EldaFeld`, `ELDA_NAMESPACE`, `istOk`. Sie bleiben als
Module bestehen und getestet, verlassen aber den Barrel — im Regelbetrieb
benutzt sie niemand, und in der Autovervollständigung verdecken sie den
Einstieg.

## Datei-/Modul-Struktur

Bestehend, plus:

- `src/errors.ts` — ergänzt um `EldaStatusError`
- `src/klassifikation.ts` — die Zuordnung Status-Code → Ausnahme/Zustand, als
  eigene Einheit, damit die Leitunterscheidung an genau einer Stelle steht und
  isoliert testbar ist
- `src/transfer.ts` — bekommt die komfortable Schicht über `roh`; falls die
  Datei dadurch unübersichtlich wird, wandert die rohe Schicht nach
  `src/transfer-roh.ts` und `transfer.ts` behält die Komfortschicht

## Testing

- Klassifikation: jeder der 18 Codes ist genau einer Klasse zugeordnet; ein
  unbekannter Code wird als Ausnahme behandelt.
- Für jede der drei Methoden: Erfolgsfall, ein werfender Code (Fehlertyp,
  `statusCode`, `meldung` und `ergebnis` geprüft), jeder erwartete Zustand.
- Die rohe Variante wirft bei keinem fachlichen Code — Gegenprobe zu jedem
  werfenden Test der Komfortschicht.
- Konfigurationsvalidierung: fehlende/ungültige `umgebung`, leere Zugangsdaten,
  `endpoint` ohne `umgebung`.
- Alle bestehenden Tests der Transport-Schicht bleiben gültig; sie werden auf
  `elda.roh` umgezogen, wo sie das heutige Verhalten prüfen, nicht ersetzt.
- README-Beispiele werden gegen die echten Exporte typgeprüft.

## Offene Punkte (Kundentest nötig, nicht raten)

- Liefert ELDA bei `000` immer eine `protokollnummer`? Falls ja, wird das Feld
  im Erfolgsfall verpflichtend.
- Steht die Protokollnummer des Originals bei `405` in einem Feld oder nur im
  Meldungstext? Aus Prosa wird nichts geparst, solange das nicht geklärt ist.
- Tritt `404` bei `empfangen` überhaupt auf, oder nur als Antwort auf `senden`?
  Die Klassifikation deckt beide Fälle ab; die Zuordnung wird nach dem
  Kundentest geschärft.
- Unverändert offen aus v0.1: MTOM vs. inline base64, Form der leeren
  Rücksendungsliste, `SOAPAction`-Header, `created`-Format.

## Nicht in dieser Stufe

Der fachliche Meldungs-Builder (`elda.anmeldung({…})`, Abmeldung, mBGM) und der
Protokoll-Parser für den Rückweg. Das ist die eigentliche Vereinfachung für den
Alltag, braucht aber die SV-Datensatzbeschreibung und bekommt eine eigene Spec.
