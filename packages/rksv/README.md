# @kreiseck/rksv

Anbindung an den österreichischen Registrierkassen-Webservice (RKSV / `rkdb`) des
BMF und ein netzfreier Prüfer für den maschinenlesbaren Belegcode.

Dieses Paket kapselt die **Übermittlung** an die Behörde — es ist **keine**
Registrierkasse. Es erzeugt keine Belegketten, verwaltet keinen Umsatzzähler und
signiert nichts.

## Installation

```bash
npm install @kreiseck/rksv
```

Node ≥ 18.18. Baut auf [`@kreiseck/finanzonline-core`](https://www.npmjs.com/package/@kreiseck/finanzonline-core)
(Session/Transport).

## Übermittlung (online)

```ts
import { createSession } from '@kreiseck/finanzonline-core';
import { createRksv } from '@kreiseck/rksv';

const session = await createSession({ /* … */ });
const rksv = createRksv({ session, uebermittlung: 'test' }); // 'test' | 'echt'

// paketNr besitzt der Aufrufer (Idempotenz); satznr vergibt die Bibliothek.
const erg = await rksv.kasse.registriere({
  paketNr: 42,
  kassenidentifikationsnummer: 'KASSE-001',
  benutzerschluessel: '<44 Zeichen Base64>',
});
erg.ok; // false bei fachlichem rc — erg.rc / erg.msg tragen den BMF-Code

const st = await rksv.status.kasse({ paketNr: 43, kassenidentifikationsnummer: 'KASSE-001' });
st.status?.status; // 'REGISTRIERT' | 'IN_BETRIEB' | 'AUSFALL' | 'AKTIVIERT'
```

Fachliche Returncodes werfen nicht — sie kommen als `Ergebnis` (`ok`/`rc`/`msg`).
Technische Fehler werfen. Genau **eine** Vorgangsart pro Paket; mehr als ein
Vorgang wird asynchron verarbeitet (Ergebnis in der DataBox).

## Returncodes und Begründungen

`rcInfo(rc)` liefert Art und Klartext zu jedem BMF-Returncode. Ob sich ein
erneuter Versuch lohnt, beantwortet `istWiederholbar(rc)` — das ist bewusst
etwas anderes als `rcInfo(rc).kind`: `kind` entscheidet, ob der Client wirft
oder ein Ergebnis liefert, `istWiederholbar` dagegen, ob derselbe Aufruf später
gelingen kann. Ein interner FON-Fehler (`V1`, `C1`, `1336`, …) kommt als
fachliches Ergebnis zurück, ist aber wiederholbar; eine Ablehnung wie `B5` oder
`B18` ändert sich durch Wiederholen nie.

```ts
import { rcInfo, istWiederholbar, begruendungText, begruendungCodes } from '@kreiseck/rksv';

rcInfo('B6').text; // 'Außerbetriebnahme bereits erfolgt — keine Änderung mehr möglich'
istWiederholbar('V1'); // true — interner FON-Fehler
istWiederholbar('B5'); // false — fachliche Ablehnung

begruendungCodes('ausserbetriebnahme'); // [6, 7]
begruendungText('ausserbetriebnahme', 7); // 'Außerbetriebnahme aufgrund eines irreparablen Ausfalls'
begruendungText('ausfall_kasse', 2); // null — Code 2 gibt es nur beim SEE-Ausfall
```

Die Begründungscodes stammen wörtlich aus Abschnitt 4 der BMF-Beschreibung und
sind nach Vorgang getrennt (`ausfall_see`, `ausfall_kasse`,
`ausserbetriebnahme`) — dieselben Zahlen bedeuten je nach Vorgang etwas
anderes. Die Vorgangsvalidierung prüft gegen genau diesen Katalog.

## „Ist der Zustand jetzt hergestellt?"

`erg.ok` beantwortet, ob der **Aufruf** funktioniert hat (`rc === '0'`). Die
Frage, die der Aufrufer wirklich hat, ist eine andere — und sie fällt
**vorgangsabhängig** auseinander: `B6` heißt bei einer Außerbetriebnahme *Ziel
erreicht*, bei einer Wiederinbetriebnahme *Ablehnung*; `B13` umgekehrt.
`vorgangErgebnis` beantwortet sie an einer Stelle, statt sie jedem Aufrufer zu
überlassen.

```ts
import { vorgangErgebnis, vorgangKlasse } from '@kreiseck/rksv';

const u = vorgangErgebnis('ausserbetriebnahme', erg);
u.zielerreicht; // true auch bei B6 — die Einheit ist außer Betrieb
u.bereitsSo;    // true: sie war es schon, dieser Aufruf hat nichts bewirkt

// Aus einem gesendeten Vorgang ableiten, statt die Klasse zu tippen:
vorgangKlasse({ art: 'ausfall_se', zertifikatsseriennummer: 'AB', ausserbetriebnahme: { begruendung: 7 } });
// 'ausserbetriebnahme' — derselbe Vorgang mit `ausfall` ergäbe 'ausfall'
```

Es gibt drei Ausgänge, nicht zwei. `B1`/`B10` („bereits registriert" / „bereits
gespeichert") sagen bei einer Registrierung, dass die Einheit dem Dienst
**bekannt** ist — aber nicht, in welchem Zustand. Sie liefern deshalb
`statusUnklar: true`, weder Erfolg noch Ablehnung.

`statusUnklar` verspricht **nicht**, dass eine Statusabfrage die Sache löst: der
Dienst beantwortet sie nur für Einheiten in Betrieb, für abgemeldete kommt
`B32`/`B33` ohne Status und ohne Datum. Der Fall gehört an einen Menschen, nicht
in eine Heuristik.

## Belegcode offline prüfen

Netzfrei über den Subpath-Export. `@kreiseck/rksv/code` kommt seit 0.10.0 ohne
`node:crypto` und ohne `Buffer` aus und läuft damit auch im Browser:

```ts
import { decodeBelegCode, pruefeVerkettung } from '@kreiseck/rksv/code';

const beleg = decodeBelegCode('_R1-AT1_KASSE-001_1_2026-07-20T14:23:34_10,00_…');
pruefeVerkettung(beleg, vorherigerBeleg); // Startbeleg: pruefeVerkettung(beleg)
```

Die ES256-Signaturprüfung braucht X.509 und liegt deshalb in einem eigenen,
Node-gebundenen Einstiegspunkt:

```ts
import { pruefeBelegCode } from '@kreiseck/rksv/code/signatur';

const ergebnis = pruefeBelegCode(beleg, { zertifikat }); // Zertifikat optional
// ergebnis.pruefungen[]: { name, status: 'PASS'|'FAIL'|'NOT_EXECUTED', detail? }
```

Ohne Zertifikat wird die ES256-Signaturprüfung als `NOT_EXECUTED` gemeldet, nicht
als Fehler.

`beleg.besonderheit` sagt, ob der Beleg eine Trainings- oder Stornobuchung ist
(Marker im Umsatzzähler-Feld, § 10 Abs. 3 RKSV — in der Praxis base64-kodiert als
`VFJB`/`U1RP`, in der OCR-Variante base32). Ob die Signatureinheit ausgefallen
war, steht unabhängig davon in `beleg.seeAusfall`: beides zugleich kommt vor, und
dann führt `besonderheit` die Belegart.

Die paketinterne, synchrone SHA-256 (ohne `node:crypto`, ohne Web Crypto) liegt
seit 0.10.1 unter einem eigenen Einstiegspunkt — gedacht für Nutzer, die ihre
eigene Implementierung dagegen halten wollen:

```ts
import { sha256 } from '@kreiseck/rksv/code/sha256';
```

**Breaking in 0.10.0:** `pruefeBelegCode` und die Typen `Pruefergebnis`/
`PruefOptionen` sind von `@kreiseck/rksv/code` nach `@kreiseck/rksv/code/signatur`
gewandert. `base32Decode`/`base32Encode` arbeiten mit `Uint8Array` statt `Buffer`
— in Node ist `Buffer` ein `Uint8Array`, betroffen ist nur, wer `.toString(…)`
auf dem Ergebnis aufruft.

## Lizenz

Apache-2.0 © Kreiseck. Teil von
[austria-gov-connect](https://github.com/kreiseck-at/austria-gov-connect).
