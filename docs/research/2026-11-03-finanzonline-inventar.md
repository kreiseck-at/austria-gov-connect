# FinanzOnline-Inventar und U30-Analyse

Stand: 03.11.2026. Grundlage für die Entscheidung, welche FinanzOnline-Verfahren
`@kreiseck/finanzonline` als Nächstes bekommt, und für den Bau der
Umsatzsteuervoranmeldung (U30). Nur Primärquellen; jede Aussage trägt eine
Quellenmarke `[Qn]`. Was nicht belegbar ist, steht als **[offen]** da.

Vorgänger: `docs/research/2026-07-22-finanzonline-webservices.md`. Abschnitt 6
listet, wo dieses Dokument ihn korrigiert.

## 0. Quellen

Alle Dateien am 03.11.2026 von bmf.gv.at bzw. finanzonline.bmf.gv.at geladen.
„Stand" ist das Datum im Dokument selbst.

| Marke | Dokument | Stand |
|---|---|---|
| Q1 | BMF, Softwarehersteller, „Sonstige Funktionen" (Liste aller Webservices), `bmf.gv.at/services/finanzonline/informationen-fuer-softwarehersteller/softwarehersteller-sonstige-funktionen.html` | Seite, abgerufen 03.11.2026 |
| Q2 | BMF, Softwarehersteller, „Sonstige Erklärungen und Anträge" (Datenstrom-Strukturen je Anbringen), `…/softwarehersteller-erklarungen-und-antraege.html` | Seite, abgerufen 03.11.2026 |
| Q3 | BMF, „Informationen für die Datenstromübermittlung", `…/datenstromuebermittlung.html` | Seite, abgerufen 03.11.2026 |
| Q4 | `BMF_File_Upload_Webservice_2.pdf` | 04.03.2026 |
| Q5 | `BMF_File_Upload_Webservice_Dokumentenversion.pdf` | 04.03.2026 |
| Q6 | `https://finanzonline.bmf.gv.at/fon/ws/fileupload.xsd` (live) | abgerufen 03.11.2026 |
| Q7 | `BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_07_2026.xsd` | Kommentar im XSD: 24.04.2026 |
| Q8 | `BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_07_2026.xml` (Muster) | 24.04.2026 |
| Q9 | `BMF_Allgemeines_UVA_07_2026.pdf` | 24.04.2026 |
| Q10 | `BMF_Pruefungen_UVA_ab_07_2026.pdf` | 24.04.2026 |
| Q11 | `BMF_Dokumentenversion_UVA ab_07_2026.pdf` | 08.07.2026 |
| Q12 | `BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_01_2022.xsd` + Allgemeines/Prüfungen 01/2022 | 28.09.2021 |
| Q13 | Formular U 30-PDF-2026 (`formulare.bmf.gv.at/…/pdfs/2026/U30.pdf`) | Version vom 13.03.2026 |
| Q14 | Ausfüllhilfe U 30a-2026 (`formulare.bmf.gv.at/…/pdfd/2026/U30a.pdf`) | Version vom 20.08.2025 |
| Q15 | `BMF_Allgemeines_Protokolle.pdf` (Struktur der Übermittlungsprotokolle) | 20.02.2020 |
| Q16 | `BMF_DataBox_Download_Webservice_2.pdf` | **29.10.2026** |
| Q17 | `BMF_Abfrage_Datenuebermittlungen_Webservice.pdf` | 04.02.2026 |
| Q18 | `BMF_Allgemeines_Kontoinformationen.pdf` + `BMF_XSD_Schema_Kontoinformation.xsd` + Muster-XML | 30.12.2020 |
| Q19 | `BMF_Allgemeines_Meldung_SB.pdf`, `BMF_XSD_Schema_Meldung_SB.xsd` (Kommentar 19.06.2023), `BMF_Pruefungen_Meldung_SB.pdf` | 18.02.2020 / 07.07.2008 |
| Q20 | `BMF_Allgemeines_Buchung_SB.pdf` | 13.02.2020 |
| Q21 | BMF-Handbuch „Meldung zur Zahlung von Selbstbemessungsabgaben und Elektronische Zahlung in FinanzOnline" (`BMF_Handbuch_eZahlung_Meldung_Zahlg_SB.pdf`) | 07.05.2024 |
| Q22 | `BMF_Bankendatenuebermittlung_Webservice.pdf` | 01.07.2023 |
| Q23 | `BMF_USt-Webservice.pdf` | 06.05.2020 |
| Q24 | `BMF_QuotenAbfrage_Webservice.pdf` | 11.09.2024 |
| Q25 | Parlament, Gegenstand XXVIII/I/474 „Umsatzsteuergesetz, Änderung" (`parlament.gv.at/gegenstand/XXVIII/I/474`): beschlossen, **BGBl. I Nr. 37/2026** | abgerufen 03.11.2026 |
| Q26 | USP, „Neuer Umsatzsteuersatz von 4,9 Prozent" (`usp.gv.at/aktuelles/newsliste/neuer_ustsatz.html`) | abgerufen 03.11.2026 |
| Q27 | `BMF_Session_Webservice_2.pdf`, `BMF_UID_Abfrage_Webservice_2.pdf`, `BMF_Registrierkassen_Webservice.pdf` | 06.11.2019 / 20.09.2024 / 20.12.2016 (bereits im Repo auditiert, siehe `docs/design.md`) |
| Q28 | `BMF_Allgemeines_Paketsteuer.pdf` | 02.09.2026 |
| Q29 | BMF, „Prüfungen UVA ab 1/2008" mit Spalte Langtext (Wayback: `web.archive.org/web/20071108201142/http://www.bmf.gv.at/EGovernment/FINANZOnline/InformationenfrSoft_3165/Umsatzsteuervoranme_7122/Pruefungen__UVA_ab_01_08(1).pdf`) | 22.10.2007 |
| Q30 | § 204 BAO (RIS, Fassung BGBl. I Nr. 108/2022) | ab 20.07.2022 |
| Q31 | Formular U 30-PDF-2026 [Q13], eingebettetes JavaScript: `std_calcPercentDig` und je Satz-Zeile `std_calcPercentDig("Zahl…", 0.2 / 0.049 / 0.1 / 0.13 / 0.19 / 0.07, 100)` (PDF-Objekte 165–213) | 13.03.2026 |
| Q32 | BMF, „Fehlercodeverzeichnis Sonstige Erklärungen" | 26.03.2020 |
| Q33 | BMF, „Prüfungen Fristverlängerung" | 26.03.2024 |
| Q34 | BMF, „Beispiel Globe Information Return – OK-/NOK-Protokoll" (`…/Beispiel_GIR_Protokoll_OK.xml`, `…_NOK.xml`) | Beispieldatum 20.02.2026 |
| Q35 | FinanzOnline-Hilfe „Nachrichten" (`finanzonline.bmf.gv.at/fon/a/hilfe.do?pageId=e82eb4ed20057c44857edc791e9d743d`) | abgerufen 03.11.2026 |
| Q36 | FinanzOnline-Hilfe „Elektronische Zustellung" (`…hilfe.do?pageId=6f3cb4491e5734a3010f5c1a86182862`) | abgerufen 03.11.2026 |
| Q37 | BFG 11.03.2015, RV/5100641/2011 (findok `…/105434.pdf`) | 11.03.2015 |
| Q38 | UFS 07.11.2012, RV/0698-L/11 (findok `…/62346.1.1.0.pdf`) | 07.11.2012 |
| Q39 | § 21 UStG 1994 (RIS) | Fassung BGBl. I Nr. 144/2024 |
| Q40 | FinanzOnline-Verordnung 2027, BGBl. II Nr. 274/2026 (ersetzt ab 01.01.2027 FOnV 2006 und FOnErklV) | in Kraft 01.01.2027 |
| Q41 | FinanzOnline-Hilfe „Erklärungswechsel zur E1 bzw. Änderung der Tätigkeit" (`…hilfe.do?pageId=4c8cc20b8ec2c239866f496cdc59b4e2`) | abgerufen 03.11.2026 |
| H1 | ProSaldo, Support „Report – Umsatzsteuervoranmeldung / UVA" (`support.prosaldo.net/support/solutions/articles/101000492920`) — **nicht amtlich** | abgerufen 03.11.2026 |
| H2 | FreeFinance, FAQ (`freefinance.at/faq`) und „Differenzen in der UVA" — **nicht amtlich** | abgerufen 03.11.2026 |
| H3 | WKO FV UBIT, „Fragen und Antworten zu den FinanzOnline-Funktionen" — **nicht amtlich** | 21.02.2024 |
| H4 | WKO, „Elektronische Bilanz" (E-Bilanz-Übermittlung mit 02.06.2026 eingestellt) — **nicht amtlich** | 01.07.2026 |
| H5 | Wayback-Stände von `finanzonline.bmf.gv.at/fon/ws/fileupload.xsd` (24.10.2017, 08.12.2021, 14.07.2025, 12.04.2026) | – |
| H6 | XeisWorks/XW-Office, Testlauf U30 per Webservice mit `T`, rc 0 (`markdowns/finanzonline_uva_fileupload_umbau_2026-06-17.md`, Commit 8274ec7) — **nicht amtlich** | 17.06.2026 |
| K | Kasseneck-Code (Anwendung, die die Pakete nutzt), nur gelesen | 03.11.2026 |

## 1. Alle FinanzOnline-Webservices

Die BMF-Liste [Q1] nennt **neun** Webservices (Session + acht Fachdienste). Es
gibt keinen weiteren, insbesondere keinen für Abgabenkonto oder Zahlung
(Abschnitt 4).

Nutzen-Spalte: **E/A** = Kund\*innen mit Einnahmen-Ausgaben-Rechnung, **Kasse**
= Registrierkasse, **Lohn** = Dienstgeber. Aufwand: S (< 1 Tag), M (1–3 Tage),
L (> 3 Tage), jeweils inklusive Tests. Risiko = Folge eines Fehlers für
Kund\*innen.

| # | Webservice | Was es kann | Stand Repo | Kasseneck heute (K) | Nutzen | Aufwand | Risiko |
|---|---|---|---|---|---|---|---|
| 1 | Session `/fonws/ws/session` [Q27] | login/logout, Session-ID für alle anderen | **fertig** `packages/finanzonline-core/src/session.ts` | genutzt: `gemeinsam/fon-zugang.js` (Sperrschutz, Rückfall auf zweiten Zugang) | Voraussetzung | – | – |
| 2 | Registrierkassen `rkdb` [Q27] | Kasse/SEE registrieren, Ausfall, Status, Belegprüfung | **fertig** `packages/rksv/src/` | in Produktion: `finanzonline-endpoints.js`, `ausfall-fon.js`, Jahresbeleg | Kasse: Pflicht | – | hoch (RKSV) |
| 3 | DataBox-Download [Q16] | Liste + Abruf zugestellter Dokumente (Bescheide, Protokolle, Mitteilungen) | **fertig** `packages/finanzonline/src/databox.ts` (`liste`, `eintrag`, `rkdbProtokolle`) | genutzt: UID-Bescheid-Abholung, Benutzerart-Probe; `rkdbProtokolle` nicht | alle: Rückkanal für Protokolle, Bescheide, Kontoinformation | – | niedrig (nur lesen, aber `eintrag` markiert gelesen) |
| 4 | File-Upload [Q4] | Erklärungen/Anträge als XML hochladen (`art` = Anbringen, Abschnitt 2) | **teilweise**: Transport fertig `packages/finanzonline/src/fileupload.ts`, **kein** Builder für irgendein Anbringen, **kein** Protokoll-Parser | **nicht genutzt** | E/A, Lohn: hoch (U30, SB, KOMU …) | je Anbringen | je Anbringen |
| 5 | UID-Abfrage [Q27] | UID Stufe 1/2 | **fertig** `packages/uid/` | in Produktion: `uid-pruefung-dienst.js` u. a. | E/A: Reverse Charge, igL | – | mittel |
| 6 | Abfrage Datenübermittlungen [Q17] | Liest Daten, die **Dritte** über eine Steuernummer gemeldet haben: Lohnzettel/§ 109a-Mitteilungen, Sonderausgaben, Leitungsrechte, Hochwasser; Zeitraum Jahr (lfd. Jahr − 7 … lfd. Jahr, ab 2016) | fehlt | – | gering: Lohn könnte eigene Lohnzettel kontrollieren, wenn berechtigt; rc −4 „Teilnehmer für diese Funktion nicht berechtigt", wer berechtigt ist, sagt das Handbuch nicht **[offen]** | M | niedrig |
| 7 | Bankdatenübermittlung [Q22] | Upload `art=KTOREG` (Kontenregister) | fehlt | – | keiner (nur Kreditinstitute) | – | – |
| 8 | USt-Webservice § 18 Abs. 11/12 [Q23] | Aufzeichnungen meldepflichtiger Plattformen | fehlt | – | keiner (nur Plattformen) | – | – |
| 9 | QuotenAbfrage [Q24] | Quotenfälle eines Parteienvertreters | fehlt | – | keiner (nur Parteienvertreter) | – | – |

Zusätzlich relevant, aber kein eigener Webservice: **DataBox-Inhalte** [Q16],
die über Nr. 3 kommen:

- `erltyp=P` Protokolle. Eigene Anbringen-Codes nur für BKEST, GIR, GMSG,
  KTOABF/KTOREG/KTOZUF, QUOTE, RKDB, SOER, UEB_SA, UID, VAT, VATAB, VPDGD,
  107/107AB/107HW/107HWAB; zusätzlich eine Zeile „P / (leer) / Protokoll /
  XML". **Für U30 gibt es keinen eigenen Code**; das U30-Protokoll kommt
  vermutlich mit leerem `anbringen` **[offen, am ersten T-Protokoll prüfen]**.
- `erltyp=M`, `anbringen=BUMI` „Kontoinformation/Buchungsmitteilung", **XML**,
  Schema veröffentlicht [Q18]. Siehe Abschnitt 4.
- `erltyp=M`, `anbringen=EIMIT` „Benachrichtigung über
  Vierteljahresfälligkeiten", PDF.

## 2. Anbringen-Arten des File-Upload-Webservice

Das Handbuch [Q4] nennt **39** Arten; der Code übernimmt genau diese Liste
(`fileupload.ts:21-61`). Stand im Repo für **alle** Arten: Transport fertig
(`upload({ art, data })`), kein XML-Builder, kein Protokoll-Parser. Darum fehlt
die Spalte „Stand Repo" unten.

**Befund (nicht U30-relevant, aber ein latenter Fehler):** Das live
ausgelieferte Schema [Q6] weicht vom Handbuch ab. Es enthält `KDUEB`,
`NOVASB`, `NOVASBAB`, `KDX` (im Handbuch nicht, im Code im Juli entfernt) und
**nicht** `BIL`, `IVF`, `JAB` (im Handbuch und im Code). Beim rkdb-Dienst kam
im Juli ein schemawidriger Request live als SOAP-Fault „Validation error"
zurück (Projektnotizen). Validiert der FileUpload genauso, scheitert ein
`upload` mit `art=BIL|IVF|JAB` am Schema **[offen]**.

Nachrecherche: **maßgeblich ist das Live-Schema, das PDF ist veraltet.** Die
Wayback-Stände des Schemas [H5] zeigen: BIL/IVF/JAB/KDUEB standen 2017 drin,
JAB und IVF fehlen ab April 2026, BIL ist danach verschwunden. Fachlich
passt das: E-Bilanz-Übermittlung mit 02.06.2026 eingestellt [H4];
Jahresabschlüsse ans Firmenbuch gehen seit 01.01.2026 nicht mehr über
FinanzOnline (WKO). KDUEB, KDX, NOVASB, NOVASBAB stehen in keiner
BMF-Dokumentenversion [Q5]. `ANBRINGEN` im Code sollte dem Live-Schema
folgen. `U30`, `SB`, `SBS`, `SBZ`, `KOMU`, `U13` stehen in beiden Listen.
Paketsteuer [Q28] hat eine eigene Struktur, steht aber in **keiner** der beiden
`art`-Listen; der Übermittlungsweg ist **[offen]** (für Kasseneck ohne Belang).

### 2.1 Für Kasseneck-Kund\*innen relevant

| art | Inhalt [Q4] | Nutzen | Aufwand | Risiko | Vorschlag |
|---|---|---|---|---|---|
| **U30** | Umsatzsteuervoranmeldung | **E/A + Kasse: sehr hoch.** Monatlich/vierteljährlich Pflicht ab 55.000 € Vorjahresumsatz, monatlich ab 100.000 € [Q14]; Kasseneck hat die Zahlen aus Rechnungen/Belegen | M (Builder + Prüfungen + Protokoll-Parser) | hoch: falsche Zahl = falsche Zahllast beim Finanzamt; mildernd: Testmodus `T` | **zuerst** |
| U13 | Zusammenfassende Meldung (igL, Dreiecksgeschäft, sonstige Leistungen EU) | E/A mit EU-B2B-Umsätzen; Pflicht neben der U30. Struktur in [Q2] | S–M | mittel | später, wenn Kund\*innen igL/EU-Leistungen haben |
| SB | Buchung von Selbstbemessungsabgaben | Lohn: L/DB/DZ (und U) aufs Abgabenkonto buchen, ohne Zahlung. Felder: `UVAZRVON/UVAZRBIS`, Verrechnungsweisungen `AA/ZRVON/ZRBIS/BETRAG` [Q20] | S–M | mittel (bucht Soll aufs Konto) | später (mit Lohn) |
| SBS | Berichtigung Buchung SB | Gegenstück zu SB [Q2] | S | mittel | später, zusammen mit SB |
| SBZ | Meldung zur Zahlung von Selbstbemessungsabgaben | Meldet Abgaben, die dann in FinanzOnline unter „Zahlung" vorbefüllt erscheinen; **zahlt nicht** [Q21], siehe 4 | S | niedrig | später/optional |
| KOMU | Kommunalsteuererklärung (KommSt1/KommSt2) | Lohn: jährliche Erklärung an die Gemeinden; Struktur in [Q2] | M | mittel | später (mit Lohn) |
| KOM | Kommunalsteuerbemessungsgrundlage | Lohn; Abgrenzung zu KOMU (wer übermittelt was) **[offen]** | M | mittel | später, erst klären |
| JAHR_ERKL | Jahreserklärungen E1, U1, K1, K2, E6 (eigene Seite „Jahreserklärungen" [Q3]) | E/A: U1 + E1/E1a wären der große Schritt nach der U30 | L | hoch | später (eigene Analyse) |
| FVAN | Fristverlängerung Abgabenerklärungen | gering (Parteienvertreter-typisch) | S | niedrig | nie/auf Zuruf |
| RZ | Rückzahlung | E/A: Guthaben aus Gutschrift-UVAs zurückholen | S | **hoch** (Geldfluss, IBAN) | später, nur mit Freigabe-Schritt |
| UEB | Übertragung innerhalb der Finanzverwaltung (Guthaben/gebuchte SB) | gering | S | hoch | nie/auf Zuruf |
| ZEAN | Zahlungserleichterung | gering | S | mittel | nie/auf Zuruf |
| L1 | Arbeitnehmerveranlagung | keiner (betrifft Arbeitnehmer\*innen, nicht Kund\*innen als Unternehmen) | – | – | nie |
| SOER | Sonstige Erklärungen (eigenes Protokollformat [Q2]) | gering | M | niedrig | nie/auf Zuruf |
| TVW | Teamverwaltung | keiner | – | – | nie |

Hinweis Lohn: Lohnzettel **L16** gehen nicht über FinanzOnline, sondern über
ELDA (Paket `@kreiseck/elda`). In der FileUpload-Liste gibt es kein L16.

### 2.2 Für Kasseneck-Kund\*innen nicht relevant (nie)

`BET` (Beteiligte Personengesellschaft), `BIL` (E-Bilanz), `DUE`
(Depotübertragung), `EUST` (EU-Quellensteuer), `FPH`/`LFH` (Flugabgabe), `IVF`
(Investmentfonds), `JAB` (Jahresabschluss Firmenbuch), `KA1`
(Kapitalertragsteuer-Anmeldung), `NOVA` (Normverbrauchsabgabe), `STAB`
(Stabilitätsabgabe), `UEB_SA` (Sonderausgaben-Datenübermittlung durch
Empfänger), `VAT`/`VATAB` (Vorsteuererstattung EU — denkbar für Einzelfälle,
aber eigener großer Antrag), `VPDGD` (CbC-Reporting), `107*`/`108*`
(Leitungsrechte, Vorsorge, Hochwasser), `DIGI` (Digitalsteuer), `QUOTE`
(Quotenmeldung), `GIR` (Mindeststeuer). Begründung jeweils: Zielgruppe sind
Banken, Konzerne, Plattformen, Parteienvertreter oder Sonderbranchen, nicht
Kleinunternehmen mit Kasse/E-A-Rechnung/Lohn.

## 3. U30 im Detail

### 3.1 Schema und Dateien

- Aktuell: **„Umsatzsteuervoranmeldung ab 07/2026"** [Q7–Q11], gültig ab
  Zeitraum 7/2026 bzw. 3. Quartal 2026. Vorgänger „ab 01/2022" [Q12] gilt
  weiter für frühere Zeiträume.
- Das 07/2026-Schema ist eine **echte Obermenge** des 01/2022-Schemas: der Diff
  der XSDs besteht nur aus `KZ124` (in `VERSTEUERT` nach `KZ022`) und `KZ125`
  (in `VERSTEUERT_IGE` nach `KZ072`) [Q7, Q12]. Eine U30 ohne 124/125 ist
  gegen beide gültig. Nachgeprüft mit `xmllint --schema`: das BMF-Muster [Q8]
  ist gegen 07/2026 gültig und gegen 01/2022 nur wegen `KZ125` ungültig.
- 4,9 % ist Gesetz: Nationalrat 21.05.2026, **BGBl. I Nr. 37/2026** [Q25],
  gilt seit 01.07.2026 für Lebensmittel der neuen Anlage 3 zum UStG, nicht für
  Gastronomie [Q26]. Die Dokumentenversion [Q11] hat die frühere Fassung
  „vorläufige Veröffentlichung, da das Gesetz noch nicht beschlossen ist"
  durch „gültig ab 7/2026" ersetzt.
- XML-Deklaration im Schema und Muster: `encoding="iso-8859-1"`. **Kein
  Namespace** (kein `targetNamespace`), `elementFormDefault="qualified"` [Q7].
- Wurzel `ERKLAERUNGS_UEBERMITTLUNG` = `INFO_DATEN` + 1…9999 × `ERKLAERUNG`
  [Q7].

### 3.2 Aufbau (Reihenfolge bindend, `xs:sequence`) [Q7]

```
ERKLAERUNGS_UEBERMITTLUNG
├─ INFO_DATEN
│  ├─ ART_IDENTIFIKATIONSBEGRIFF   fix "FASTNR"
│  ├─ IDENTIFIKATIONSBEGRIFF       9 Ziffern, 010000010…989999999 (Steuernummer des Übermittlers)
│  ├─ PAKET_NR                     1…999999999
│  ├─ DATUM_ERSTELLUNG type="datum"     xs:date
│  ├─ UHRZEIT_ERSTELLUNG type="uhrzeit" xs:time
│  └─ ANZAHL_ERKLAERUNGEN          1…9999
└─ ERKLAERUNG art="U30"            (Attribut Pflicht, Typ xs:string; Muster: "U30")
   ├─ SATZNR                       xs:positiveInteger (Handbuch: "bis zu 9-stellig" [Q9])
   ├─ ALLGEMEINE_DATEN
   │  ├─ ANBRINGEN                 fix "U30"
   │  ├─ ZRVON type="jahrmonat"    xs:gYearMonth (JJJJ-MM)
   │  ├─ ZRBIS type="jahrmonat"    xs:gYearMonth
   │  ├─ FASTNR                    9 Ziffern (Steuernummer der/des Pflichtigen)
   │  └─ KUNDENINFO?               0–50 Zeichen, kommt im Protokoll zurück
   ├─ LIEFERUNGEN_LEISTUNGEN_EIGENVERBRAUCH   (Pflicht)
   │  ├─ KZ000                     Pflicht, ≥ 0
   │  ├─ KZ001?  KZ021?
   │  ├─ STEUERFREI?   KZ011 KZ012 KZ015 KZ017 KZ018 KZ019 KZ016 VST KZ020
   │  └─ VERSTEUERT?   KZ022 KZ124 KZ029 KZ006 KZ037 KZ052 KZ007 KZ056 KZ057 KZ048 KZ044 KZ032
   ├─ INNERGEMEINSCHAFTLICHE_ERWERBE?
   │  ├─ KZ070?  KZ071?
   │  └─ VERSTEUERT_IGE?   KZ072 KZ125 KZ073 KZ008 KZ088 KZ076 KZ077
   └─ VORSTEUER?   KZ060 KZ061 KZ083 KZ065 KZ066 KZ082 KZ087 KZ089 KZ064 KZ062 KZ063 KZ067 KZ090 ARE REPO
```

Die Reihenfolge ist **nicht numerisch** (z. B. `KZ016` nach `KZ019`, `KZ124`
direkt nach `KZ022`). Jede Kennzahl trägt `type="kz"` (Attribut Pflicht).
Alle Elemente innerhalb der Blöcke sind optional (`minOccurs="0"`), außer
`KZ000`.

### 3.3 Kennzahlen 2026

Wertetypen [Q7]: **kz** = 0,01 … 9.999.999.999.999,99 (also **> 0**, null ist
ungültig und wird weggelassen) · **kznull** = 0 … 9.999.999.999.999,99 ·
**kzvorz** = −9.999.999.999.999,99 … +9.999.999.999.999,99. Immer höchstens
2 Nachkommastellen, 15 Stellen gesamt, Dezimalpunkt.

Bezeichnung und Steuersatz aus dem Formular U 30-2026 [Q13], Zeile in Klammern.

| KZ | Block | Typ | Bedeutung [Q13] | Satz |
|---|---|---|---|---|
| 000 | L | kznull | (4.1) Gesamtbetrag BMG Lieferungen/sonstige Leistungen inkl. Anzahlungen | – |
| 001 | L | kz | (4.2) zuzüglich Eigenverbrauch | – |
| 021 | L | kz | (4.3) abzüglich Umsätze mit Übergang der Steuerschuld (§ 19) | – |
| 011 | STF | kz | (4.5) steuerfrei mit VSt-Abzug: Ausfuhrlieferungen | – |
| 012 | STF | kz | (4.6) Lohnveredelungen | – |
| 015 | STF | kz | (4.7) § 6 Abs. 1 Z 2–6, § 23 Abs. 5 | – |
| 017 | STF | kz | (4.8) innergemeinschaftliche Lieferungen | – |
| 018 | STF | kz | (4.9) igL neuer Fahrzeuge ohne UID | – |
| 019 | STF | kz | (4.10) steuerfrei ohne VSt-Abzug: Grundstücksumsätze | – |
| 016 | STF | kz | (4.11) Kleinunternehmer § 6 Abs. 1 Z 27 | – |
| VST | STF | String 1–4, `[0-9][0-9,a-z,A-Z]{0,3}` | (4.12) Ziffer des § 6 Abs. 1 zu KZ 020 | – |
| 020 | STF | kz | (4.12) übrige steuerfreie Umsätze ohne VSt-Abzug | – |
| 022 | VERST | kz | (4.14) Normalsteuersatz | **20 %** |
| 124 | VERST | kz | (4.15) ermäßigter Steuersatz, **neu ab 07/2026** | **4,9 %** |
| 029 | VERST | kz | (4.16) ermäßigter Steuersatz | **10 %** |
| 006 | VERST | kz | (4.17) ermäßigter Steuersatz | **13 %** |
| 037 | VERST | kz | (4.18) Jungholz und Mittelberg | **19 %** |
| 052 | VERST | kz | (4.19) Zusatzsteuer pauschalierte LuF | **10 %** |
| 007 | VERST | kz | (4.20) Zusatzsteuer pauschalierte LuF | **7 %** |
| 056 | VERST | kz | (4.21) Steuerschuld § 11 Abs. 12/14, § 16 Abs. 2, Art. 7 Abs. 4 — **Steuerbetrag** | – |
| 057 | VERST | kz | (4.22) Steuerschuld § 19 Abs. 1 zweiter Satz, 1c, 1e, Art. 25 Abs. 5 — **Steuerbetrag** | – |
| 048 | VERST | kz | (4.23) Steuerschuld § 19 Abs. 1a (Bauleistungen) — **Steuerbetrag** | – |
| 044 | VERST | kz | (4.24) Steuerschuld § 19 Abs. 1b — **Steuerbetrag** | – |
| 032 | VERST | kz | (4.25) Steuerschuld § 19 Abs. 1d — **Steuerbetrag** | – |
| 070 | IGE | kznull | (4.26) Gesamtbetrag BMG innergemeinschaftliche Erwerbe | – |
| 071 | IGE | kz | (4.27) davon steuerfrei Art. 6 Abs. 2 | – |
| 072 | IGE | kz | (4.29) igE Normalsteuersatz | **20 %** |
| 125 | IGE | kz | (4.30) igE ermäßigt, **neu ab 07/2026** | **4,9 %** |
| 073 | IGE | kz | (4.31) igE ermäßigt | **10 %** |
| 008 | IGE | kz | (4.32) igE ermäßigt | **13 %** |
| 088 | IGE | kz | (4.33) igE Jungholz/Mittelberg | **19 %** |
| 076 | IGE | kz | (4.34) nicht zu versteuernde Erwerbe Art. 3 Abs. 8 (im Bestimmungsland besteuert) | – |
| 077 | IGE | kz | (4.35) nicht zu versteuernde Erwerbe Art. 3 Abs. 8 (gelten im Inland als besteuert) | – |
| 060 | VSt | kz | (5.1) Gesamtbetrag der Vorsteuern | – |
| 061 | VSt | kz | (5.2) entrichtete EUSt | – |
| 083 | VSt | kz | (5.3) geschuldete, auf dem Abgabenkonto verbuchte EUSt | – |
| 065 | VSt | kz | (5.4) Vorsteuern aus igE | – |
| 066 | VSt | kz | (5.5) Vorsteuern zu KZ 057 | – |
| 082 | VSt | kz | (5.6) Vorsteuern zu KZ 048 | – |
| 087 | VSt | kz | (5.7) Vorsteuern zu KZ 044 | – |
| 089 | VSt | kz | (5.8) Vorsteuern zu KZ 032 | – |
| 064 | VSt | kz | (5.9) Vorsteuern igL neuer Fahrzeuge (Art. 2) | – |
| 062 | VSt | kz | (5.10) davon **nicht** abzugsfähig (§ 12 Abs. 3) — mindert | – |
| 063 | VSt | **kzvorz** | (5.11) Berichtigung § 12 Abs. 10/11 | – |
| 067 | VSt | **kzvorz** | (5.12) Berichtigung § 16 | – |
| 090 | VSt | **kzvorz** | (6.) Sonstige Berichtigungen | – |
| ARE | VSt | `J` | Antrag: Überschuss zur Abdeckung von Abgaben verwenden [Q9] | – |
| REPO | VSt | `J` | Rechnungskopien gehen vorab/zeitgleich per Post ans FA [Q9] | – |
| 095 | – | **nicht im XML** | (7.1/7.2) Zahllast/Gutschrift — rechnet FinanzOnline | – |

Weggefallen: KZ 009/010 (5 %, nur 7/2020–12/2021) [Q10, Q12].

Folgerungen für die Prüfung vor dem Bauen:

- Für die Satz-Kennzahlen (022, 124, 029, 006, 037, 052, 007, 072, 125, 073,
  008, 088) überträgt das XML **nur die Bemessungsgrundlage**. Es gibt kein
  Feld für den Steuerbetrag dieser Zeilen. „Steuer = BMG × Satz" lässt sich
  also nicht gegen das XML prüfen, sondern nur gegen eine **Eingabe**, die den
  Steuerbetrag zusätzlich mitbringt (z. B. aus Kasseneck-Belegsummen). Siehe
  Entscheidung E2 in Abschnitt 7.
- 056, 057, 048, 044, 032 und alle Vorsteuer-KZ sind **Steuerbeträge** und
  werden so übertragen.
- Negative Werte nur in 063, 067, 090. Ausfüllhilfe: Ergibt sich bei einer
  Kennzahl rechnerisch eine negative BMG, ist dort **null** einzutragen und der
  negative Betrag als Berichtigung des Steuerbetrags zu erfassen (USt → KZ 090,
  VSt → KZ 067) [Q14].

### 3.4 Pflichtfelder

Pflicht laut Schema [Q7]: der ganze `INFO_DATEN`-Block, `SATZNR`,
`ANBRINGEN`, `ZRVON`, `ZRBIS`, `FASTNR`, `KZ000` (darf 0 sein [Q10]) und
das Attribut `art`. Alles andere optional. Fachlich zusätzlich Pflicht
(Prüfregeln, 3.6): `VST` ⇔ `KZ020`; `KZ070` wenn `KZ065` oder `KZ071`;
`KZ057` wenn `KZ066`; `KZ048` wenn `KZ082`; `KZ044` wenn `KZ087`; `KZ032`
wenn `KZ089`.

Eigene Sache: `IDENTIFIKATIONSBEGRIFF` = `FASTNR` (beide die Steuernummer
der/des Pflichtigen) [Q9]. Eine abweichende `FASTNR` ist nur für
Parteienvertreter mit steuerlicher Vollmacht zulässig [Q9]. Die UID kommt in
der U30 **nicht** vor.

### 3.5 Zeitraum: Monat und Quartal

- Monat: `ZRVON` = `ZRBIS` = JJJJ-MM. Quartal: `ZRVON` = erster, `ZRBIS` =
  letzter Monat des Kalendervierteljahrs (z. B. 2026-01 / 2026-03). Abgeleitet
  aus Formular-Feldern „2.1 für den Kalendermonat / 2.2 für das
  Kalendervierteljahr … bis" [Q13] und der Prüfmeldung
  „Kalendermonat/Kalendervierteljahr" [Q10]. **Belegt** im Langtext
  der BMF-Prüfliste ab 1/2008: „Quartal 01-03: ZRVON 200301 ZRBIS 200303"
  [Q29] (damals JJJJMM, heute JJJJ-MM). Alle gefundenen Umsetzungen
  (u. a. Microsoft Business Central) machen es so.
- Ob FinanzOnline prüft, dass Monat/Quartal zum Voranmeldungszeitraum der/des
  Pflichtigen passt, steht nicht in den Prüfregeln **[offen]**.
- Pflicht zur UVA: Vorjahresumsatz > 55.000 € vierteljährlich, > 100.000 €
  monatlich; darunter keine Abgabepflicht, wenn die Vorauszahlung rechtzeitig
  bezahlt ist oder sich keine ergibt, Überschüsse (Gutschriften) aber **nur**
  mit UVA [Q14]. Fälligkeit: 15. des zweitfolgenden Monats [Q14].

### 3.6 Prüfregeln des BMF [Q10]

Vollständig aus „Prüfungen UVA ab 7/2026":

| Bedingung | Fehlermeldung |
|---|---|
| aufrechtes Umsatzsteuersignal | „Kein Umsatzsteuersignal vorhanden" |
| *(Bedingungsfeld leer)* | „Für den angegebenen Zeitraum wurde bereits eine Umsatzsteuervoranmeldung eingebracht." — **zweimal** gelistet |
| *(leer)* | „… wurde die Umsatzsteuer bereits mit Bescheid festgesetzt." |
| *(leer)* | „… wurde bereits ein Umsatzsteuer-Jahresbescheid erlassen." |
| Jahr ≥ lfd. Jahr − 5 und ≤ lfd. Jahr | „Unzulässiger Zeitraum" |
| ZRBIS > lfd. Monat | „Kalendermonat/Kalendervierteljahr muss vor dem laufenden Zeitraum sein." |
| KZ000 vorhanden | „Es muss ein steuerbarer Umsatz (KZ 000) eingegeben werden. Der Wert Null ist zulässig." |
| 011+012+015+016+017+018+019+020 ≤ 000+001−021 | steuerfreie > steuerbare Umsätze |
| 006+007+022+029+037+052+**124** = (000+001−021) − (011+012+015+016+017+018+019+020) | Summe zu versteuernder Umsätze stimmt nicht |
| 065 und 071 nur mit 070 | |
| 070 ≥ 071 | |
| 008+072+073+088+**125** = 070 − 071 | Summe steuerpflichtiger igE stimmt nicht |
| 066 nur mit 057, 066 ≤ 057 | |
| 020 nur mit VST, VST nur mit 020 | |
| 082 nur mit 048, 082 ≤ 048 | |
| ARE nicht bei einer Berichtigung | |
| 087 nur mit 044, 087 ≤ 044 | |
| 089 nur mit 032, 089 ≤ 032 | |
| 009/010 nur 7/2020–12/2021 | |
| 124/125 erst ab 07/2026 bzw. 07–09/2026 | |

Die Bedingung bei „ZRBIS > lfd. Monat" und der Meldungstext widersprechen
sich (ZRBIS = laufender Monat erfüllt die Bedingung nicht, die Meldung
verlangt aber „vor dem laufenden Zeitraum"). Die Bibliothek sollte die
strengere Lesart prüfen: ZRBIS < laufender Monat (Europe/Vienna).

### 3.7 Zahllast/Gutschrift (KZ 095)

Wird nicht übermittelt; FinanzOnline rechnet sie und meldet sie im Protokoll
als `DRUCKTEXT` („Zahllast:" oder „Gutschrift:") und `DRUCKBETRAG` [Q15].

Formel, abgeleitet aus dem Formularaufbau [Q13] (das BMF schreibt sie nirgends
als Formel hin):

```
USt  = Σ runde(BMG × Satz) über 022, 124, 029, 006, 037, 052, 007
     + 056 + 057 + 048 + 044 + 032
     + Σ runde(BMG × Satz) über 072, 125, 073, 008, 088
VSt  = 060 + 061 + 083 + 065 + 066 + 082 + 087 + 089 + 064 − 062 + 063 + 067
095  = USt − VSt + 090        (> 0 Zahllast, < 0 Gutschrift)
```

**Rundung (Nachrecherche: weitgehend belegt):**

- Gesetz: Abgabenbeträge „auf volle Cent … Beträge unter 0,5 Cent abzurunden,
  Beträge ab 0,5 Cent aufzurunden", für Selbstberechnung sinngemäß
  (§ 204 Abs. 1 und 2 BAO) [Q30].
- BMF-Formular U30-2026: jede Satz-Zeile rechnet
  `Math.round(Satz × BMG × 100) / 100`, also **je Zeile, halbe Cent auf**
  [Q31].
- Anbieter: FinanzOnline rechnet die Steuer aus der **Netto-Gesamtsumme je
  Satz** und rundet dann; Belegsummen können daher um Cent abweichen [H2].
- Rest **[offen]**: ob der FinanzOnline-Server bei genau halbem Cent wie das
  Formular aufrundet. Bei 20 % entsteht nie ein halber Cent (0,2 × ganze
  Cent), bei 10 %, 13 %, 19 %, 7 % und 4,9 % schon (z. B. 0,05 € × 10 %,
  0,50 € × 13 %, 5,00 € × 4,9 %). Klärung im Testlauf über `DRUCKBETRAG`,
  falls das Testprotokoll ihn trägt.

Die drei Pilotfälle (Abschnitt 7) sind nachgerechnet und ergeben mit
„je Zeile kaufmännisch" exakt die bekannten Ergebnisse (Q1: −999,14, Q2:
−10,94, Q3: +2.185,34). Keiner enthält einen halben Cent, sie entscheiden die
Rundungsfrage also nicht.

### 3.8 Berichtigung desselben Zeitraums — **[teilweise geklärt, siehe Nachrecherche am Ende]**

- Das Papierformular hat ein Kästchen „Berichtigte Umsatzsteuervoranmeldung"
  [Q13]. **Das XML hat kein solches Feld** [Q7].
- Die Prüfregel „ARE nicht möglich bei einer Berichtigung" [Q10] zeigt, dass
  FinanzOnline Berichtigungen im Datenstrom kennt. Wie es eine erkennt, steht
  nirgends (naheliegend: es gibt schon eine UVA für den Zeitraum).
- Dagegen steht zweimal „Für den angegebenen Zeitraum wurde bereits eine
  Umsatzsteuervoranmeldung eingebracht." [Q10] — **ohne** Bedingung. Ob eine
  zweite U30 desselben Zeitraums per Datenstrom also als Berichtigung
  angenommen oder abgewiesen wird, ist aus den Quellen **nicht** zu klären.
- Bis zur Klärung: Berichtigung = vollständige neue U30 desselben Zeitraums
  (alle Kennzahlen, nicht nur die Differenz), ohne `ARE`. Die Bibliothek
  braucht dafür einen Eingabeschalter `berichtigung`, der nur die ARE-Regel
  steuert und nicht ins XML geht.
- Klärungswege: (a) wie die Pilotfälle Q1/Q2 2026 tatsächlich berichtigt
  wurden (FinanzOnline-Maske oder Datenstrom?), (b) Frage im WKO-Forum, auf das
  das BMF für Softwarehersteller verweist [Q3], (c) T-Test auf einen Zeitraum
  mit bestehender UVA — wobei offen ist, ob der Testmodus diese Prüfung
  überhaupt fährt (3.10).

Nachrecherche:

- **Amtlich:** Eine zweite elektronische UVA für denselben Monat wurde
  angenommen und enthielt die **vollen** Monatswerte, nicht die Differenz;
  rechtzeitig eingereicht „gilt [sie] als Voranmeldung" (BFG RV/5100641/2011
  [Q37]; § 21 Abs. 1 UStG [Q39]). Nach dem Fälligkeitstag führt sie zur
  Festsetzung, eine Gutschrift wirkt dann erst ab dem Bescheid.
- **Amtlich:** Die beiden „bereits eingebracht"-Zeilen stehen seit der
  Prüfliste ab 1/2008 unverändert ohne Bedingung und ohne Langtext da [Q29].
- **Anbieter, zwei unabhängige:** Über die Schnittstelle wird **pro Zeitraum
  genau eine weitere U30 als Korrektur angenommen**; eine dritte nicht, dann
  „direkt an das Finanzamt wenden" [H1, H2]. Das erklärt die Prüfregel
  „bereits eingebracht" plausibel, ist aber nicht amtlich.
- **Dialog vs. Datenstrom:** Im FinanzOnline-Dialog erscheint ein Feld
  „Berichtigung" [H3]; im XML gab es nie eines (alle Schemas 2009–2026
  geprüft).
- **Testmodus klärt das vermutlich nicht:** Bei anderen Anbringen prüft T
  ausdrücklich nicht gegen gespeicherte Daten — „ERR-E-001 und ERR-E-012
  [pro Zeitraum nur einmal] wird bei einer Testübermittlung nicht geprüft"
  [Q32]; bei der Fristverlängerung läuft die Berechtigungsprüfung nur
  „(Produktionsübermittlung)" [Q33].

Folge für das Design: Berichtigung = vollständige neue U30, Schalter
`berichtigung` nur für die ARE-Regel, und Kasseneck muss je Zeitraum zählen,
wie oft schon übermittelt wurde (zweite = letzte über die Schnittstelle).

### 3.9 Nullmeldung

`KZ000` = `0.00` und sonst nichts ist schemakonform (alle anderen Blöcke
optional, `KZ000` vom Typ kznull) und fachlich erlaubt („Der Wert Null ist
zulässig") [Q7, Q10]. Weil alle anderen KZ vom Typ kz (≥ 0,01) sind, dürfen
Nullwerte dort **nicht** als `0.00` stehen, sondern müssen fehlen.

### 3.10 Testmodus (`uebermittlung = T`)

Belegt:

- Gleiche URL, Feld `uebermittlung` `P` (Produktion) oder `T` (Test) [Q4].
- „Die Testübermittlung dient zur Überprüfung von XML-Files … Wenn beim
  Absenden eines Test-Files eine Bestätigungsmeldung angezeigt wird, wurden die
  Daten zur Prüfung übernommen. Das Ergebnis der Prüfung wird im Protokoll in
  den Nachrichten angezeigt. … diese Daten [gelten] nicht als eingebracht!" [Q3]
- Live (24.07.2026, eigener Test mit `art=RZ`): rc 0, Meldung sinngemäß „nur
  für Testzwecke, gelten nicht als eingebracht" (Commit 24e5ddc).

**[offen]:** welche der inhaltlichen Prüfungen (3.6) der Testmodus fährt —
insbesondere Umsatzsteuersignal, „bereits eingebracht", „Bescheid
festgesetzt". Das Handbuch sagt nur „Prüfung". Erst ein echtes T-Protokoll
zeigt es.

Nachrecherche: Bei SOER und Fristverlängerung prüft T Schema, Steuernummer
und Zuordnung zum Teilnehmer, aber **nicht** gegen gespeicherte Daten
(„pro Zeitraum nur einmal", Berechtigung) [Q32, Q33]. Für U30 nicht
dokumentiert; Erwartung: gleich. Testprotokolle sind eine eigene Art in den
Nachrichten und werden **31 Tage nach Zustellung** gelöscht, auch ungelesen
[Q35]. Sofortantwort bei T laut einem dokumentierten Webservice-Testlauf:
rc 0, „XML-File wurde gesendet, 1 Erklaerung wurde uebermittelt, nur fuer
Testzwecke; die Daten gelten nicht als eingebracht" (sinngemäß) [H6].

### 3.11 Rückgabe und Quittung

1. **Synchron** (`upload`): `rc` + `msg` [Q4]. `0` ok (nur formale Prüfung
   bestanden, noch **nicht** eingebracht [Q3]) · `−1` Session ungültig oder
   abgelaufen · `−2` Wartung · `−3` technischer Fehler · `−4` „div.
   Fehlermeldungen vom Parser" (formaler Fehler, ganzes Paket wiederholen
   [Q3]) · `−5` keine Berechtigung für diese Art. Technische Fehler als
   SOAP-Fault [Q4]. Fehler je Kennzahl gibt es synchron **nicht**; `msg` ist
   Freitext.
2. **Asynchron, die eigentliche Quittung**: Übermittlungsprotokoll in der
   **DataBox des übermittelnden Teilnehmers** unter Protokolle (`erltyp=P`)
   [Q4, Q16]. Erst eine positive inhaltliche Prüfung im Protokoll heißt
   „eingebracht" [Q3]. Inhalt [Q15]: `INFO_DATEN` (Steuernummer, PAKET_NR,
   Datum/Uhrzeit, Anzahl), `TEXT` (z. B. „… PRODUKTIONS-Übermittlung … zur
   Gänze eingebracht" / „nicht (vollständig) eingebracht"), je Satz `SATZNR`,
   `FASTNR`, `KUNDENINFO`, 0…n `FEHLTEXT` (kein FEHLTEXT = eingebracht) und für
   U30 `DRUCKTEXT` + `DRUCKBETRAG`. `SATZNR = INFO_DATEN` heißt: ganzes Paket
   wegen falscher Übermittler-Steuernummer abgewiesen.
3. **Postausgangsbuch** (nur FinanzOnline-Oberfläche):
   `Webservice_U30_JJJJ-MM-TT-HH.MM.SS.MMMMMM_Paketnummer` [Q4].

Nachrecherche — **amtliches Muster eines FileUpload-Testprotokolls** (GIR,
gleicher Webservice) [Q34]:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<XML>
  <FASTNR_FON_TN>…</FASTNR_FON_TN><MESSAGEREFID>…</MESSAGEREFID>
  <ART>GIR</ART><UEBERMITTLUNG>T</UEBERMITTLUNG><INFO>OK</INFO>
  <EINBRINGUNGSTIMESTAMP>2026-02-20T10:10:11.101010Z</EINBRINGUNGSTIMESTAMP>
  <TEXT>Die oben angeführte TEST-Übermittlung wurde am 20.02.2026 um 12:10:11 zur Gänze übernommen.</TEXT>
  <SATZNR>0</SATZNR><FASTNR>…</FASTNR>
</XML>
```

Flach, Wurzel `<XML>`, UTF-8. Im NOK-Fall `INFO` NOK, `SATZNR` INFO_DATEN
und `FEHLTEXT` mit Code (z. B. ERR-F-002 „Steuernummer ist nicht dem
FinanzOnline-Teilnehmer zugeordnet"). Ob das U30-Protokoll genauso aussieht
(GIR ist neuer, U30-Felder wie DRUCKBETRAG fehlen dort), ist offen.
Auffällig: Zeitstempel 10:10 Z, TEXT 12:10 — passt zu keiner Zeitzone sauber.
Laufzeit bis zum Protokoll: amtlich (2011) vormittags gesendet → am selben
Nachmittag, nachmittags → am nächsten Vormittag [Q38]; Anbieter heute 30–60
Minuten bis 1 Tag [H1, H2].

**[offen]:** Für das U30-Protokoll gibt es **kein XSD**, nur die
Feldbeschreibung [Q15]. Exakte Element-/Wurzelnamen, Format von DRUCKBETRAG,
der TEXT bei Testübermittlungen und der `anbringen`-Wert in der DataBox-Liste
(vermutlich leer, Abschnitt 1) — alles erst am ersten echten T-Protokoll festzustellen.
Fehler „je Kennzahl" gibt es nur, soweit `FEHLTEXT` sie benennt.

### 3.12 Rechte

- Übermittler muss FinanzOnline-Teilnehmer sein und einen Benutzer für
  „Webservices" anlegen [Q4]. Laut eigener Live-Prüfung (Juli 2026) hat dieser
  Benutzertyp Voll-Zugriff (DataBox, rkdb, FileUpload).
- **Wer übermittelt:** `FASTNR` ≠ eigene Steuernummer nur mit steuerlicher
  Vollmacht als Parteienvertreter [Q9]. Kasseneck ist kein Parteienvertreter.
  Also braucht **jedes Kundenunternehmen seinen eigenen Webservice-Benutzer** (tid, benid,
  pin) und übermittelt in eigener Sache (`IDENTIFIKATIONSBEGRIFF` = `FASTNR`).
- `rc −5` „keine Berechtigung, Inhalte dieser Art zu übermitteln" [Q4]: welche
  Einstellung das auslöst, ist **[offen]**.
- Fachlich: aufrechtes Umsatzsteuersignal der/des Pflichtigen [Q10]. Das
  „U-Signal" setzt das Finanzamt, wenn es die Unternehmereigenschaft
  festgestellt hat; nach „Änderung der Tätigkeit" ist eine U30 nicht sofort
  möglich [Q41].
- Ab 01.01.2027 gilt die FOnV 2027 [Q40]: Webservice ohne zweiten Faktor
  (§ 4 Abs. 1 Z 3); jeder Teilnehmer nutzt seinen Zugang „ausschließlich für
  Anbringen, die ihn selbst betreffen" (§ 18 Abs. 4 Z 1). Das bestätigt das
  Modell „Kundenunternehmen übermittelt mit eigenem Zugang, Kasseneck ist
  nur das Werkzeug".

### 3.13 Grenzen

- Paket ≤ 5 MB; empfohlen ≤ 50 Erklärungen je Paket; je Übermittlung nur eine
  Erklärungsart, nur Test **oder** Produktion [Q3].
- ≤ 9999 `ERKLAERUNG` je Paket, `PAKET_NR` 1…999.999.999 [Q7].
- Beträge ≤ 9.999.999.999.999,99 [Q7] = 999.999.999.999.999 Cent. Das passt in
  `Number.MAX_SAFE_INTEGER`, **das Produkt BMG × Satz aber nicht mehr**
  (Satz als ganze Zahl in Promille, z. B. 49 für 4,9 %). Rechnen mit BigInt.
- Zeitraum: höchstens 5 Jahre zurück, nicht laufender Monat [Q10].
- Ratenlimits: nicht dokumentiert **[offen]**.

### 3.14 Zeichensatz

- SOAP-Request in **UTF-8**: „Alle Request müssen in UTF-8 geschickt werden",
  „grundsätzlich sämtliche Zeichen in UTF-8" [Q4].
- Die U30-Daten selbst deklarieren `iso-8859-1` [Q7, Q8]. Das BMF-Beispiel im
  Handbuch bettet ein `iso-8859-1`-XML in CDATA in einen UTF-8-Request [Q4];
  ein anderes Beispiel (VAT) deklariert UTF-8. Wie FinanzOnline die innere
  Deklaration behandelt, ist **[offen]**.
- Praktisch betrifft das nur `KUNDENINFO` (einziges Freitextfeld; alles
  andere ist ASCII). Sicher: `KUNDENINFO` auf ASCII bzw. auf den Zeichenvorrat
  beschränken, den das BMF in seinem SBZ-Muster vorführt (a–z, A–Z, äöüßÄÖÜ,
  Ziffern, `:;,.-_+*#~?)(/%$§!°´`\}][{³²@`) [Q19], und im T-Test einmal mit
  Umlaut prüfen.
- Der vorhandene Transport überträgt `data` XML-escaped statt in CDATA; das
  wurde live mit rc 0 akzeptiert (Commit 24e5ddc).

## 4. Was es nicht per API gibt

| Thema | Befund |
|---|---|
| **Abgabenkonto-Stand abfragen** | **Gibt es nicht.** Kein Webservice in [Q1]. Teilersatz: DataBox-Eintrag **`M/BUMI` „Kontoinformation/Buchungsmitteilung" als XML** [Q16] mit Schema [Q18]: Anfangs-/Endsaldo (`ASALDO`/`ESALDO`, negativ = Guthaben), ausgesetzter Betrag, Buchungen je Tag mit Abgabenart und Zeitraum (Muster: „Voranmeldung Umsatzsteuer 02/2013, wirksam am 15.04.2013"). Das ist **Push**, kein Abruf: kommt nur, wenn das Finanzamt eine Buchungsmitteilung zustellt. Elektronisch nur, wenn der elektronischen Zustellung zugestimmt **und auf Zahlungsanweisungen verzichtet** wurde [Q36]; gelöscht 31 Tage nach Auslesen bzw. 6 Monate nach Zustellung [Q35]. Fester Rhythmus **[offen]**. |
| **Zahlung** (eps/Überweisung) | **Gibt es nicht.** eps läuft nur interaktiv in FinanzOnline „Zahlung" mit Weiterleitung ins Online-Banking der zahlenden Person [Q21]. Überweisung über das Bankservice „Finanzamtszahlung" (Steuernummer in der EndToEndId, Purpose TAXS, Verrechnungsweisung) liegt außerhalb von FinanzOnline; ein QR-Code kann das nicht abbilden (eigene Recherche 08/2026, Projektnotizen). |
| **Bringt SBZ etwas?** | Nur Komfort. SBZ „meldet" Selbstbemessungsabgaben (bis 20 Verrechnungsweisungen, Abgabenart + Zeitraum + Betrag) [Q19]; sie erscheinen dann in FinanzOnline „Zahlung" zur eps-Beauftragung, bezahlt wird aber weiterhin von Hand [Q21]. Für die U30 nicht nötig: die UVA selbst wird am Konto gebucht (Muster in [Q18]). SBZ kann im Unterschied zu SB auch USt-Gutschriften melden [Q21]. **SB** (Buchung) bucht Selbstbemessungsabgaben aufs Konto [Q20] — für Lohn (L/DB/DZ) interessanter als SBZ. |
| **Status früherer Übermittlungen** | **Gibt es nicht** als Abfrage. Einzige Quelle: Protokolle in der DataBox (31 Tage Abrufbarkeit über Zeitfenster [Q16]) und das Postausgangsbuch in der Oberfläche. Der Dienst „Abfrage Datenübermittlungen" ist etwas anderes (1, Nr. 6). |

## 5. Kasseneck heute

Kasseneck ist die Anwendung, für die dieses Paket gebaut wird. Stand
03.11.2026 (Code gelesen, nichts geändert):

- FinanzOnline wird für drei Dinge genutzt: Registrierkasse (`@kreiseck/rksv`),
  UID-Prüfung (`@kreiseck/uid`) und das Abholen der UID-Bescheide aus der
  DataBox (`@kreiseck/finanzonline`). `createFileUpload` wird nicht verwendet.
- Zugangsdaten je Kundenunternehmen, Sitzungsverwaltung mit Sperrschutz und
  die Erkennung der Benutzerart sind vorhanden und für U30 wiederverwendbar.
- **Benutzerart:** Wer nur einen „Benutzer für Registrierkassen-WebService"
  hat, kann keine U30 übermitteln; dafür braucht es den „Benutzer für
  WebService".
- **UVA: noch nichts vorhanden** — keine Kennzahlen 000–095, kein
  Voranmeldungszeitraum, keine Soll-/Ist-Besteuerung. Vorhanden sind
  Auswertungen je Steuersatz (Journal, Kasse, Rechnungen) und die
  E1a-Jahresauswertung.
- Beträge werden in ganzen Cent geführt; die Steuer wird je Beleg gerundet.
  FinanzOnline rechnet die Steuer dagegen aus der Bemessungsgrundlage je Satz
  (3.7) — Belegsummen können darum um Cent abweichen.
- In der Kassenauswertung teilen sich 19 % und 4,9 % den RKSV-Topf
  „Besonders"; die U30 braucht sie getrennt (KZ 037 und KZ 124).

Folgerung für den nächsten Schritt in Kasseneck: Die Kennzahlen müssen aus
Journal, Kasse und Rechnungen zusammengeführt werden; dazu fehlen
Voranmeldungszeitraum, Besteuerungsart, die Trennung 19 %/4,9 % und die
Bemessung bei Reverse Charge und innergemeinschaftlichem Erwerb.

## 6. Befunde zum Repo

1. **Vorgänger-Research falsch bei „Abfrage Datenübermittlungen"**
   (`2026-07-22-finanzonline-webservices.md`, Zeile 24: „Status früherer
   Übermittlungen abfragen"). Richtig: liefert Daten Dritter (Lohnzettel,
   Sonderausgaben …) zu einer Steuernummer [Q17].
2. **Vorgänger-Research widersprüchlich beim art-Enum:** dort „XSD-Enum als
   Wahrheit", der Code folgt aber dem Handbuch. Die beiden Listen weichen ab
   (Abschnitt 2). Für U30 egal, für BIL/IVF/JAB vermutlich ein Fehler.
3. **`createFileUpload` hat keinen Standard für `uebermittlung`**: der Aufrufer
   muss `'test' | 'echt'` angeben (`fileupload.ts:86-89`). Das Ziel „immer T,
   P nur mit eigenem Schalter" ist damit nicht abgesichert.
4. **DataBox-Handbuch neu:** Stand 29.10.2026 statt 06.07.2026 (Projektnotiz).
   Laut Dokumentenversion kam seither nur das Anbringen `NEHSI011` dazu
   (29.10.2026) bzw. `betreff` im Schema (07.07.2026, im Code schon da). Die
   `erltyp`-Liste in `databox.ts:39-45` deckt sich mit [Q16]. Kein
   Handlungsbedarf.
5. README `@kreiseck/finanzonline` beschreibt nur die DataBox; FileUpload fehlt
   dort ganz.

## 7. Vorschlag (priorisiert)

### Zuerst

1. **U30-Builder + Prüfungen + Protokoll-Parser** in `@kreiseck/finanzonline`
   (Phase 2). Begründung: Pflicht für Kasseneck-Kund\*innen mit mehr als
   55.000 € Vorjahresumsatz und der einzige Weg zu Gutschriften; Kasseneck
   hat die Rohdaten (Journal, Kasse, Rechnungen), wenn auch noch keine
   Kennzahlen (Abschnitt 5); der Testmodus erlaubt gefahrloses Prüfen.
   Voraussetzung beim Kundenunternehmen: „Benutzer für WebService", nicht
   der Registrierkassen-Benutzer. Umfang:
   - typisierte Eingabe in Cent, Builder gegen beide XSDs (07/2026 und
     01/2022 je Zeitraum), alle Prüfregeln aus 3.6 plus eigene
     (Wertebereiche, Vorzeichen, Zeitraum, unbekannte KZ), stabile Fehlercodes;
   - Zahllast/Gutschrift lokal berechnen (3.7) und im Ergebnis ausweisen;
   - `uebermittlung` standardmäßig `T`, `P` nur über einen ausdrücklichen
     eigenen Schalter (behebt Befund 6.3 für U30);
   - Parser für das U30-Übermittlungsprotokoll aus der DataBox
     (Satz-Fehler, DRUCKBETRAG), damit „eingebracht ja/nein" und der Abgleich
     mit der lokalen Zahllast möglich sind.
2. **Ein echter T-Lauf** mit Kasseneck-Testzugang, um die [offen]-Punkte zu
   schließen: Quartal-Darstellung, Protokollformat, Rundung, Testmodus-Umfang,
   Umlaut in KUNDENINFO.

### Später

3. `M/BUMI`-Parser (Kontoinformation) — billigster Weg zu einem
   Kontostand-Hinweis in Kasseneck (S).
4. Lohn: KOMU (Jahreserklärung Kommunalsteuer) und SB/SBS (L/DB/DZ vor der
   Zahlung aufs Konto buchen). Lohn läuft in Kasseneck bereits (mBGM,
   Finanzamtszahlung mit Verrechnungsweisung); ob SB gegenüber der heutigen
   Zahlung etwas bringt, erst fachlich klären (M).
5. U13 Zusammenfassende Meldung — wenn Kund\*innen EU-B2B-Umsätze haben (S–M).
6. RZ Rückzahlung — nur mit ausdrücklichem Freigabeschritt (S, Risiko hoch).
7. JAHR_ERKL (U1, E1/E1a) — eigene Analyse, groß (L).
8. art-Enum mit dem Live-XSD versöhnen (Befund 6.2), README ergänzen.

### Nie (für Kasseneck)

Bankdatenübermittlung, USt-Webservice § 18, QuotenAbfrage, Abfrage
Datenübermittlungen (außer jemand will Lohnzettel kontrollieren), und die
Anbringen aus 2.2.

### Entscheidungen für Phase 2 (getroffen am 04.11.2026)

- **E1 Berichtigung:** vollständige Neuübermittlung desselben Zeitraums
  (alle Kennzahlen, nicht die Differenz). Eingabeschalter `berichtigung`
  steuert nur die ARE-Regel; das XML kennt kein Berichtigungsfeld. Wie oft je
  Zeitraum schon übermittelt wurde, führt der Aufrufer (die Bibliothek ist
  zustandslos).
- **E2 Kontrolle „Steuer = BMG × Satz":** Die Eingabe darf je Satz-Kennzahl
  optional den erwarteten Steuerbetrag mitgeben; weicht er von der amtlich
  gerundeten Steuer ab, gibt es einen stabilen Fehlercode.
- **E3** Die beiden BMF-XSDs liegen als Testdaten im Repo (Quelle und Stand
  im Kopf der Datei).
- **E4** Die Tests prüfen jedes erzeugte XML offline mit `xmllint-wasm`
  (Dev-Abhängigkeit, keine Laufzeitabhängigkeit).

### Pilotfälle (Golden-Tests, nachgerechnet)

Ersatzdaten: Melisse Nails e.U. / Livia Lindmayr, Steuernummer 91-123/4565
(FASTNR 911234565). Die UID wird in der U30 nicht übertragen.

| Fall | 000 = 022 | 057 | 070 = 072 | 060 | 065 | 066 | USt 022 | USt 072 | 095 |
|---|---|---|---|---|---|---|---|---|---|
| Q1 2026 (berichtigt) | 984,17 | 214,44 | 1.975,38 | 1.195,97 | 395,08 | 214,44 | 196,83 | 395,08 | **−999,14** Gutschrift |
| Q2 2026 (berichtigt) | 5.847,50 | 205,10 | 1.382,62 | 1.180,44 | 276,52 | 205,10 | 1.169,50 | 276,52 | **−10,94** Gutschrift |
| Q3 2026 | 14.890,92 | 352,27 | 6.434,90 | 792,84 | 1.286,98 | 352,27 | 2.978,18 | 1.286,98 | **+2.185,34** Zahllast |

Alle drei erfüllen die BMF-Summenregeln (022 = 000; 072 = 070; 066 = 057).
Q1/Q2 liegen vor 07/2026 und dürfen daher kein 124/125 enthalten.

## 8. Testlauf mit eigenem Konto — nur `T`

Was Internet und Quellen nicht klären, lernen wir mit dem eigenen Konto von
Post Now e.U. im Testmodus. Regeln:

- Skript außerhalb des Repos, `uebermittlung` fest auf `T`, kein Weg zu `P`.
- Genau ein Login; bei Login-Fehler sofort Abbruch, kein zweiter Versuch
  (Sperre nach drei Fehlversuchen). Logout im `finally`.
- Zugangsdaten nur aus einer lokalen Datei außerhalb des Repos, nie
  ausgegeben, nie gespeichert.
- Jede Übermittlung ein eigenes Paket mit eigener `PAKET_NR` und
  `KUNDENINFO` `AGC-T<n>` zur Zuordnung. Request-XML, Sofortantwort und
  Protokoll landen in einer lokalen Ablage außerhalb des Repos.
- DataBox: nur `erltyp=P`-Einträge ab Testbeginn öffnen (Öffnen markiert als
  gelesen), keine UID-/RKDB-Einträge, sonst nichts anfassen. Testprotokolle
  innerhalb von 31 Tagen sichern [Q35].
- Testdaten gelten nicht als eingebracht [Q3].

| Nr. | Fall | Inhalt (Beträge in €) | Klärt |
|---|---|---|---|
| T0 | Prüft T gegen gespeicherte Daten? | Monat in einem Jahr mit erlassenem USt-Jahresbescheid | ob „Jahresbescheid erlassen"/„bereits eingebracht" im Testmodus überhaupt vorkommen (3.8, 3.10) |
| T1 | Monat, Grundfall | 2026-09, 000 = 022 = 1.000,00, 060 = 100,00 → Zahllast 100,00 | Sofortantwort, Protokollformat, `anbringen`/`filebez`, Laufzeit (3.11) |
| T2 | Quartal, Pilot Q3 | 2026-07…09, Werte Q3 → Zahllast 2.185,34 | Quartal, DRUCKTEXT/DRUCKBETRAG-Format |
| T3 | Rundung halber Cent | 000 = 029 = 0,05 → 0,005 | aufrunden (0,01) oder nicht (0,00) |
| T4 | Rundung je Zeile oder Summe | 000 = 0,55; 029 = 0,05; 006 = 0,50 | je Zeile 0,08, auf Summe 0,07 |
| T5 | 4,9 % | 2026-09, 000 = 124 = 5,00 → 0,245 | Rundung bei 4,9 %, KZ 124 akzeptiert |
| T6 | Nullmeldung | nur 000 = 0,00 | Nullmeldung, DRUCKBETRAG 0 |
| T7 | Gutschrift, Pilot Q1 | 2026-01…03, Werte Q1 → Gutschrift 999,14 | DRUCKTEXT „Gutschrift:", Vorzeichen |
| T8 | inhaltlicher Fehler | 000 = 1.000,00, 022 = 900,00 | Wortlaut FEHLTEXT, INFO NOK |
| T9 | KZ 124 vor 07/2026 | 2026-06, 000 = 124 = 100,00 | Wortlaut der 124/125-Sperre |
| T10 | laufender Monat | 2026-11 | „vor dem laufenden Zeitraum" (O13) |
| T11 | Umlaute | wie T1, `KUNDENINFO` „AGC-T11 äöüß" | Zeichensatz, Rückgabe im Protokoll (3.14) |
| T12 | Schemafehler | `KZ029` = 0.00 | rc −4 und Parser-Meldung synchron |
| T13 | zwei U30 gleicher Zeitraum in einem Paket | 2 × 2026-08, SATZNR 1 und 2 | ob der zweite Satz abgewiesen wird |
| T14 | gleicher Zeitraum wie T2, neues Paket | 2026-07…09, andere Werte | ob T „bereits eingebracht" meldet (erwartet: nein) |

Was danach voraussichtlich **trotzdem offen bleibt**: ob eine Berichtigung
im Echtbetrieb angenommen und eine dritte abgewiesen wird. Das klärt nur
eine echte Übermittlung (mit Freigabe) oder eine Auskunft des BMF.

### 8.1 Ergebnisse (laufend)

Konto: eigenes Testkonto (Post Now e.U., „Benutzer für WebService"),
`uebermittlung = T`. Grundfälle als Quartal (Post Now gibt vierteljährlich
ab); Monatsfälle folgen getrennt. Werkzeug und Rohdaten liegen außerhalb des
Repos.

**Sofortantworten, 03.11.2026 (T2 um 20:20, T3–T15 um 20:31 Wiener Zeit):**

| Fall | rc | msg |
|---|---|---|
| T2–T12, T14 | 0 | „XML-File wurde gesendet, es wurde 1 Erklärung übermittelt. Das File wurde nur für Testzwecke übermittelt! Die Daten gelten nicht als eingebracht." |
| T13 (2 Erklärungen) | 0 | dito mit „es wurden 2 Erklärungen übermittelt" |
| T15 (Deklaration UTF-8, Umlaute) | **−4** | „Invalid UTF-8 middle byte 0xf6 (at char #580, byte #37)" |

Erkenntnisse:

1. **Ein „Benutzer für WebService" darf U30 übermitteln** (kein rc −5).
2. **Die Sofortprüfung validiert nicht gegen das U30-XSD:** T12 mit
   `KZ029 = 0.00` (verletzt `minInclusive 0.01`) bekam rc 0. Sie parst nur
   und zählt die Erklärungen. rc 0 heißt also nur „zur Prüfung übernommen";
   eine Bibliothek muss **selbst** gegen das XSD prüfen.
3. **Zeichensatz geklärt:** FinanzOnline wandelt den `data`-String vor dem
   Parsen in **ISO-8859-1-Bytes** um (ö → 0xF6) und liest dann mit der
   deklarierten Kodierung. Mit `encoding="iso-8859-1"` gehen Umlaute durch
   (T11, rc 0), mit `encoding="UTF-8"` scheitert es (T15, rc −4). Folge: innere
   Deklaration immer `iso-8859-1`, Freitext (`KUNDENINFO`) nur Zeichen aus
   ISO-8859-1. Der XML-escaped Transport (kein CDATA) funktioniert.
4. rc −4 trägt die rohe Meldung des Java-XML-Parsers als `msg`.

**Protokolle (Quartalsdurchgang):** Zustellung in die DataBox nach **13 s bis
1 min**. Je Upload genau ein Eintrag: `erltyp=P`, `anbringen` **leer**,
`fileart` XML, `filebez` = `Webservice_U30_JJJJ-MM-TT-HH.MM.SS.ffffff_<PAKET_NR>`
(**Paketnummer im Dateinamen** → eindeutige Zuordnung), `applkey` =
Upload-Zeitstempel. T15 (rc −4) erzeugte kein Protokoll.

Aufbau (Testmodus), UTF-8, Wurzel `<XML>`, ohne Namespace:

```xml
<XML>
  <ART_IDENTIFIKATIONSBEGRIFF>FASTNR</ART_IDENTIFIKATIONSBEGRIFF>
  <IDENTIFIKATIONSBEGRIFF>…</IDENTIFIKATIONSBEGRIFF>
  <PAKET_NR>373430707</PAKET_NR>
  <DATUM_ERSTELLUNG>2026-11-03</DATUM_ERSTELLUNG>
  <UHRZEIT_ERSTELLUNG>20.31.59</UHRZEIT_ERSTELLUNG>      <!-- Punkte statt Doppelpunkte -->
  <ANZAHL_ERKLAERUNGEN>1</ANZAHL_ERKLAERUNGEN>
  <TEXT>Die oben angeführte TEST-Übermittlung wurde am 03.11.2026 um 20:31:59 nicht (vollständig) übernommen.</TEXT>
  <SATZNR>1</SATZNR>
  <FEHLTEXT>Die Kennzahlen 124 und 125 sind erst für Zeiträume ab 7/2026 bzw. 7-9/2026 zulässig</FEHLTEXT>
</XML>
```

Bei Erfolg endet es nach `TEXT` („… zur Gänze übernommen."). **Kein
DRUCKTEXT/DRUCKBETRAG, keine FASTNR, keine KUNDENINFO im Testprotokoll** —
anders als die Feldliste für Produktionsprotokolle [Q15]. TEXT-Uhrzeit =
Upload-Zeit in Wiener Zeit.

| Fall | Ergebnis Testprotokoll | Bedeutung |
|---|---|---|
| T2 Quartal Q3, Pilot | zur Gänze übernommen | Quartal 2026-07…09 korrekt dargestellt |
| T3/T4/T5 Rundung | übernommen | **Rundung im Testmodus nicht ablesbar** (kein DRUCKBETRAG) |
| T6 Nullmeldung | übernommen | Nullmeldung nur mit KZ000 = 0.00 gültig |
| T7 Q1 2026, Pilot Gutschrift | übernommen | keine Prüfung gegen bestehende UVA |
| T8 022 ≠ 000 | **nicht übernommen**, FEHLTEXT „Die Summe der steuerbaren Umsätze abzüglich der Summe der steuerfreien Umsätze ist ungleich der Summe der zu versteuernden Umsätze." | Summenregel wird in T geprüft, Text = Prüfliste [Q10] |
| T9 KZ 124 im Q2 | **nicht übernommen**, FEHLTEXT „Die Kennzahlen 124 und 125 sind erst für Zeiträume ab 7/2026 bzw. 7-9/2026 zulässig" | Zeitraumregel 124/125 wird geprüft; kein Schemafehler → FinanzOnline liest auch frühere Zeiträume mit der 07/2026-Struktur |
| T10 laufendes Quartal 10–12/2026 | **übernommen** | „ZRBIS > lfd. Monat" wird in T **nicht** geprüft (oder gar nicht) |
| T11 Umlaute, iso-8859-1 | übernommen | Umlaute ok; Rückgabe nicht prüfbar (keine KUNDENINFO im Testprotokoll) |
| T12 `KZ029 = 0.00` | **übernommen** | auch asynchron **keine** Prüfung des XSD-Wertebereichs |
| T13 zwei U30 gleicher Zeitraum, ein Paket | übernommen (2 Erklärungen) | keine Doppelprüfung in T |
| T14 gleicher Zeitraum wie T2 | übernommen | kein „bereits eingebracht" in T |

**Monatsdurchgang (21:03, gleiche Fälle mit Monatszeiträumen, Pakete
373621201–209):** identisches Verhalten. T1, T3–T6, T10 (laufender Monat
2026-11) und T13 „zur Gänze übernommen"; T8 und T9 „nicht (vollständig)
übernommen" mit denselben FEHLTEXTen. Monats-UVAs für ein Unternehmen, das
vierteljährlich abgibt, nimmt der Testmodus also ebenfalls an.

Folgerungen:

- Der Testmodus prüft die **Rechenregeln der Prüfliste** (Summen,
  124/125-Zeitraum), aber **nichts gegen gespeicherte Daten** (bestehende UVA,
  Doppelabgabe, Voranmeldungszeitraum Monat/Quartal) und nicht den laufenden
  Zeitraum. Das deckt sich mit SOER und
  Fristverlängerung [Q32, Q33]. **Berichtigung und „bereits eingebracht" sind
  im Testmodus nicht klärbar.**
- FinanzOnline prüft den XSD-Wertebereich zumindest im Testmodus nicht (T12) — die Bibliothek muss
  vor dem Senden selbst gegen das XSD prüfen, sonst gehen formal falsche
  Werte durch.
- Rundung bleibt bei der amtlichen Regel (§ 204 BAO, Formular je Zeile
  kaufmännisch) — im Testmodus nicht überprüfbar, weil der Betrag fehlt.

**DataBox-Client, Zeitzone — bestätigt (Fehler in `@kreiseck/finanzonline`):**
`liste()` sendet `ts_zust_von/bis` als UTC ohne Offset (`databox.ts:85-87`).
FinanzOnline liest sie als **Wiener Ortszeit**. Probe am 03.11.2026 mit der
T2-Zustellung (`ts_zust` 20:20:59+01:00): Fenster 19:15:59–19:25:59 (UTC-Uhrzeit)
→ 0 Einträge, Fenster 20:15:59–20:25:59 (Wiener Uhrzeit) → gefunden. Folge:
Jedes Fenster ist um 1 h (MEZ) bzw. 2 h (MESZ) nach vorne verschoben, frische
Zustellungen am Fensterende fallen heraus; die erste Abfrage dieses Testlaufs
hat das T2-Protokoll deshalb nicht gesehen. Betrifft auch Kasseneck
(UID-Bescheid-Abholung). Eigener Fix nötig: Zeit in Europe/Vienna formatieren.

### 8.2 Was nur eine echte Übermittlung (P) zeigen kann

Nicht im Testmodus klärbar, für den Echtbetrieb aber wichtig:

1. Berichtigung: wird die zweite U30 desselben Zeitraums angenommen, die
   dritte mit „bereits eingebracht" abgewiesen (Anbieter sagen ja [H1, H2])?
2. Rundung bei halbem Cent und Aufbau von `DRUCKTEXT`/`DRUCKBETRAG`,
   `FASTNR`, `KUNDENINFO` im Produktionsprotokoll.
3. Ob Monat/Quartal gegen den Voranmeldungszeitraum und der laufende Zeitraum
   geprüft werden.

Weg dorthin, ohne Risiko: die nächste **ohnehin fällige** UVA eines
Kundenunternehmens (oder von Post Now selbst) mit dessen ausdrücklicher
Freigabe über die Bibliothek senden und das Protokoll auswerten. Bis dahin
baut die Bibliothek nach den amtlichen Regeln (§ 204 BAO, Prüfliste) und
behandelt Berichtigung als vollständige Neuübermittlung mit Zähler je
Zeitraum.

### 8.3 Erste echte Übermittlung (P), 04.11.2026

Fällige UVA Q3/2026 eines Kundenunternehmens, mit dessen Freigabe, über
`@kreiseck/finanzonline` 0.3.0 (vorher derselbe Inhalt als T „zur Gänze
übernommen"). Eine Erklärung, Zahllast 2.185,34 €.

Zeitlinie (Sekunden ab Start): Login 0,1 – Upload 0,1 – Sofortantwort rc 0
nach 0,3 („XML-File wurde gesendet, es wurde 1 Erklärung übermittelt …") –
Protokoll in der DataBox zugestellt nach **≈ 60 s** (`ts_zust` 13:55:47,
Upload 13:54:48), gefunden beim sechsten Abruf. Wie im Testmodus: `erltyp P`,
`filebez` `Webservice_U30_<ts>_<PAKET_NR>`.

Produktionsprotokoll (UTF-8, flaches `<XML>`, Kennungen ersetzt):

```xml
<XML>
  <ART_IDENTIFIKATIONSBEGRIFF>FASTNR</ART_IDENTIFIKATIONSBEGRIFF>
  <IDENTIFIKATIONSBEGRIFF>911234565</IDENTIFIKATIONSBEGRIFF>
  <PAKET_NR>400000001</PAKET_NR>
  <DATUM_ERSTELLUNG>2026-11-04</DATUM_ERSTELLUNG>
  <UHRZEIT_ERSTELLUNG>13.54.48</UHRZEIT_ERSTELLUNG>
  <ANZAHL_ERKLAERUNGEN>1</ANZAHL_ERKLAERUNGEN>
  <TEXT>Die oben angeführte PRODUKTIONS-Übermittlung wurde am 04.11.2026 um 13:54:48 zur Gänze eingebracht.</TEXT>
  <SATZNR>1</SATZNR>
  <FASTNR>911234565</FASTNR>
  <KUNDENINFO>KE-Q3-2026</KUNDENINFO>
  <DRUCKTEXT>Zahllast:</DRUCKTEXT>
  <DRUCKBETRAG>2185.34</DRUCKBETRAG>
</XML>
```

Damit geklärt (Punkt 2 aus 8.2, soweit möglich):

- Im Echtbetrieb heißt es „eingebracht" statt „übernommen"; je Satz kommen
  `SATZNR`, `FASTNR`, `KUNDENINFO`, `DRUCKTEXT`, `DRUCKBETRAG` — genau die
  Feldliste aus [Q15]. `DRUCKBETRAG` hat **Punkt als Dezimaltrenner, ohne
  Tausenderpunkt**. Der Parser liest alles, `unbekannteElemente` bleibt leer.
- `DRUCKBETRAG` = von der Bibliothek berechnete Zahllast (2.185,34). Halbe
  Cent kamen in diesem Fall nicht vor (20 % von 14.890,92 = 2.978,184) — die
  Rundung bei genau halbem Cent bleibt offen.
- Steuerkonto: UVAs erscheinen dort erst mit einigen Tagen Verzug (bei den
  früheren Quartalen 2–6 Tage); im Steuerakt stehen UVAs nicht. Der schnelle
  Beleg ist das DataBox-Protokoll.

Weiter offen: Punkte 1 und 3 aus 8.2 (Berichtigung, Prüfung des
Voranmeldungszeitraums).

