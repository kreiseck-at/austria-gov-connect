<img src="https://raw.githubusercontent.com/kreiseck-at/austria-gov-connect/main/assets/kreiseck_logo.png" alt="Kreiseck" width="280">

# austria-gov-connect

Anbindung an österreichische Behörden-Webservices für Node — FinanzOnline,
Registrierkassen (RKSV) und später ELDA. Ein Paket pro Behördenkanal,
framework-agnostisch und zustandslos.

Von **[Kreiseck](https://github.com/kreiseck-at)** · Lizenz: Apache-2.0.

## Abgrenzung

Diese Pakete kapseln die **Übermittlung** an die Behörde, nicht deren
Fachlogik. `@kreiseck/rksv` meldet Registrierkassen und Signatureinheiten beim
Finanzamt an und prüft Belege — es ist **keine** Registrierkasse und erzeugt
weder Belegketten noch Signaturen.

## Pakete

| Paket | Kanal | Status |
|---|---|---|
| `@kreiseck/finanzonline-core` | FinanzOnline Session + SOAP-Transport | in Arbeit |
| `@kreiseck/rksv` | Registrierkassen-Webservice, Belegprüfung, Belegcode offline | in Arbeit |
| `@kreiseck/finanzonline` | Übrige FinanzOnline-Verfahren | geplant |
| `@kreiseck/elda` | Sozialversicherung (ELDA) | geplant |

## Doku

- [`docs/design.md`](docs/design.md) — Design, Architektur, verifizierte
  Endpoints und Feldstrukturen, Returncodes, offene Punkte.

## Voraussetzungen

Der Einsatz setzt einen FinanzOnline-Zugang mit eingerichtetem
**Webservice-Benutzer** sowie eine **UID des Softwareherstellers** voraus.
Testbetrieb läuft über dieselben Endpoints, gekennzeichnet durch das Feld
`art_uebermittlung`.

## Lizenz

Apache-2.0 © Kreiseck — siehe [`LICENSE`](LICENSE) und [`NOTICE`](NOTICE).
