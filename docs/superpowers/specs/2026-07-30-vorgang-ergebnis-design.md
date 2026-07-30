# `vorgangErgebnis` — ein vorgangsbezogenes Urteil statt roher Returncodes — Design

Der rkdb-Client liefert heute `Ergebnis { ok, rc, msg }`. `ok` beantwortet **„hat der
Aufruf funktioniert"** — und das ist schlicht `rc === '0'`
(`packages/rksv/src/antwort.ts`). Die Frage, die jeder Aufrufer tatsächlich hat, lautet
aber: **„ist der Zustand, den ich wollte, jetzt hergestellt?"**

Diese beiden Fragen fallen bei FinanzOnline regelmäßig auseinander, und zwar
**vorgangsabhängig**. Genau deshalb hat bisher jeder Aufrufer sich seine eigene
Auslegung gebaut.

## Der Anlass

Im Konsumenten-Projekt (Registrierkassen-Plattform) sind binnen weniger Tage vier
voneinander unabhängige Notlösungen für dieselbe fehlende Abstraktion entstanden — und
jede einzelne war zuvor ein Fehler in Produktion:

| Notlösung | Was sie zu beantworten versuchte | Fehler davor |
|---|---|---|
| `fonMeldungErgebnis` | gilt eine Ausfall-/Wiederinbetriebnahme-Meldung als erfolgt? | jede Antwort galt als Erfolg, auch eine Ablehnung |
| `fonAusserbetriebErgebnis` | ist die Einheit jetzt außer Betrieb? | `B6` galt als Fehler, der Altfall blieb unheilbar |
| `darfAlreadyRegAlsErfolgGelten` | ist die Registrierung durchgegangen? | `B10` galt als Erfolg, eine Abmeldung wurde lokal gelöscht |
| `canTrustStatusShortcut` | darf ich aus `rc 0` auf „ist registriert" schließen? | `rc 0` quittiert nur die *Abfrage*, nicht den Zustand |

Alle vier stecken im Konsumenten, keine im Paket. Das ist die falsche Ebene: **nur das
Paket kennt beide Seiten** — den Vorgang und den Returncode-Katalog.

## Warum `ok` nicht genügt

Drei Returncodes zeigen das Problem in Reinform:

- **`B6`** — „Es erfolgte bereits eine Außerbetriebnahme. Eine Änderung ist nicht mehr
  möglich." → `ok: false`. Bei einer **Außerbetriebnahme** ist das Ziel aber **erreicht**.
- **`B13`** — „Der angegebene Status ist bereits gesetzt." → `ok: false`. Bei einer
  **Wiederinbetriebnahme** oder Ausfallmeldung ist das Ziel **erreicht**.
- **`B10`** — „Die angegebene Signaturerstellungseinheit ist … bereits in der Datenbank
  gespeichert." → `ok: false`. Bei einer **Registrierung** ist das Ziel **nicht**
  erreicht — die Meldung wurde abgelehnt, und die Einheit kann außer Betrieb sein.

Derselbe Code bedeutet je nach Vorgang etwas anderes. Ein einzelnes `ok` kann das nicht
tragen.

## Die dritte Antwortmöglichkeit

`B10` und `B1` („Die Registrierkasse … ist bereits registriert") sagen, dass die Einheit
dem Dienst **bekannt** ist — aber nicht, **in welchem Zustand**. Sie als Erfolg zu werten
war der teuerste Fehler der Reihe: eine abgemeldete Karte galt danach lokal als
registriert, während das Finanzamt sie außer Betrieb führte.

Sie als schlichte Ablehnung zu werten wäre ebenfalls falsch — die Einheit *existiert* ja.

Deshalb gibt es drei Ausgänge, nicht zwei:

1. **Ziel erreicht** — der gewünschte Zustand liegt vor.
2. **Zustand unklar** — die Einheit ist bekannt, ihr Zustand aus dieser Antwort aber nicht
   ableitbar. Der Aufrufer **muss** ihn separat abfragen.
3. **Abgelehnt** — das Ziel liegt nicht vor.

Ausgang 2 zwingt zur Statusabfrage, statt eine Vermutung zuzulassen. Das ist der Kern:
**man soll nichts falsch machen können.**

## Die Schnittstelle

```ts
export type VorgangArt =
  | 'registrierung_see' | 'registrierung_kasse'
  | 'ausfall_see' | 'ausfall_kasse'
  | 'ausserbetriebnahme_see' | 'ausserbetriebnahme_kasse'
  | 'wiederinbetriebnahme_see' | 'wiederinbetriebnahme_kasse';

export interface VorgangUrteil {
  /** Liegt der gewünschte Zustand jetzt vor? */
  zielerreicht: boolean;
  /** Er lag schon vorher vor — dieser Aufruf hat nichts bewirkt. */
  bereitsSo: boolean;
  /** Die Einheit ist bekannt, ihr Zustand aus dieser Antwort nicht ableitbar.
   *  Vor jeder weiteren Entscheidung ist eine Statusabfrage nötig. */
  statusUnklar: boolean;
  /** Derselbe Aufruf kann unverändert später gelingen (siehe istWiederholbar). */
  wiederholbar: boolean;
  rc: string | null;
  msg: string;
}

export function vorgangErgebnis(art: VorgangArt, erg: Ergebnis): VorgangUrteil;
```

`zielerreicht` und `statusUnklar` schließen einander aus. `bereitsSo` setzt
`zielerreicht` voraus.

## Die Zuordnung

| Returncode | Registrierung | Ausfall | Außerbetriebnahme | Wiederinbetriebnahme |
|---|---|---|---|---|
| `0` | Ziel erreicht | Ziel erreicht | Ziel erreicht | Ziel erreicht |
| `B13` Status bereits gesetzt | — | Ziel erreicht, `bereitsSo` | — | Ziel erreicht, `bereitsSo` |
| `B6` Außerbetriebnahme bereits erfolgt | — | abgelehnt | Ziel erreicht, `bereitsSo` | abgelehnt |
| `B10` SEE bereits gespeichert | **Zustand unklar** | — | — | — |
| `B1` Kasse bereits registriert | **Zustand unklar** | — | — | — |
| alles andere | abgelehnt | abgelehnt | abgelehnt | abgelehnt |

Die Striche bedeuten: dieser Code tritt bei diesem Vorgang nicht sinnvoll auf und fällt
unter „abgelehnt" — bewusst konservativ. Lieber eine Ablehnung zu viel als ein
erfundener Erfolg.

`wiederholbar` kommt unverändert aus `istWiederholbar(rc)` (seit 0.8.0).

**Bewusst nicht enthalten:** `B32`/`B33` („nicht registriert **oder** bereits außer
Betrieb"). Sie sind mehrdeutig formuliert und bleiben Ablehnung — dieselbe konservative
Linie, die schon in 0.8.0 gewählt wurde.

## Was das Paket zusätzlich klarstellen muss

`mapStatus` reicht `status` bereits durch, aber die möglichen Werte sind nirgends
dokumentiert — `StatusErgebnis.status` ist schlicht `string`. Damit kann ein Aufrufer,
den `statusUnklar` zur Statusabfrage zwingt, das Ergebnis nicht auswerten, ohne zu raten.

Der Werteraum ist **an einer echten FinanzOnline-Antwort zu erheben** und dann als
Union-Typ samt Konstanten zu hinterlegen. Ohne diesen Schritt ist Ausgang 2 eine
Sackgasse, und das Design verfehlt seinen Zweck.

## Auf der Konsumentenseite

Zwei Schritte, beide klein:

1. **`mapFailureRecovery` reicht `ok` durch.** Die vier Vorgänge Ausfall,
   Wiederinbetriebnahme und Außerbetriebnahme (SEE und Kasse) sind die einzigen, bei
   denen die Übersetzungsschicht `ok` heute wegwirft — `mapRegistration`,
   `mapRegistrationCashbox` und `mapStatus` reichen es bzw. `status` bereits durch. Rein
   additiv: Kassengeräte lesen weiterhin `result.rkdbMessage.rc`.
2. **Die vier Notlösungen weichen dem einen Aufruf.** Danach gibt es genau eine Stelle im
   System, die entscheidet, was eine FinanzOnline-Antwort bedeutet.

## Tests

Reine Funktion, also vollständig unit-testbar. Die Tabelle oben wird Zeile für Zeile
festgenagelt, insbesondere:

- `B6` bei Außerbetriebnahme → Ziel erreicht; `B6` bei Wiederinbetriebnahme → abgelehnt
- `B13` bei Wiederinbetriebnahme → Ziel erreicht; `B13` bei Außerbetriebnahme → abgelehnt
- `B10` bei Registrierung → **weder** Ziel erreicht **noch** schlicht abgelehnt, sondern
  `statusUnklar`
- unbekannter Returncode → abgelehnt, nie Ziel erreicht
- `zielerreicht` und `statusUnklar` nie gleichzeitig gesetzt

Jeder dieser Fälle war einmal ein echter Fehler in Produktion; die Testnamen sollen das
benennen, damit später niemand die Zuordnung „aufräumt".

## Versionierung

Additiv, keine bestehende Signatur ändert sich → **0.9.0**. Danach der Bump im
Konsumenten samt Ablösung der vier Notlösungen.

## Nicht im Scope

- Änderungen an `Ergebnis.ok` — das bleibt „Aufruf funktioniert" und wird nicht
  umdefiniert; sonst bräche jeder Bestandsaufrufer.
- Belegprüfung und Statusabfrage als eigene Vorgangsarten. Sie liefern kein
  Ziel/Nicht-Ziel, sondern Daten; `belegpruefung` und `status` tragen das bereits.
- Die geschlossenen Gesamtsysteme (GGS) — im Paket ohnehin nicht umgesetzt.
