# FinanzOnline-Webservices + VIES — verifizierte Faktenlage

Quellenbasis für das Paket `@kreiseck/finanzonline` (DataBox, Uploads, UID) plus
VIES-Fallback. Alle Angaben aus offiziellen Quellen (BMF-WSDL/XSD/Handbuch,
EU-VIES-WSDL/REST live), Stand 2026-07-22. Was nicht bestätigt ist, ist als
**[offen]** markiert (kein Raten).

## Host-Basispfade (bestätigt)
- `/fonws/ws/` → **session**, **rkdb** (regKasse)
- `/fon/ws/` → **databox**, **fileupload**
- `/fonuid/ws/` → **uidAbfrage**
- VIES: `https://ec.europa.eu/taxation_customs/vies/…`

Der alte Sammel-Index `/fon/wsdl/index.html` ist **404** — jede WSDL wird einzeln geladen.

## Vollständiges FON-Webservice-Inventar (9)
| # | Webservice | Endpoint / Op | Zweck | wir |
|---|---|---|---|---|
| 1 | Session | `/fonws/ws/session` · login/logout | SessionID für alle anderen | ✅ core |
| 2 | rkdb (Registrierkassen) | `/fonws/ws/rkdb` · `rkdb` | RKSV; async → DataBox `P/RKDB` | ✅ rksv |
| 3 | **DataBox-Download** | `/fon/ws/databox` · `getDatabox`,`getDataboxEntry` | digitales Postfach abholen | bauen |
| 4 | **FileUpload** | `/fon/ws/fileupload` · `upload` | Erklärungen/Dateien übermitteln | bauen |
| 5 | **UID-Abfrage** | `/fonuid/ws/uidAbfrage/` · `uidAbfrage` | UID-Prüfung Stufe 1/2 | bauen |
| 6 | Abfrage Datenübermittlungen | Handbuch (Stand 04.02.2026) | Status früherer Übermittlungen abfragen | [offen] |
| 7 | Bankendatenübermittlung | Handbuch | Banken übermitteln Kontodaten | [offen] |
| 8 | USt-Webservice (§18 UStG) | Handbuch | Plattform-Aufzeichnungspflichten | [offen] |
| 9 | QuotenAbfrage | Handbuch | Quotenlisten Parteienvertreter | [offen] |

## Architektur-Erkenntnis: DataBox ist der zentrale Hub
Alles Asynchrone landet in der DataBox und wird von dort abgeholt:
- rkdb async-Ergebnisprotokoll → `erltyp=P`, `anbringen=RKDB`, `fileart=XML`
- FileUpload-Übermittlungsprotokoll → `erltyp=P` (Protokolle)
- UID-**Bescheid** → am Folgetag in die DataBox (§132 BAO Nachweis)
- Bescheide/Mitteilungen → i. d. R. `fileart=PDF` (z. B. `B/RKJBES` = RK-Jahresbeleg-Mitteilung)

Alle Dienste teilen die **Session** (login → SessionID → logout) aus `finanzonline-core`.

## DataBox (`/fon/ws/databox`)  [WSDL/XSD/Handbuch Stand 06.07.2026]
**`getDatabox`** (Liste, nur Metadaten): req `tid,benid,id,erltyp,ts_zust_von?,ts_zust_bis?` → `rc,msg,result[databoxListEntry]`.
`databoxListEntry`: `stnr?,name,anbringen,zrvon,zrbis,datbesch,erltyp,fileart(XML|PDF),ts_zust,applkey,filebez,status(""=ungelesen|1=gelesen),betreff?`.
**`getDataboxEntry`** (Inhalt): req `tid,benid,id,applkey` → `rc,msg,result`(**Base64**). Abruf **markiert als gelesen**.
- Filter: `erltyp` leer = alle **ungelesenen**; mit `ts_zust_von/bis` = gelesen+ungelesen im Fenster. Kein Filter nach `stnr`/Status.
- Limits: `ts_zust_von` max 31 Tage zurück; Fenster max 7 Tage. Keine Pagination dokumentiert.
- rc: `0` ok · `-1` Session · `-2` Wartung · `-3` technisch · `-4` von+bis nötig · `-5` >31 Tage · `-6` Fenster >7 Tage.
- `erltyp`-Typen: `B`=Bescheide · `I`=Infos · `M`=Mitteilungen · **`P`=Protokolle** · `EU`,`FB`,`GM`,`KG`,`SS`,`QL`,… Feinabgrenzung über `anbringen` (hunderte Codes).
- Testzugang (Handbuch): `tid=1000103u3032 benid=webserv99 pin=webserv99`.
- **[offen]** Zuordnung Einreichung↔Ergebnis: die DataBox-Metadaten haben **kein** `paket_nr`/`kundeninfo`. Der Korrelationsschlüssel steckt **im dekodierten RKDB-Protokoll-XML** → gegen `regKasse.xsd`/rkdb-Response verifizieren.

## UID-Abfrage (`/fonuid/ws/uidAbfrage/`)  [WSDL/XSD/Handbuch Stand 20.09.2024]
- Eine Operation `uidAbfrage` (SOAPAction `uidAbfrage`). **Kein Batch** → Schleife.
- Request (alle Pflicht): `tid,benid,id,uid_tn(ATU\d{8}, eigene UID),uid(zu prüfen),stufe("1"|"2")`.
  `uid`-Pattern: `(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|SE|SI|SK|XI)[A-Za-z0-9]{8,12}|RO\d{2,10}`.
- Response: `rc(int),msg?,name?,adrz1?..adrz6?`. Name/Adresse **nur Stufe 2, nur wenn MS sie freigibt** (DE oft leer trotz gültig — normal).
- **Wichtig:** FON nimmt **keinen** Namen/Adresse als Eingabe (anders als VIES-Approx) — es *liefert* sie.
- Returncodes (Design-Kategorie):
  - `0` gültig · `1` **ungültig** (einziger echter Negativ) · `4` UID-String falsch · `5` eigene UID ungültig
  - `10` MS verbietet Abfrage · `11`/`-4` nicht berechtigt · `-1` Session
  - **transient (retry, NIE „ungültig"):** `-2` Wartung · `12` (noch) nicht abfragbar · `1511` derzeit nicht verfügbar · `1512` Überlast
  - **Ratenlimit:** `1513` = **max 2 Abfragen/Tag pro Erwerber-UID** (3. wird nicht weitergeleitet) · `1514` pro Antragsteller-UID
  - `103` CZ-Gruppe / `104` SK-Gruppe → nur Stufe 1 · `105` nur einzeln im FON-UI
- **Bescheid** (Rechtsnachweis §132 BAO): **nicht** in der SOAP-Antwort — kommt **am Folgetag in die DataBox**, eine Bestätigung je `uid_tn`. → UID ist **fest an DataBox gekoppelt**.
- Ausland/DE: Stufe 2 wird von FON an den MS (VIES-Mechanismus) weitergereicht; kein DE-spezifisches Feld.

## FileUpload (`/fon/ws/fileupload`)  [WSDL/XSD/Handbuch Stand 04.03.2026]
- Eine Operation `upload`. Req: `tid,benid,id,art,uebermittlung(T|P),data`.
- `art` = XSD-Enum (Whitelist), u. a. `U30`(UVA),`U13`(ZM),`JAHR_ERKL`,`L1`,`KOM`,`KOMU`,`SB`,`NOVA`,`DIGI`,`VPDGD`(CbC),`GIR`,`107*`,`108*`,`QUOTE` … (~40). PDF-Labels teils abweichend → XSD-Enum als Wahrheit.
- `data` = BMF-XML in **CDATA** (Root `<ERKLAERUNGS_UEBERMITTLUNG>` mit `<INFO_DATEN>`+`PAKET_NR`), eingebettete PDFs **base64**, alles **UTF-8**.
- Response: `rc,msg` (synchron nur Annahme). Echtes **Übermittlungsprotokoll async in DataBox** (Protokolle). Matching über `PAKET_NR`+`art`+Zeit.
- rc: `0` ok · `-1` Session · `-2` Wartung · `-3` technisch · `-4` Parser-Fehler(msg) · `-5` keine Berechtigung für diese `art`.
- **[offen]** max Dateigröße/Ratenlimit nicht dokumentiert; per-`art` Innenschemata separat auf bmf.gv.at.

## VIES (EU)  [WSDL live + REST live-Antworten]
- **SOAP** `checkVatService.wsdl`, Endpoint `…/services/checkVatService`.
  - `checkVat(countryCode,vatNumber)` → `valid,name?,address?,requestDate`.
  - `checkVatApprox(+trader*,+requester*)` → `valid, trader*, *Match(VALID|INVALID|NOT_PROCESSED), requestIdentifier`.
  - **Test-WSDL** `checkVatTestService.wsdl` mit deterministischen Nummern (100=gültig,200=ungültig,201/202=INVALID_INPUT,300–400=Faults).
- **REST** (neu, kein Key): `POST /rest-api/check-vat-number`; `GET /rest-api/ms/{cc}/vat/{no}`; `GET /rest-api/check-status`.
  - Check-JSON: `isValid, userError(VALID|INVALID|transient), name, address, requestIdentifier, viesApproximate{…,matchName:1/2/3}`.
  - `check-status`: `{vow:{available},countries:[{countryCode,availability:"Available"|…}]}` → **pro MS** vorab prüfen.
- **3-Ausgänge-Modell (Kern):** `VALID` · `INVALID`(echt: `valid=false`/`userError=INVALID`) · **`NO-ANSWER`** (jeder Fault/transient: `MS_UNAVAILABLE`,`TIMEOUT`,`MS_MAX_CONCURRENT_REQ`,`SERVICE_UNAVAILABLE`,`GLOBAL_*`,`INVALID_INPUT`=Eingabefehler). Transient **nie** als ungültig cachen.
- **Nachweis:** `requestIdentifier` (Konsultationsnummer) nur mit mitgeschickter Antragsteller-UID; leer bei anonym.
- **DE:** meist kein Name/Adresse (Datenschutz) trotz gültig; unter Last `MS_MAX_CONCURRENT_REQ` → Backoff. DE i. d. R. zuverlässig.
- Kommission haftet nicht für Genauigkeit (nationale DBs); Ausfälle oft nachts (DB-Backup).

## Offene Verifikationspunkte (vor bzw. während Implementierung)
1. RKDB-Protokoll-XML: exaktes Feld für `paket_nr`/`kundeninfo` (DataBox↔rkdb-Matching) → `regKasse.xsd` lesen.
2. UID Stufe-2-„MS gibt Name/Adresse nicht frei": strukturell `rc=0`+leere Felder — live gegenprüfen.
3. VIES REST-POST exakte optionale Feldnamen + reales `requestIdentifier`-Format — per Live-POST.
4. FileUpload Größen-/Ratenlimits — empirisch in TEST (`uebermittlung=T`).
5. Endpunktdetails der 4 „übrigen" Dienste (Abfrage-Datenübermittlungen, Bankendaten, USt §18, QuotenAbfrage) — je Handbuch nachziehen, falls im Scope.
