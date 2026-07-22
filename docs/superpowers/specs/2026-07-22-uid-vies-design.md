# `@kreiseck/uid` (VIES-first) + `@kreiseck/finanzonline` (DataBox) — Design

**Stand:** 2026-07-22. Ausbaustufe 3 („UID zuerst"). Verifizierte Faktenlage:
[docs/research/2026-07-22-finanzonline-webservices.md](../../research/2026-07-22-finanzonline-webservices.md).

## Ziel
Robuste EU-USt-ID-Validierung als eigenes Paket `@kreiseck/uid` — **VIES-first**
(vor allem für DE), mit FinanzOnline-UID als österreichischer Bescheid-/Zweitweg.
Dazu ein **minimaler DataBox-Client** in `@kreiseck/finanzonline`, um den
FON-UID-Bescheid (und später weitere asynchrone Protokolle) abzuholen.

## Architektur (Kurz)
- **VIES-first:** Prüfung primär über die EU-VIES-REST-API (keyless, kein
  2/Tag-Limit, sofortige Konsultationsnummer als Nachweis, DE zuverlässig).
- **FON-UID sekundär:** über eine bestehende `finanzonline-core`-Session, wenn ein
  österreichischer §132-Bescheid gebraucht wird oder als Zweitquelle. Der Bescheid
  steht **nicht** in der SOAP-Antwort, sondern kommt am **Folgetag in die DataBox**.
- **DataBox** (in `@kreiseck/finanzonline`) ist der Abhol-Hub für diesen Bescheid.
- **Zustandslos:** kein eingebauter Cache/Ratenzähler; das Paket liefert alles, was
  der Aufrufer für Caching/Retry/Ratenlimit braucht (klarer Ausgang, Retry-Flag,
  Cache-Key-Helfer).

## Global Constraints (für alle Tasks verbindlich)
- Node `>=20.18.0`; TypeScript strict + `noUncheckedIndexedAccess` + `noImplicitAny`; CJS-Build via `tsc`; Tests `node:test`.
- **Keine Laufzeitabhängigkeiten** (nur `node:*` + globales `fetch`). Framework-agnostisch, zustandslos.
- Lizenz **Apache-2.0**; `NOTICE` mitliefern; `publishConfig.access: public`.
- **Deutsche öffentliche API** (konsistent mit `finanzonline-core`/`rksv`).
- `@kreiseck/uid` hängt an `@kreiseck/finanzonline-core ^0.1.2` (Session, SOAP-Layer, `callSoap`, Fehlerhierarchie, XML-Parser). **Nicht** an `@kreiseck/finanzonline`.
- `@kreiseck/finanzonline` hängt an `@kreiseck/finanzonline-core ^0.1.2`.
- **Kein Raten:** Feldnamen/Returncodes/Endpoints wörtlich aus dem Research-Dokument; offene Punkte (unten) vor bzw. während der Umsetzung live verifizieren.

---

## Paket `@kreiseck/uid`

### Factory
```ts
createUid(config: UidConfig): Uid

interface UidConfig {
  antragsteller: string;      // eigene UID 'ATU########' — für Konsultationsnummer + FON uid_tn
  session?: Session;          // aus finanzonline-core; nur für fon.* nötig
  transport?: TransportOptions; // fetchImpl/Timeout — für Tests injizierbar
  viesBasis?: string;         // Default EU-VIES-REST-Basis; für Test-Sandbox überschreibbar
}
```

### Ergebnismodell (3 Ausgänge — der Kern)
```ts
type Ausgang = 'gueltig' | 'ungueltig' | 'keine_antwort';

interface UidErgebnis {
  ergebnis: Ausgang;
  quelle: 'vies' | 'fon';
  uid: string;                // normalisiert, Großbuchstaben, ohne Leerzeichen
  land: string;               // 2-stellig, VAT-Konvention: EL=Griechenland, XI=Nordirland
  abfragedatum: string;       // ISO
  name?: string;              // nur wenn MS/Stufe 2 freigibt (DE oft leer = normal)
  adresse?: string;
  nachweis?: Nachweis;        // bei 'gueltig' über VIES-Approx mit antragsteller
  // nur bei 'keine_antwort':
  grund?: KeinAntwortGrund;
  wiederholbar?: boolean;     // true → Aufrufer darf (mit Backoff) erneut versuchen
  rohRc?: string;             // Original-Returncode/Fault-Token zur Diagnose
}

type KeinAntwortGrund =
  | 'ms_nicht_erreichbar' | 'timeout' | 'ueberlast' | 'wartung'
  | 'ratenlimit' | 'gesperrt' | 'technisch' | 'nicht_berechtigt';

interface Nachweis {
  art: 'vies-konsultationsnummer' | 'fon-bescheid-in-databox';
  id?: string;                // VIES requestIdentifier; bei FON leer (Bescheid folgt in DataBox)
  datum: string;
  hinweis?: string;           // z. B. „Bescheid liegt am Folgetag in der DataBox"
}
```
**Regel (nicht verhandelbar):** Nur ein *abgeschlossener* Lookup mit „nicht
registriert" (`VIES userError=INVALID` / `FON rc=1`) ergibt `ungueltig`. **Jeder**
Fault/transiente Zustand → `keine_antwort` + `wiederholbar:true`; niemals als
`ungueltig` behandeln oder cachen.

### Methoden
```ts
interface Uid {
  // Einfache Gültigkeit, VIES-first (checkVat/GET). Ein Aufruf = eine UID (kein Batch).
  pruefe(uid: string): Promise<UidErgebnis>;

  // Qualifiziert: VIES checkVatApprox mit antragsteller -> Feld-Matches + Konsultationsnummer.
  bestaetige(args: {
    uid: string;
    name?: string; strasse?: string; plz?: string; ort?: string;
  }): Promise<UidErgebnis & { matches?: Record<'name'|'strasse'|'plz'|'ort', 'match'|'kein_match'|'nicht_geprueft'> }>;

  // Verfügbarkeit pro Mitgliedstaat (/check-status) — vor einer Prüfung konsultierbar.
  viesStatus(): Promise<{ vowVerfuegbar: boolean; land: Record<string, 'verfuegbar'|'nicht_verfuegbar'|'beobachtet'> }>;

  // FON-UID (österreichischer Weg), nur mit session. Bescheid folgt in DataBox.
  fon: {
    abfrage(args: { uid: string; stufe: 1 | 2 }): Promise<UidErgebnis>;
  };

  // Stabiler Cache-Key (Aufrufer cacht selbst): `${land}${normalisierteUid}`.
  cacheKey(uid: string): string;
}
```

### VIES-Anbindung (primär REST)
- **REST-Basis:** `https://ec.europa.eu/taxation_customs/vies/rest-api` (Default; via `viesBasis` überschreibbar → Sandbox/Test).
- `pruefe` → `GET /rest-api/ms/{land}/vat/{nummer}` (oder `POST /check-vat-number`); liest `isValid`, `userError`, `name`, `address`, `requestDate`.
- `bestaetige` → `POST /check-vat-number` mit `requesterMemberStateCode`+`requesterNumber` (aus `antragsteller`) + `trader*` → `requestIdentifier` + `viesApproximate.match*` (1=match, 2=kein_match, 3=nicht_geprueft).
- `viesStatus` → `GET /check-status` → `{ vow:{available}, countries:[{countryCode, availability}] }`.
- **Ausgang-Mapping:** `userError:"VALID"`→`gueltig`; `"INVALID"`→`ungueltig`; alles andere (`MS_UNAVAILABLE`,`TIMEOUT`,`MS_MAX_CONCURRENT_REQ`,`GLOBAL_MAX_CONCURRENT_REQ`,`SERVICE_UNAVAILABLE`)→`keine_antwort`(+Grund, `wiederholbar:true`); `INVALID_INPUT`→Eingabefehler (werfen: `UidEingabeError`).
- **SOAP als spätere Option** (`checkVatService.wsdl`, `checkVat`/`checkVatApprox`) — im ersten Wurf nicht nötig; API-Fläche identisch.
- UID-Normalisierung + `land`/`nummer`-Split gegen VIES-Pattern `[0-9A-Za-z\+\*\.]{2,12}`; Ländercodes VAT-Konvention (`EL`, `XI`).

### FON-UID-Anbindung (sekundär)
- Endpoint `/fonuid/ws/uidAbfrage/`, Operation `uidAbfrage` (SOAPAction `uidAbfrage`), Namespace `https://finanzonline.bmf.gv.at/fon/ws/uidAbfrage` — über `callSoap` aus core.
- Request (alle Pflicht): `tid,benid,id` (aus `session`), `uid_tn`=`config.antragsteller`, `uid`, `stufe`.
- Response: `rc,msg,name?,adrz1..adrz6?`. Name/Adresse zu einem `adresse`-String zusammenführen; Stufe-2-only.
- **Returncode → Ausgang** (verifizierte Tabelle):
  - `0`→`gueltig` · `1`→`ungueltig` · `4`→Eingabefehler(werfen) · `5`→eigene UID ungültig(werfen)
  - `10`,`11`,`-4`→`keine_antwort`/`nicht_berechtigt` · `-1`→Session (core wirft `FonSessionExpiredError`)
  - `-2`,`12`,`1511`,`1512`→`keine_antwort`/transient(`wiederholbar:true`)
  - `1513`,`1514`→`keine_antwort`/`ratenlimit`(`wiederholbar:false` am selben Tag)
  - `103`(CZ)/`104`(SK)→nur Stufe 1 (Hinweis) · `105`→einzeln im FON-UI (Hinweis)
- Bei `gueltig`: `nachweis = { art:'fon-bescheid-in-databox', datum, hinweis:'…Folgetag DataBox…' }`.

### Robustheit / zustandsloser Vertrag
- Jeder transiente Ausgang trägt `wiederholbar:true` + `grund`; der Aufrufer plant Backoff/Retry und Caching selbst.
- FON-Ratenlimit (max 2 Abfragen/Tag/Erwerber-UID) wird **nicht** intern gezählt (zustandslos), aber `1513`/`1514` klar als `ratenlimit` gemeldet → Aufrufer weicht auf VIES aus oder wartet.
- `cacheKey(uid)` liefert einen stabilen Schlüssel; der Aufrufer cacht nur `gueltig`/`ungueltig`, **nie** `keine_antwort`.

### Tests
- **VIES:** gegen die Test-Sandbox/`checkVatTestService` bzw. injizierten `fetchImpl` mit den deterministischen Antworten (100=gültig, 200=ungültig, 201/202=INVALID_INPUT, 300–400=Fault-Klassen) — je Ausgang ein Test.
- **FON-UID:** injizierter Transport mit Fixtures je Returncode (0/1/4/12/1511/1513/-2 …); optional live gegen FON-TEST (gated auf Env, wie bei rksv).
- Normalisierung/Ländercode-Split, `keine_antwort`-Klassifizierung, `bestaetige`-Matches + Konsultationsnummer.

---

## Paket `@kreiseck/finanzonline` (jetzt minimal: DataBox)

### Factory
```ts
createDatabox(session: Session, opts?: { transport?: TransportOptions }): Databox

interface Databox {
  liste(args?: { erltyp?: string; von?: Date; bis?: Date }): Promise<DataboxEintrag[]>;
  eintrag(applkey: string): Promise<{ fileart: 'XML'|'PDF'; inhalt: Buffer }>; // Base64 dekodiert
}
```
- `liste` → `getDatabox` (`/fon/ws/databox`, Namespace `…/fon/ws/databox`) via core; `erltyp` leer = alle ungelesenen; mit `von`/`bis` = gelesen+ungelesen (Fenster: `von` max 31 Tage zurück, max 7 Tage Spanne → sonst rc `-5`/`-6`).
- `DataboxEintrag`: `stnr?, name, anbringen, zrvon, zrbis, datbesch, erltyp, fileart, tsZust, applkey, filebez, gelesen(status==='1'), betreff?`.
- `eintrag` → `getDataboxEntry`; `result` ist Base64 → dekodieren; **Abruf markiert als gelesen** (im Doc/JSDoc warnen).
- Returncodes `0/-1/-2/-3/-4/-5/-6` gemappt; technische Fehler kommen als SOAP-Fault (core wirft).
- **Für den UID-Bescheid:** `liste` nach dem passenden `anbringen` (UID-Bestätigung) filtern, `eintrag(applkey)` → PDF. Der genaue `anbringen`-Code der UID-Bestätigung ist [offen] (unten).

### Tests
- Fixtures für `getDatabox`-Liste (mehrere Einträge, XML+PDF) + `getDataboxEntry` (Base64 → Buffer); Returncode-/Fenster-Fehler (`-5`/`-6`); „als gelesen"-Semantik dokumentiert.

---

## Offene Verifikationspunkte (kein Raten — vor/bei Umsetzung klären)
1. **VIES REST-POST** exakte optionale Feldnamen (`trader*`, `requester*`) + reales `requestIdentifier`-Format → per Live-POST bestätigen (Sandbox/echt).
2. **UID Stufe 2 „MS gibt Name/Adresse nicht frei"** → strukturell `rc=0`+leere `name`/`adrz*`; live gegenprüfen (DE).
3. **`anbringen`-Code der UID-Bestätigung** in der DataBox → live/Handbuch bestätigen (für den Filter).
4. **VIES `availability`-Stringwerte** über `"Available"` hinaus (`Unavailable`/`Monitored`?) → live beobachten.
5. FON-UID `soap:address`/Envelope-Feinheiten → aus `uidAbfrageService.wsdl` (bereits verifiziert) beim Bau übernehmen.

## Reihenfolge der Umsetzung
1. `@kreiseck/uid` VIES-Teil (`pruefe`/`bestaetige`/`viesStatus`, Ergebnismodell, Ausgang-Mapping, Tests gegen Sandbox) — läuft ohne Session.
2. `@kreiseck/uid` FON-Teil (`fon.abfrage`, Returncode-Mapping, Fixtures).
3. `@kreiseck/finanzonline` DataBox (`liste`/`eintrag`, Fixtures).
4. Integration: UID-Bescheid über DataBox abholen (Beispiel/Doku), offene Punkte live verifizieren.
