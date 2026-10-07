# SIT-Werkzeug

Testläufe gegen die **Systemintegrationstest-Plattform (SIT) der Sozialversicherung** – reproduzierbar, gezielt
auch mit falschen Anfragen, und lückenlos protokolliert. Nicht Teil von `npm test`; die Logik ohne Netz prüft
`npm run test:sit`.

## Sicherheitsregeln

- **Nur die SIT-Plattform.** Das Werkzeug kennt genau eine Adresse und prüft sie im `fetch` selbst; Weiterleitungen
  sind verboten. Produktion und Kundentest sind nicht erreichbar.
- **Nur in einem Testfenster** (Mo–Mi 07–09 und 12–14 Uhr, nicht an testfreien Tagen) und nur, solange die
  Zeitreise-Tabelle in `lib/fenster.js` gilt. Das Fenster wird vor **jedem** Aufruf geprüft – ein langer Lauf, der in
  das Fensterende läuft, bricht ab.
- **Quell-IP** muss der freigeschalteten Adresse entsprechen (`ELDA_SIT_QUELL_IP`).
- **Senden und Abholen nur mit `--ja`.** Ohne `--ja` ein Trockenlauf ganz ohne Netz. Dieselbe Meldung ein zweites Mal
  in derselben Woche nur mit `--nochmal`.
- **Zugangsdaten** (Kundenpasswort, Hash, API-Key) kommen aus dem Schlüsselbund in die Umgebung und erscheinen nie in
  Ausgabe oder Dateien; Mitschnitte werden geschwärzt, sonst nicht geschrieben. Fehler werden nur mit Name und
  geschwärzter Meldung ausgegeben.
- **Die Seriennummer** kommt ebenfalls aus dem Schlüsselbund (`ELDA_SIT_SERIENNUMMER`), nicht aus den Testdaten, und
  steht in keiner Datei und keiner Ausgabe im Klartext (siehe Ablage). Gesendet wird sie vollständig.
- **Keine Kennungen im Repo.** Testdaten und Läufe liegen außerhalb des Repos (siehe Einrichten).

Eine bewusste Ausnahme: Die Quell-IP fragt das Werkzeug bei `api.ipify.org` ab – die einzige Anfrage außerhalb des SIT,
nicht im Trockenlauf.

## Einrichten

1. Testdaten und Ablage **außerhalb jedes Checkouts** anlegen – ein entfernter Worktree nimmt gitignorierte Dateien
   kommentarlos mit, und das Laufprotokoll muss die ganze Kampagne überleben. Die Testdaten nach dem Muster von
   `testdaten.beispiel.json` aus dem Stammdaten-Basispaket (Rollen → Testpersonen, Dienstgeber mit Konten je Träger).
2. Kundenpasswort, API-Key und Seriennummer im Schlüsselbund ablegen (`elda-sit-kundenpasswort`, `elda-sit-api-key`,
   `elda-sit-seriennummer`).
3. Paket bauen: `npm run build -w @kreiseck/finanzonline-core && npm run build -w @kreiseck/elda`.

Aufruf (aus `packages/elda`); `SIT_ABLAGE` und `SIT_TESTDATEN` sind für Netzbefehle Pflicht:

```bash
export ELDA_SIT_QUELL_IP=<freigeschaltete Adresse>
export SIT_TESTDATEN=<Ordner außerhalb des Repos>/testdaten.local.json
export SIT_ABLAGE=<Ordner außerhalb des Repos>/ablage
ELDA_SIT_KUNDENPASSWORT="$(security find-generic-password -a "$USER" -s elda-sit-kundenpasswort -w)" \
ELDA_API_KEY="$(security find-generic-password -a "$USER" -s elda-sit-api-key -w)" \
ELDA_SIT_SERIENNUMMER="$(security find-generic-password -a "$USER" -s elda-sit-seriennummer -w)" \
node test/sit/sit.js pruefen
```

## Ablauf je Fenster

| Wann | Was |
|---|---|
| vorher | `generalprobe` – baut die ganze Woche ohne Netz mit den echten Testdaten |
| 06:45 | am Büronetz? (kein VPN, kein Hotspot) |
| 07:00 / 12:00 | `pruefen` – Testdaten, Fenster, Quell-IP, dann Z01 (Zugang) |
| danach | `plan` – offene Fälle dieses Fensters in sinnvoller Reihenfolge |
| | `lauf <ID> … --ja` – Fälle laufen lassen, je Aufruf eine Zeile Ergebnis |
| nach der Sammelverarbeitung | `abholen` (nur ansehen), `abholen --ja` (alles sichern – auf der SIT gehört die Outbox nur uns) |
| | Rücksendungen lesen, dann `urteil <ID> <Urteil> --notiz … --befund B…` (Urteil: bestanden, abweichung, blockiert oder entfaellt) |
| zum Schluss | `protokoll` – Stand aller Fälle |

Die Anlage wird nach jedem Wochenzyklus zurückgesetzt. Ein Fall mit Vorlauf (z. B. V07 nach V01) läuft nur, wenn der
Vorlauf **in derselben Woche** mit `000` gelaufen ist; fehlt er, wird der Fall übersprungen, die übrigen laufen weiter.
`plan` nimmt fehlende Vorläufe als „Vorlauf" mit auf. `000` heißt nur „empfangen" – solange ein Vorlauf noch nicht als
bestanden bewertet ist, weist `lauf` auf mögliche Folgefehler hin.

## Befehle

| Befehl | Netz | Wirkung |
|---|---|---|
| `pruefen` | ja | Katalog, Testdaten, Fenster, dann Z01 |
| `plan [--fenster f]` | nein | offene Fälle für das Fenster |
| `zeigen <ID> [--fenster f]` | nein | Fall bauen und Feld für Feld zeigen |
| `generalprobe` | nein | alle Fälle der Woche in einer Wegwerf-Ablage bauen (wird danach gelöscht) |
| `lauf <ID> … [--ja] [--nochmal]` | ja | Fälle ausführen (`senden` ist ein Alias) |
| `abholen [--ja]` | ja | Rücksendungen auflisten bzw. abholen und sichern |
| `urteil <ID> <Urteil>` | nein | Bewertung ins Laufprotokoll |
| `protokoll` | nein | Status je Fall (Wiener Zeit), Läufe mit Antwort / Versuche |
| `auswerten` | nein | gesicherte Mitteilungen und Clearingfälle lesen, Clearing per Referenzwert dem Fall zugeordnet |
| `katalog` | nein | Katalog als Markdown |

`SIT_JETZT` (ISO-Zeitpunkt) verschiebt für die Befehle **ohne Netz** die aktuelle Zeit; Netzbefehle nehmen immer die
echte Zeit.

## Ablage

- `laufprotokoll.jsonl` – je Ereignis eine Zeile (`lauf`, `ruecksendung`, `urteil`, `uebersprungen`, …). Einzige
  Quelle für Status, Vorläufe und Referenzwerte; es wird nur angehängt. Ein Lauf ohne Antwort des Servers (Netzfehler)
  zählt nicht – der Fall bleibt offen.
- `laeufe/<Zeit>_<Fall>/` – Bestand, geschwärzte Anfrage und Antwort.
- `ruecksendungen/` – abgeholte Rücksendungen, sobald die Antwort ausgepackt ist. Scheitert das Auspacken, liegen der
  geschwärzte Mitschnitt und – soweit am Fehler vorhanden – Datei, roher Payload und rohe Antwort in der Ablage.

Wo die Seriennummer stünde und was dort steht:

| Wo | Was |
|---|---|
| `bestand.dat` | OBUS jedes Satzes als `*******`. Für das Duplikat T02 setzt `ctx.bestandVon` die Nummer beim Lesen wieder ein – gesendet wird byte-gleich. |
| Mitschnitte | Seriennummer, Zugangsdaten und Hash geschwärzt (`***seriennummer***`); der Payload der Anfrage fehlt (er liegt als `bestand.dat` daneben), eine inline (Base64) gelieferte Rücksendung ist maskiert. |
| Rücksendungen | Inhalt und Dateiname mit Sternen gleicher Länge, auch im Base64-Payload einer rohen Antwort; `seriennummerMaskiert` im Laufprotokoll zählt die Treffer. |
| Laufprotokoll, Ausgabe | Meldungen geschwärzt, Dateinamen von ELDA maskiert. |

Grenzen: Gesucht wird nach der Ziffernfolge – als OBUS (sieben Stellen) und wie vergeben. Eine andere Nummer, die sie
zufällig enthält, wird mitmaskiert; die Anzahl zeigt es. Was eine Rücksendung gepackt oder anders kodiert trägt (etwa
Base64 im Clearing-Datensatz), erreicht die Maskierung nicht.

## Fälle ergänzen

Jede Datei in `faelle/` exportiert eine Liste. Pflicht: `id`, `titel`, `zweck`, `quelle`, `erwartung`, `aktion`
(`auflisten`, `senden`, `empfangen`, `beobachten`), `gefahr` (`null`, `sperre`, `verbraucht`), `abhaengig`, dazu
`fenster` und `baue(ctx)` – außer bei `beobachten` (dann `aus`). Optional `aufrufe` und `rang`. Daten nie fest
eintragen: das eigene Datum aus `ctx.zr`, das einer Ursprungsmeldung aus `ctx.zrVon(<ID>)`, Abstände mit `plusTage`.
`npm run test:sit` baut jeden Fall.

## Entscheidungsregel: VR-Version im simulierten Jahr 2025

Die Versichertenmeldung in Version 03 gilt laut E.29 ab 01.12.2025. Ob der SIT sie an Tagen annimmt, die 2025
simulieren, klärt V01 am Montag um 07:00. Weist ELDA wegen der Version ab, laufen die V-Fälle in ihren
Ausweichfenstern am Mittwoch (Anmeldungen vormittags, Folgemeldungen nachmittags) – die Daten rechnen sie aus dem
eigenen Fenster und aus dem tatsächlichen Lauf der Ursprungsmeldung. Die Formproben B03, B11 und B12 hängen an V01 und
laufen deshalb erst, wenn eine gewöhnliche Anmeldung in der Woche angenommen wurde.
