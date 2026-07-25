# @kreiseck/elda API-Ergonomie (v0.2) Implementation Plan

> **Umsetzung:** Task für Task, test-first. Jeder Task beginnt mit einem
> fehlschlagenden Test und endet mit grüner Suite und einem Commit. Schritte sind
> als Checkbox (`- [ ]`) geführt.

**Goal:** Das öffentliche API von `@kreiseck/elda` so umbauen, dass ein fachlicher
Fehler nicht übersehen werden kann, erwartete Zustände aber Werte bleiben — ohne
dass Information von ELDA verloren geht.

**Architecture:** Die heutige `transfer.ts` wandert unverändert nach
`transfer-roh.ts` und behält ihr Verhalten (Ergebnisobjekte mit `ok`, wirft nie
bei fachlichen Codes). Darüber liegt eine dünne Komfortschicht in `transfer.ts`,
die pro Methode eine Status-Code-Karte anwendet: bekannte Codes werden zu einem
`zustand`, alle anderen werfen `EldaStatusError` mit dem vollständigen rohen
Ergebnis. Die Karten stehen gesammelt in `klassifikation.ts`. Die
Konfigurationsprüfung zieht in `konfiguration.ts`.

**Tech Stack:** Node ≥20.18, TypeScript (CJS via `tsc`), `node:test`,
`@kreiseck/finanzonline-core`.

**Spec:** `docs/superpowers/specs/2026-07-25-elda-api-ergonomie-design.md`

## Global Constraints

- **Keine neuen Laufzeitabhängigkeiten.** Weiterhin ausschließlich
  `@kreiseck/finanzonline-core`.
- **Kein Informationsverlust:** Jeder geworfene `EldaStatusError` trägt
  `statusCode`, `meldung` und das vollständige rohe Ergebnisobjekt.
- **Kein bestehender Test wird abgeschwächt oder gelöscht**, um eine Änderung
  grün zu bekommen. Wo ein Test altes, bewusst geändertes Verhalten festhält,
  wird er absichtlich angepasst und die Anpassung im Commit begründet.
- Doku, Kommentare und Commit-Nachrichten auf Deutsch, im Stil der
  Nachbarpakete (`packages/finanzonline-core`, `packages/uid`, `packages/rksv`).
- **Keine Hinweise auf Werkzeuge, KI oder Assistenten** in Code, Kommentaren,
  Doku, Dateinamen oder Commit-Nachrichten. Keine `Co-Authored-By`-Trailer.
- Breaking Changes sind erlaubt — das Paket ist unveröffentlicht.
- Alle Kommandos ab Repo-Root. Node 22 voranstellen:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`
- Testkommando: `npm test -w @kreiseck/elda`. Vor jedem Commit zusätzlich
  `npm run format:check` und `npx eslint packages/elda/src`.

## Dateistruktur nach Abschluss

| Datei | Verantwortung |
|---|---|
| `src/endpoints.ts` | unverändert — Endpoints + Namespace |
| `src/status.ts` | unverändert — Status-Code-Tabelle |
| `src/security.ts` | unverändert — securityParameters |
| `src/envelope.ts` | unverändert — SOAP-Envelope |
| `src/errors.ts` | **erweitert** — `EldaError`, `EldaProtocolError`, `EldaStatusError` |
| `src/klassifikation.ts` | **neu** — Status-Code → Zustand je Methode, an genau einer Stelle |
| `src/konfiguration.ts` | **neu** — `EldaConfig` + Prüfung + Endpoint-Auflösung |
| `src/zuordnung.ts` | **umbenannt** — `zuordnung` → `findeRuecksendung` |
| `src/transfer-roh.ts` | **neu (verschoben)** — heutige `transfer.ts`, Faktory `createEldaTransferRoh` |
| `src/transfer.ts` | **neu (Inhalt)** — Komfortschicht + `.roh` |
| `src/index.ts` | **geschrumpft** — nur noch die Betriebs-API |

---

### Task 1: Klassifikation + EldaStatusError

**Files:**
- Create: `packages/elda/src/klassifikation.ts`
- Create: `packages/elda/src/klassifikation.test.ts`
- Modify: `packages/elda/src/errors.ts`
- Create: `packages/elda/src/errors.test.ts`

**Interfaces:**
- Consumes: `ELDA_STATUS` aus `./status`, `EldaError` aus `./errors`.
- Produces:
  - `class EldaStatusError extends EldaError` mit `statusCode: string`,
    `meldung?: string`, `ergebnis: unknown`
  - `SENDEN_ZUSTAENDE`, `EMPFANGEN_ZUSTAENDE`, `AUFLISTEN_ZUSTAENDE`
  - `function zustandOderWurf<T extends string>(karte, ergebnis): T`

- [ ] **Step 1: Failing test für EldaStatusError**

`packages/elda/src/errors.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EldaError, EldaProtocolError, EldaStatusError } from './errors';

test('EldaStatusError trägt Code, Meldung und das vollständige Ergebnis', () => {
  const ergebnis = { statusCode: '405', ok: false, meldung: 'Original 155764331', protokollnummer: '9' };
  const err = new EldaStatusError('405', ergebnis, 'Original 155764331');
  assert.ok(err instanceof EldaError);
  assert.equal(err.name, 'EldaStatusError');
  assert.equal(err.statusCode, '405');
  assert.equal(err.meldung, 'Original 155764331');
  assert.equal(err.ergebnis, ergebnis);
  assert.match(err.message, /405/);
  assert.match(err.message, /Duplikat/); // Klartext aus ELDA_STATUS
  assert.match(err.message, /Original 155764331/); // ELDA-Meldung
});

test('EldaStatusError bleibt bei unbekanntem Code aussagekräftig', () => {
  const err = new EldaStatusError('999', { statusCode: '999' });
  assert.match(err.message, /999/);
  assert.equal(err.meldung, undefined);
});

test('EldaProtocolError bleibt unverändert eine EldaError', () => {
  assert.ok(new EldaProtocolError('x') instanceof EldaError);
});
```

- [ ] **Step 2: Failing test für die Klassifikation**

`packages/elda/src/klassifikation.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELDA_STATUS } from './status';
import {
  SENDEN_ZUSTAENDE,
  EMPFANGEN_ZUSTAENDE,
  AUFLISTEN_ZUSTAENDE,
  zustandOderWurf,
} from './klassifikation';
import { EldaStatusError } from './errors';

test('senden: 000/404/405 sind Zustände, alles andere wirft', () => {
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '000' }), 'angenommen');
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '404' }), 'nochInArbeit');
  assert.equal(zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: '405' }), 'duplikat');
  for (const code of ['500', '551', '552', '553', '554', '555', '557', '558', '559', '401', '402', '403', '406', '407', '408']) {
    assert.throws(() => zustandOderWurf(SENDEN_ZUSTAENDE, { statusCode: code }), EldaStatusError, `sollte werfen: ${code}`);
  }
});

test('empfangen: 000/404/406/408 sind Zustände, alles andere wirft', () => {
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '000' }), 'datei');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '404' }), 'nochInArbeit');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '406' }), 'nichtVorhanden');
  assert.equal(zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: '408' }), 'bereitsEmpfangen');
  for (const code of ['500', '551', '552', '553', '554', '555', '557', '558', '559', '401', '402', '403', '405', '407']) {
    assert.throws(() => zustandOderWurf(EMPFANGEN_ZUSTAENDE, { statusCode: code }), EldaStatusError, `sollte werfen: ${code}`);
  }
});

test('auflisten: nur 000 ist ein Zustand', () => {
  assert.equal(zustandOderWurf(AUFLISTEN_ZUSTAENDE, { statusCode: '000' }), 'liste');
  for (const code of Object.keys(ELDA_STATUS).filter((c) => c !== '000')) {
    assert.throws(() => zustandOderWurf(AUFLISTEN_ZUSTAENDE, { statusCode: code }), EldaStatusError, `sollte werfen: ${code}`);
  }
});

test('unbekannter Code wirft überall (sichere Vorgabe)', () => {
  for (const karte of [SENDEN_ZUSTAENDE, EMPFANGEN_ZUSTAENDE, AUFLISTEN_ZUSTAENDE]) {
    assert.throws(() => zustandOderWurf(karte, { statusCode: '999' }), EldaStatusError);
  }
});

test('der Wurf trägt Meldung und Ergebnis weiter', () => {
  const ergebnis = { statusCode: '558', ok: false, meldung: 'Passwort falsch' };
  try {
    zustandOderWurf(SENDEN_ZUSTAENDE, ergebnis);
    assert.fail('hätte werfen müssen');
  } catch (err) {
    assert.ok(err instanceof EldaStatusError);
    assert.equal(err.statusCode, '558');
    assert.equal(err.meldung, 'Passwort falsch');
    assert.equal(err.ergebnis, ergebnis);
  }
});

test('jeder Code der Tabelle ist je Methode entweder Zustand oder Wurf', () => {
  // Vollständigkeitsprobe: keine Lücke, kein Code ohne definiertes Verhalten.
  for (const code of Object.keys(ELDA_STATUS)) {
    for (const karte of [SENDEN_ZUSTAENDE, EMPFANGEN_ZUSTAENDE, AUFLISTEN_ZUSTAENDE]) {
      const inKarte = Object.prototype.hasOwnProperty.call(karte, code);
      if (inKarte) {
        assert.equal(typeof zustandOderWurf(karte, { statusCode: code }), 'string');
      } else {
        assert.throws(() => zustandOderWurf(karte, { statusCode: code }), EldaStatusError);
      }
    }
  }
});
```

- [ ] **Step 3: Run → FAIL**

Run: `npm test -w @kreiseck/elda`
Expected: FAIL — `klassifikation` nicht auffindbar, `EldaStatusError` nicht exportiert.

- [ ] **Step 4: EldaStatusError implementieren**

An `packages/elda/src/errors.ts` anhängen (Datei beginnt mit einem Import,
`EldaError` und `EldaProtocolError` bleiben unverändert):

```ts
import { ELDA_STATUS } from './status';
```

```ts
/**
 * ELDA hat einen Status-Code gemeldet, der keinen behandelbaren Zustand
 * beschreibt — falsche Zugangsdaten, abgelaufener Request, ungültiger Dateiname,
 * interner Fehler. Solche Codes an der Aufrufstelle zu übersehen ist immer ein
 * Fehler, deshalb werden sie geworfen statt zurückgegeben.
 *
 * Es geht dabei nichts verloren: `statusCode`, die Klartext-`meldung` von ELDA
 * und das vollständige rohe `ergebnis` hängen am Fehler.
 */
export class EldaStatusError extends EldaError {
  /** ELDA-Status-Code, z. B. `'558'`. */
  readonly statusCode: string;
  /** Klartext-Meldung aus `serviceResult.messages`, sofern ELDA eine geliefert hat. */
  readonly meldung?: string;
  /** Das vollständige rohe Ergebnisobjekt, wie `elda.roh.*` es zurückgegeben hätte. */
  readonly ergebnis: unknown;

  constructor(statusCode: string, ergebnis: unknown, meldung?: string, options?: ErrorOptions) {
    const beschreibung = ELDA_STATUS[statusCode] ?? 'unbekannter Status-Code';
    super(`ELDA-Status ${statusCode}: ${beschreibung}${meldung ? ` — ${meldung}` : ''}`, options);
    this.statusCode = statusCode;
    this.ergebnis = ergebnis;
    if (meldung !== undefined) this.meldung = meldung;
  }
}
```

- [ ] **Step 5: klassifikation.ts implementieren**

`packages/elda/src/klassifikation.ts`:
```ts
import { EldaStatusError } from './errors';

/**
 * Die Status-Codes des Transfer-Webservice zerfallen in zwei Klassen: Zustände,
 * die ein Aufrufer sinnvoll behandeln kann, und Ausnahmen, bei denen der Aufruf
 * schlicht kaputt ist. Diese Datei ist die einzige Stelle, an der diese
 * Unterscheidung getroffen wird.
 *
 * Ein Code, der in der Karte einer Methode fehlt, wird geworfen — auch wenn er
 * bei einer anderen Methode ein Zustand ist (`405` ergibt beim Empfangen keinen
 * Sinn) und auch wenn ELDA die Tabelle künftig erweitert. Werfen ist die sichere
 * Vorgabe.
 */

/** Ausgänge von `senden`: die Datei liegt in allen drei Fällen bei ELDA. */
export const SENDEN_ZUSTAENDE = {
  '000': 'angenommen',
  '404': 'nochInArbeit',
  '405': 'duplikat',
} as const satisfies Readonly<Record<string, string>>;

/** Ausgänge von `empfangen`. */
export const EMPFANGEN_ZUSTAENDE = {
  '000': 'datei',
  '404': 'nochInArbeit',
  '406': 'nichtVorhanden',
  '408': 'bereitsEmpfangen',
} as const satisfies Readonly<Record<string, string>>;

/** Ausgänge von `ruecksendungenAuflisten`: nur der Erfolgsfall ist behandelbar. */
export const AUFLISTEN_ZUSTAENDE = {
  '000': 'liste',
} as const satisfies Readonly<Record<string, string>>;

/**
 * Übersetzt den Status-Code eines rohen Ergebnisses in den Zustand der jeweiligen
 * Methode. Ist der Code dort nicht vorgesehen, wirft die Funktion einen
 * {@link EldaStatusError}, der Code, Meldung und das rohe Ergebnis mitführt.
 */
export function zustandOderWurf<T extends string>(
  karte: Readonly<Record<string, T>>,
  ergebnis: { statusCode: string; meldung?: string },
): T {
  const zustand = karte[ergebnis.statusCode];
  if (zustand === undefined) {
    throw new EldaStatusError(ergebnis.statusCode, ergebnis, ergebnis.meldung);
  }
  return zustand;
}
```

- [ ] **Step 6: Run → PASS**

Run: `npm test -w @kreiseck/elda`
Expected: alle bisherigen Tests plus die neuen bestehen.

- [ ] **Step 7: Prüfen und committen**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/errors.ts packages/elda/src/errors.test.ts packages/elda/src/klassifikation.ts packages/elda/src/klassifikation.test.ts
git commit -m "feat(elda): Status-Klassifikation und EldaStatusError"
```

---

### Task 2: Konfiguration prüfen, umgebung zur Pflicht

**Files:**
- Create: `packages/elda/src/konfiguration.ts`
- Create: `packages/elda/src/konfiguration.test.ts`

**Interfaces:**
- Consumes: `ELDA_ENDPOINTS`/`EldaUmgebung` aus `./endpoints`, `SecurityQuelle`
  aus `./security`, `EldaError` aus `./errors`, `TransportOptions` aus
  `@kreiseck/finanzonline-core`.
- Produces: `type EldaConfig`, `function loeseEndpoint(config: EldaConfig): string`.
  `EldaConfig` ersetzt ab Task 4 die gleichnamige Definition in der Transfer-Datei.

- [ ] **Step 1: Failing test**

`packages/elda/src/konfiguration.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loeseEndpoint } from './konfiguration';
import { ELDA_ENDPOINTS } from './endpoints';
import { EldaError } from './errors';

const zugang = { seriennummer: 'S1', kundenpasswort: 'p', apiKey: 'K1' };

test('umgebung bestimmt den Endpoint', () => {
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'produktion' }), ELDA_ENDPOINTS.produktion);
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'kundentest' }), ELDA_ENDPOINTS.kundentest);
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'sit' }), ELDA_ENDPOINTS.sit);
});

test('expliziter endpoint hat Vorrang und macht umgebung entbehrlich', () => {
  assert.equal(loeseEndpoint({ ...zugang, endpoint: 'https://mock.test/svc' }), 'https://mock.test/svc');
  assert.equal(
    loeseEndpoint({ ...zugang, umgebung: 'produktion', endpoint: 'https://mock.test/svc' }),
    'https://mock.test/svc',
  );
});

test('fehlende umgebung wirft und nennt die gültigen Werte', () => {
  assert.throws(
    () => loeseEndpoint({ ...zugang } as never),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /umgebung/);
      assert.match((err as Error).message, /produktion/);
      assert.match((err as Error).message, /kundentest/);
      assert.match((err as Error).message, /sit/);
      return true;
    },
  );
});

test('unbekannte umgebung wirft (Aufruf aus JavaScript, kein Compiler)', () => {
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: 'Kundentest' } as never), EldaError);
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: '' } as never), EldaError);
});

test('leere oder fehlende Zugangsdaten werfen beim Bauen, nicht erst bei ELDA', () => {
  for (const feld of ['seriennummer', 'kundenpasswort', 'apiKey']) {
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: '', umgebung: 'kundentest' } as never),
      (err: unknown) => {
        assert.ok(err instanceof EldaError);
        assert.match((err as Error).message, new RegExp(feld));
        return true;
      },
      `leeres Feld muss werfen: ${feld}`,
    );
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: '   ', umgebung: 'kundentest' } as never),
      EldaError,
      `Feld nur aus Leerzeichen muss werfen: ${feld}`,
    );
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: undefined, umgebung: 'kundentest' } as never),
      EldaError,
      `fehlendes Feld muss werfen: ${feld}`,
    );
  }
});

test('leerer endpoint wirft statt still auf umgebung zurückzufallen', () => {
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: 'kundentest', endpoint: '' } as never), EldaError);
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -w @kreiseck/elda`
Expected: FAIL — `./konfiguration` existiert nicht.

- [ ] **Step 3: Implementieren**

`packages/elda/src/konfiguration.ts`:
```ts
import type { TransportOptions } from '@kreiseck/finanzonline-core';
import { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
import { EldaError } from './errors';
import type { SecurityQuelle } from './security';

/** Gemeinsame Felder jeder Konfiguration. */
interface EldaBasisConfig extends SecurityQuelle {
  /**
   * Transport-Feineinstellungen (Timeout, Retries, `fetch`-Implementierung) —
   * siehe `TransportOptions` aus `@kreiseck/finanzonline-core`.
   *
   * `retries` ist die Anzahl ZUSÄTZLICHER Versuche nach einem Transportfehler
   * (Standard `0`). Dieser Client wiederholt selbst und baut dabei für jeden
   * Versuch frische `securityParameters` (neuer `nonce`, neues `created`): ELDA
   * lehnt einen wiederholten `nonce` mit `552` ab und ein `created` älter als
   * 60 Sekunden mit `551`. Wiederholt wird ausschließlich bei Transportfehlern.
   * Ein ungültiger Wert (`NaN`, negativ, gebrochen, `Infinity`) gilt als `0`.
   */
  transport?: TransportOptions;
}

/**
 * Konfiguration des ELDA-Clients. Entweder `umgebung` oder `endpoint` muss
 * gesetzt sein — `umgebung` hat bewusst KEINEN Default: ein vergessenes Feld
 * darf keine echten Meldungen in den Echtbetrieb schicken.
 */
export type EldaConfig = EldaBasisConfig &
  (
    | {
        /** Betriebsumgebung, bestimmt den Endpoint aus `ELDA_ENDPOINTS`. */
        umgebung: EldaUmgebung;
        /** Expliziter Endpoint-Override — hat Vorrang vor `umgebung`. */
        endpoint?: string;
      }
    | {
        umgebung?: EldaUmgebung;
        /** Expliziter Endpoint; ohne `umgebung` zulässig (Mock, Proxy). */
        endpoint: string;
      }
  );

const UMGEBUNGEN = Object.keys(ELDA_ENDPOINTS) as EldaUmgebung[];

function pflichtfeld(wert: unknown, name: string): string {
  if (typeof wert !== 'string' || wert.trim() === '') {
    throw new EldaError(
      `'${name}' fehlt oder ist leer. Die ELDA-Zugangsdaten müssen vollständig sein — ` +
        'ohne sie beantwortet ELDA jeden Aufruf mit Status 558.',
    );
  }
  return wert;
}

/**
 * Prüft die Konfiguration und liefert den Endpoint. Die Prüfung läuft zur
 * Laufzeit, weil Aufrufer aus reinem JavaScript keinen Compiler haben: ohne sie
 * würde ein Tippfehler in `umgebung` zu `undefined` als Endpoint und damit zu
 * einem kryptischen Netzwerkfehler führen.
 */
export function loeseEndpoint(config: EldaConfig): string {
  pflichtfeld(config.seriennummer, 'seriennummer');
  pflichtfeld(config.kundenpasswort, 'kundenpasswort');
  pflichtfeld(config.apiKey, 'apiKey');

  if (config.endpoint !== undefined) {
    return pflichtfeld(config.endpoint, 'endpoint');
  }

  const umgebung = config.umgebung;
  if (umgebung === undefined || !UMGEBUNGEN.includes(umgebung)) {
    throw new EldaError(
      `'umgebung' ist ${umgebung === undefined ? 'nicht gesetzt' : `'${String(umgebung)}'`}. ` +
        `Erlaubt sind ${UMGEBUNGEN.map((u) => `'${u}'`).join(', ')} — oder ein expliziter 'endpoint'.`,
    );
  }
  return ELDA_ENDPOINTS[umgebung];
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 5: Prüfen und committen**

```bash
npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/konfiguration.ts packages/elda/src/konfiguration.test.ts
git commit -m "feat(elda): Konfigurationspruefung, umgebung ohne Default"
```

---

### Task 3: zuordnung → findeRuecksendung

**Files:**
- Modify: `packages/elda/src/zuordnung.ts`
- Modify: `packages/elda/src/zuordnung.test.ts`

**Interfaces:**
- Produces: `findeRuecksendung(sendungsProtokollnummer: string, ruecksendungen: Ruecksendung[]): Ruecksendung | undefined`.
  `Ruecksendung` bleibt unverändert. Der alte Name `zuordnung` entfällt ersatzlos.

- [ ] **Step 1: Test umbenennen**

In `packages/elda/src/zuordnung.test.ts` den Import und alle Aufrufe von
`zuordnung` auf `findeRuecksendung` ändern. Die Testnamen sinngemäß mitziehen
(z. B. „findeRuecksendung: …"). Es wird **kein** Test entfernt und keine
Zusicherung geändert — nur der Bezeichner.

- [ ] **Step 2: Run → FAIL**

Run: `npm test -w @kreiseck/elda`
Expected: FAIL — `findeRuecksendung` wird nicht exportiert.

- [ ] **Step 3: Umbenennen**

In `packages/elda/src/zuordnung.ts` die Funktion `zuordnung` in
`findeRuecksendung` umbenennen. Verhalten, Signatur und JSDoc-Inhalt bleiben
gleich; der JSDoc-Satz wird an den Namen angepasst (Verb statt Substantiv).
Kontrollieren, dass kein weiterer Verweis übrig ist:

```bash
grep -rn "zuordnung" packages/elda/src packages/elda/README.md
```
Erwartet: nur noch Treffer auf den Dateinamen `zuordnung.ts` — der Dateiname
bleibt, weil er das Thema benennt, nicht die Funktion. Treffer in `index.ts`
und `README.md` bleiben zunächst rot; sie werden in Task 6 mitgezogen. Falls
`index.ts` durch die Umbenennung nicht mehr baut, in diesem Task minimal
nachziehen (`export { findeRuecksendung, … }`).

- [ ] **Step 4: Run → PASS**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 5: Prüfen und committen**

```bash
npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/zuordnung.ts packages/elda/src/zuordnung.test.ts packages/elda/src/index.ts
git commit -m "refactor(elda): zuordnung heisst findeRuecksendung"
```

---

### Task 4: Transfer-Schicht nach transfer-roh.ts verschieben

**Files:**
- Create: `packages/elda/src/transfer-roh.ts` (Inhalt aus heutiger `transfer.ts`)
- Create: `packages/elda/src/transfer-roh.test.ts` (Inhalt aus heutiger `transfer.test.ts`)
- Delete: `packages/elda/src/transfer.ts`, `packages/elda/src/transfer.test.ts`
- Modify: `packages/elda/src/index.ts` (nur so weit, dass der Build steht)

**Interfaces:**
- Consumes: `EldaConfig`/`loeseEndpoint` aus `./konfiguration` (Task 2).
- Produces:
  - `createEldaTransferRoh(config: EldaConfig): EldaTransferRoh`
  - `interface EldaTransferRoh` mit `senden`, `ruecksendungenAuflisten`, `empfangen`
  - `interface EldaDatei { inhalt: Buffer; id?: string; name?: string; dateiTyp?: number; md5?: string }`
  - `SendenErgebnis`, `AuflistenErgebnis`, `EmpfangenErgebnis` (unverändert in
    Form und Verhalten, `EmpfangenErgebnis.datei?: EldaDatei`)

Dies ist ein **reiner Umzug ohne Verhaltensänderung**, mit drei Ausnahmen, die
unten einzeln benannt sind. Ziel ist, dass die Komfortschicht in Task 5 auf einer
stabilen, unveränderten Grundlage aufsetzt.

- [ ] **Step 1: Dateien verschieben**

```bash
git mv packages/elda/src/transfer.ts packages/elda/src/transfer-roh.ts
git mv packages/elda/src/transfer.test.ts packages/elda/src/transfer-roh.test.ts
```

- [ ] **Step 2: In `transfer-roh.ts` umbenennen und Konfiguration anschließen**

Drei Änderungen, sonst nichts:

1. `export function createEldaTransfer` → `export function createEldaTransferRoh`,
   `export interface EldaTransfer` → `export interface EldaTransferRoh`. JSDoc
   ergänzen: „Rohe Variante — gibt Ergebnisobjekte zurück und wirft bei
   fachlichen Status-Codes nie. Der komfortable Einstieg ist
   `createEldaTransfer` aus `./transfer`."
2. Die lokale `EldaConfig`-Definition (heute im Kopf der Datei) entfernen und
   stattdessen importieren; die Endpoint-Auflösung über die Prüfung führen:

```ts
import { loeseEndpoint, type EldaConfig } from './konfiguration';
export type { EldaConfig };
```
   und in der Faktory die Zeile
   `const endpoint = config.endpoint ?? ELDA_ENDPOINTS[config.umgebung ?? 'produktion'];`
   ersetzen durch
```ts
const endpoint = loeseEndpoint(config);
```
   Den dadurch unbenutzten Import von `ELDA_ENDPOINTS` entfernen (`EldaUmgebung`
   wird ebenfalls nicht mehr gebraucht).
3. Den inline notierten Datei-Typ in `EmpfangenErgebnis` als eigenen Typ
   herausziehen, damit Task 5 ihn wiederverwenden kann statt die Form zu
   verdoppeln:

```ts
/** Eine von ELDA abgeholte Rücksendungsdatei. */
export interface EldaDatei {
  /** Interne ELDA-Datei-ID. */
  id?: string;
  /** Dateiname der Rücksendung, wie von ELDA vergeben. */
  name?: string;
  /** Dateiinhalt, aus dem inline übermittelten Base64 dekodiert. */
  inhalt: Buffer;
  /** Numerischer Dateityp laut ELDA. Nur gesetzt, wenn ELDA einen gültigen numerischen Wert liefert. */
  dateiTyp?: number;
  /** MD5-Prüfsumme des Dateiinhalts, wie von ELDA übermittelt. */
  md5?: string;
}
```
   In `EmpfangenErgebnis` wird daraus `datei?: EldaDatei;` (JSDoc der Eigenschaft
   bleibt). Die Stelle im Rumpf, die heute
   `const d: EmpfangenErgebnis['datei'] = { … }` schreibt, wird zu
   `const d: EldaDatei = { … }`.

- [ ] **Step 3: `transfer-roh.test.ts` anpassen**

1. Import und alle Aufrufe: `createEldaTransfer` → `createEldaTransferRoh`.
2. Jede Testkonfiguration bekommt eine explizite `umgebung`. Die bestehende
   Hilfsfunktion `cfg(...)` setzt bereits `umgebung: 'kundentest'` — Tests, die
   ohne sie ein eigenes Konfigurationsobjekt bauen, ebenfalls versorgen.
3. **Bewusste Teständerung:** Der Test, der den Default `'produktion'` bei
   fehlender `umgebung` festhält, prüft ab jetzt, dass `umgebung: 'produktion'`
   den Produktions-Endpoint liefert. Der Default ist laut Spec ersatzlos
   entfallen; das Verhalten „fehlende umgebung wirft" ist in Task 2 abgedeckt.
   Diese Änderung im Commit-Text benennen.

- [ ] **Step 4: `index.ts` bauen lassen**

`packages/elda/src/index.ts` so weit nachziehen, dass der Build steht — der
endgültige Schnitt kommt in Task 6:

```ts
export {
  createEldaTransferRoh,
  type EldaTransferRoh,
  type EldaDatei,
  type EldaConfig,
  type SendenErgebnis,
  type EmpfangenErgebnis,
  type AuflistenErgebnis,
} from './transfer-roh';
```
Den bisherigen `./transfer`-Export-Block ersetzen. `index.test.ts` entsprechend
auf `createEldaTransferRoh` umstellen — auch das ist in Task 6 nochmal Thema.

- [ ] **Step 5: Run → PASS**

Run: `npm test -w @kreiseck/elda`
Expected: dieselbe Anzahl Tests wie vorher, alle grün. Es ist ein Umzug — sinkt
die Testanzahl, ist versehentlich etwas verloren gegangen.

- [ ] **Step 6: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add -A packages/elda/src
git commit -m "refactor(elda): Transfer-Schicht nach transfer-roh.ts, Konfigurationspruefung angeschlossen"
```

---

### Task 5: Komfortschicht

**Files:**
- Create: `packages/elda/src/transfer.ts`
- Create: `packages/elda/src/transfer.test.ts`

**Interfaces:**
- Consumes: `createEldaTransferRoh`/`EldaTransferRoh`/`EldaDatei` aus
  `./transfer-roh`, `EldaConfig` aus `./konfiguration`, die drei Karten und
  `zustandOderWurf` aus `./klassifikation`, `EldaProtocolError` aus `./errors`,
  `Ruecksendung` aus `./zuordnung`.
- Produces: `createEldaTransfer(config: EldaConfig): EldaTransfer` samt
  `EldaTransfer`, `Gesendet`, `Empfangen`.

- [ ] **Step 1: Failing test**

`packages/elda/src/transfer.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEldaTransfer } from './transfer';
import { EldaStatusError, EldaProtocolError } from './errors';

const cfg = (fetchImpl: unknown) => ({
  seriennummer: 'S1',
  kundenpasswort: 'p',
  apiKey: 'K1',
  umgebung: 'kundentest' as const,
  transport: { fetchImpl: fetchImpl as typeof fetch },
});

const soap = (inner: string) =>
  `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

const sendenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:sendenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:sendenResponse>`,
  );

const empfangenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:empfangenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:empfangenResponse>`,
  );

const auflistenAntwort = (statusCode: string, extra = '') =>
  soap(
    `<ns2:ruecksendungenAuflistenResponse xmlns:ns2="http://v4.transfer.ws.elda.at/"><return>` +
      `<serviceResult><messages>M-${statusCode}</messages><statusCode>${statusCode}</statusCode></serviceResult>` +
      `${extra}</return></ns2:ruecksendungenAuflistenResponse>`,
  );

const mitAntwort = (xml: string) => createEldaTransfer(cfg(async () => new Response(xml, { status: 200 })));

test('senden: 000 -> zustand angenommen, kein ok-Feld nötig', async () => {
  const elda = mitAntwort(
    sendenAntwort('000', '<protokollnummer>155764331</protokollnummer><dateiId>199565708</dateiId><eldaZeitstempel>2026-07-25T07:00:00.000+02:00</eldaZeitstempel>'),
  );
  const erg = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'angenommen');
  assert.equal(erg.protokollnummer, '155764331');
  assert.equal(erg.dateiId, '199565708');
  assert.equal(erg.eldaZeitstempel, '2026-07-25T07:00:00.000+02:00');
  assert.equal(erg.statusCode, '000');
  assert.equal(erg.meldung, 'M-000');
});

test('senden: 405 ist ein Zustand, kein Fehler', async () => {
  const elda = mitAntwort(sendenAntwort('405', '<protokollnummer>155764331</protokollnummer>'));
  const erg = await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'duplikat');
  assert.equal(erg.protokollnummer, '155764331');
  assert.equal(erg.meldung, 'M-405');
});

test('senden: 404 ist ein Zustand (angenommen, Verarbeitung dauert an)', async () => {
  const erg = await mitAntwort(sendenAntwort('404')).senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.zustand, 'nochInArbeit');
});

test('senden: 558 wirft und trägt alles mit', async () => {
  const elda = mitAntwort(sendenAntwort('558'));
  await assert.rejects(
    () => elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaStatusError);
      assert.equal(err.statusCode, '558');
      assert.equal(err.meldung, 'M-558');
      assert.equal((err.ergebnis as { statusCode: string }).statusCode, '558');
      assert.equal((err.ergebnis as { ok: boolean }).ok, false);
      return true;
    },
  );
});

test('auflisten: 000 liefert die Liste direkt', async () => {
  const elda = mitAntwort(
    auflistenAntwort(
      '000',
      '<ruecksendungen><dateiName>fehler_155764331</dateiName><protokollnummer>155764332</protokollnummer></ruecksendungen>' +
        '<ruecksendungen><dateiName>ok_155764340</dateiName><protokollnummer>155764341</protokollnummer></ruecksendungen>',
    ),
  );
  const liste = await elda.ruecksendungenAuflisten();
  assert.equal(liste.length, 2);
  assert.equal(liste[0]?.protokollnummer, '155764332');
  assert.equal(liste[1]?.dateiName, 'ok_155764340');
});

test('auflisten: leere Liste bedeutet eindeutig "keine offen"', async () => {
  assert.deepEqual(await mitAntwort(auflistenAntwort('000')).ruecksendungenAuflisten(), []);
});

test('auflisten: 557 wirft, statt eine leere Liste vorzutäuschen', async () => {
  await assert.rejects(
    () => mitAntwort(auflistenAntwort('557')).ruecksendungenAuflisten(),
    (err: unknown) => {
      assert.ok(err instanceof EldaStatusError);
      assert.equal(err.statusCode, '557');
      return true;
    },
  );
});

test('empfangen: 000 liefert zustand datei mit Inhalt', async () => {
  const b64 = Buffer.from('<protokoll/>').toString('base64');
  const elda = mitAntwort(
    empfangenAntwort('000', `<datei><id>199565708</id><name>mitteilung.xml</name><dateiTyp>1</dateiTyp><md5>abc</md5><payload>${b64}</payload></datei>`),
  );
  const erg = await elda.empfangen('155764332');
  assert.equal(erg.zustand, 'datei');
  if (erg.zustand !== 'datei') return; // Verengung für TypeScript
  assert.equal(erg.datei.name, 'mitteilung.xml');
  assert.equal(erg.datei.dateiTyp, 1);
  assert.equal(erg.datei.md5, 'abc');
  assert.equal(erg.datei.inhalt.toString('utf8'), '<protokoll/>');
});

test('empfangen: 406 und 408 sind Zustände, kein Fehler', async () => {
  assert.equal((await mitAntwort(empfangenAntwort('406')).empfangen('1')).zustand, 'nichtVorhanden');
  assert.equal((await mitAntwort(empfangenAntwort('408')).empfangen('1')).zustand, 'bereitsEmpfangen');
  assert.equal((await mitAntwort(empfangenAntwort('404')).empfangen('1')).zustand, 'nochInArbeit');
});

test('empfangen: 407 wirft', async () => {
  await assert.rejects(() => mitAntwort(empfangenAntwort('407')).empfangen('1'), EldaStatusError);
});

test('empfangen: 000 ohne <datei> wirft, statt eine leere Datei vorzutäuschen', async () => {
  await assert.rejects(() => mitAntwort(empfangenAntwort('000')).empfangen('1'), EldaProtocolError);
});

test('roh: fachliche Codes werfen dort weiterhin nicht', async () => {
  const elda = mitAntwort(sendenAntwort('558'));
  const erg = await elda.roh.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(erg.ok, false);
  assert.equal(erg.statusCode, '558');
  assert.equal(erg.meldung, 'M-558');
});

test('roh: auflisten und empfangen bleiben ebenfalls wurffrei', async () => {
  const a = await mitAntwort(auflistenAntwort('557')).roh.ruecksendungenAuflisten();
  assert.equal(a.ok, false);
  assert.deepEqual(a.ruecksendungen, []);
  const e = await mitAntwort(empfangenAntwort('406')).roh.empfangen('1');
  assert.equal(e.ok, false);
  assert.equal(e.datei, undefined);
});

test('beide Wege benutzen denselben Transport (eine Konfiguration)', async () => {
  const ziele: string[] = [];
  const elda = createEldaTransfer(
    cfg(async (url: string) => {
      ziele.push(url);
      return new Response(sendenAntwort('000', '<protokollnummer>1</protokollnummer>'), { status: 200 });
    }),
  );
  await elda.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  await elda.roh.senden({ dateiName: 'm.xml', inhalt: '<x/>' });
  assert.equal(ziele.length, 2);
  assert.equal(ziele[0], ziele[1]);
  assert.equal(ziele[0], 'https://online-test.elda.at/eldaws/transfer/v4/TransferService');
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -w @kreiseck/elda`
Expected: FAIL — `./transfer` existiert nicht mehr (in Task 4 verschoben).

- [ ] **Step 3: Implementieren**

`packages/elda/src/transfer.ts`:
```ts
import {
  createEldaTransferRoh,
  type EldaDatei,
  type EldaTransferRoh,
} from './transfer-roh';
import type { EldaConfig } from './konfiguration';
import {
  AUFLISTEN_ZUSTAENDE,
  EMPFANGEN_ZUSTAENDE,
  SENDEN_ZUSTAENDE,
  zustandOderWurf,
} from './klassifikation';
import { EldaProtocolError } from './errors';
import type { Ruecksendung } from './zuordnung';

/**
 * Ergebnis von {@link EldaTransfer.senden}. Die Methode kehrt nur zurück, wenn
 * die Datei bei ELDA liegt — ein `ok`-Feld gibt es deshalb nicht.
 */
export interface Gesendet {
  /**
   * `'angenommen'` (Status 000), `'nochInArbeit'` (404 — angenommen, die
   * Verarbeitung dauert über 40 Sekunden) oder `'duplikat'` (405 — die Datei lag
   * ELDA bereits vor). Keiner der drei Fälle ist ein Fehler.
   */
  zustand: 'angenommen' | 'nochInArbeit' | 'duplikat';
  /**
   * Von ELDA vergebene Protokollnummer — der Schlüssel, mit dem später das
   * Verarbeitungsprotokoll abgeholt wird. Bei `'duplikat'` die der
   * Originalsendung, sofern ELDA sie im Feld mitliefert.
   */
  protokollnummer?: string;
  /** Interne ELDA-Datei-ID der übermittelten Sendung. */
  dateiId?: string;
  /** Zeitstempel (ISO-8601 mit Offset), zu dem ELDA die Datei angenommen hat. */
  eldaZeitstempel?: string;
  /** Klartext-Meldung von ELDA; bei `'duplikat'` nennt sie die Protokollnummer des Originals. */
  meldung?: string;
  /** Der Status-Code, der zu diesem Ergebnis geführt hat. */
  statusCode: string;
}

/** Ergebnis von {@link EldaTransfer.empfangen}. Über `zustand` verengbar. */
export type Empfangen =
  | { zustand: 'datei'; datei: EldaDatei; statusCode: string; meldung?: string }
  | { zustand: 'nichtVorhanden'; statusCode: string; meldung?: string }
  | { zustand: 'bereitsEmpfangen'; statusCode: string; meldung?: string }
  | { zustand: 'nochInArbeit'; statusCode: string; meldung?: string };

/**
 * ELDA-Transfer-Client. Fachliche Status-Codes, die ein Aufrufer sinnvoll
 * behandeln kann, kommen als `zustand` zurück; alle übrigen werfen einen
 * `EldaStatusError`, der Code, Meldung und das vollständige rohe Ergebnis
 * mitführt.
 */
export interface EldaTransfer {
  /**
   * Überträgt eine Datei (= eine Meldung) an ELDA. `inhalt` wird base64-kodiert.
   *
   * Rückkehr heißt: ELDA hat die Datei. Es heißt NICHT, dass sie fachlich in
   * Ordnung ist — die inhaltliche Rückmeldung kommt asynchron als Rücksendung
   * über {@link ruecksendungenAuflisten} und {@link empfangen}.
   */
  senden(args: { dateiName: string; inhalt: Buffer | string }): Promise<Gesendet>;
  /**
   * Listet die abholbereiten Rücksendungen (Verarbeitungsprotokolle). Ein leeres
   * Array heißt eindeutig „keine offen" — ein Zugangs- oder Serverfehler hätte
   * geworfen.
   */
  ruecksendungenAuflisten(): Promise<Ruecksendung[]>;
  /**
   * Holt EINE Rücksendung per Protokollnummer. **Einmalig und unwiderruflich** —
   * danach ist sie bei ELDA nicht mehr abrufbar. Den Inhalt dauerhaft sichern,
   * bevor weitergearbeitet wird.
   */
  empfangen(protokollnummer: string | number): Promise<Empfangen>;
  /**
   * Die rohe Variante: gibt Ergebnisobjekte mit `ok`/`statusCode`/`meldung`
   * zurück und wirft bei fachlichen Status-Codes nie. Für Aufrufer, die jede
   * Entscheidung selbst treffen wollen. Nutzt denselben Transport und dieselbe
   * Konfiguration.
   */
  readonly roh: EldaTransferRoh;
}

/**
 * Baut den ELDA-Transfer-Client. Zustandslos außer der übergebenen
 * Konfiguration; die Konfiguration wird beim Bauen geprüft.
 */
export function createEldaTransfer(config: EldaConfig): EldaTransfer {
  const roh = createEldaTransferRoh(config);

  return {
    roh,

    async senden(args): Promise<Gesendet> {
      const erg = await roh.senden(args);
      const gesendet: Gesendet = {
        zustand: zustandOderWurf(SENDEN_ZUSTAENDE, erg),
        statusCode: erg.statusCode,
      };
      if (erg.protokollnummer !== undefined) gesendet.protokollnummer = erg.protokollnummer;
      if (erg.dateiId !== undefined) gesendet.dateiId = erg.dateiId;
      if (erg.eldaZeitstempel !== undefined) gesendet.eldaZeitstempel = erg.eldaZeitstempel;
      if (erg.meldung !== undefined) gesendet.meldung = erg.meldung;
      return gesendet;
    },

    async ruecksendungenAuflisten(): Promise<Ruecksendung[]> {
      const erg = await roh.ruecksendungenAuflisten();
      zustandOderWurf(AUFLISTEN_ZUSTAENDE, erg);
      return erg.ruecksendungen;
    },

    async empfangen(protokollnummer): Promise<Empfangen> {
      const erg = await roh.empfangen(protokollnummer);
      const zustand = zustandOderWurf(EMPFANGEN_ZUSTAENDE, erg);
      if (zustand === 'datei') {
        if (!erg.datei) {
          throw new EldaProtocolError(
            "Antwort auf 'empfangen' meldet statusCode 000, enthält aber keine <datei>. " +
              'Die Rücksendung gilt bei ELDA damit als abgeholt, ohne dass Inhalt vorliegt — ' +
              'das wird nicht als leeres Ergebnis durchgereicht.',
          );
        }
        const treffer: Empfangen = { zustand, datei: erg.datei, statusCode: erg.statusCode };
        if (erg.meldung !== undefined) treffer.meldung = erg.meldung;
        return treffer;
      }
      const ohneDatei: Empfangen = { zustand, statusCode: erg.statusCode };
      if (erg.meldung !== undefined) ohneDatei.meldung = erg.meldung;
      return ohneDatei;
    },
  };
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 5: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src
git add packages/elda/src/transfer.ts packages/elda/src/transfer.test.ts
git commit -m "feat(elda): Komfortschicht mit Zustaenden, Wuerfen und roher Variante"
```

---

### Task 6: Barrel, README, CHANGELOG, Version

**Files:**
- Modify: `packages/elda/src/index.ts`
- Modify: `packages/elda/src/index.test.ts`
- Modify: `packages/elda/README.md`
- Modify: `packages/elda/package.json` (Version `0.1.0` → `0.2.0`)
- Modify: `CHANGELOG.md` (Repo-Root)

**Interfaces:**
- Produces: die endgültige öffentliche Oberfläche laut Spec.

- [ ] **Step 1: Failing test für die Oberfläche**

`packages/elda/src/index.test.ts` ersetzen:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as elda from './index';

test('index exportiert die Betriebs-API', () => {
  assert.equal(typeof elda.createEldaTransfer, 'function');
  assert.equal(typeof elda.createEldaTransferRoh, 'function');
  assert.equal(typeof elda.findeRuecksendung, 'function');
  assert.ok(elda.ELDA_ENDPOINTS.produktion);
  assert.ok(elda.ELDA_STATUS['000']);
});

test('index exportiert die Fehlerklassen mit intakter Kette', () => {
  assert.equal(typeof elda.EldaError, 'function');
  assert.ok(elda.EldaProtocolError.prototype instanceof elda.EldaError);
  assert.ok(elda.EldaStatusError.prototype instanceof elda.EldaError);
});

test('index exportiert kein Innenleben mehr', () => {
  for (const name of [
    'baueSecurity',
    'baueEldaEnvelope',
    'ELDA_NAMESPACE',
    'istOk',
    'zuordnung',
  ]) {
    assert.equal((elda as Record<string, unknown>)[name], undefined, `sollte intern sein: ${name}`);
  }
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 3: Barrel schneiden**

`packages/elda/src/index.ts`:
```ts
export { createEldaTransfer, type EldaTransfer, type Gesendet, type Empfangen } from './transfer';
export {
  createEldaTransferRoh,
  type EldaTransferRoh,
  type EldaDatei,
  type SendenErgebnis,
  type AuflistenErgebnis,
  type EmpfangenErgebnis,
} from './transfer-roh';
export { type EldaConfig } from './konfiguration';
export { ELDA_ENDPOINTS, type EldaUmgebung } from './endpoints';
export { ELDA_STATUS } from './status';
export { findeRuecksendung, type Ruecksendung } from './zuordnung';
export { EldaError, EldaProtocolError, EldaStatusError } from './errors';
```

`baueSecurity`, `SecurityFelder`, `SecurityQuelle`, `baueEldaEnvelope`,
`EldaFeld`, `ELDA_NAMESPACE` und `istOk` verlassen den Barrel. Die Module und
ihre Tests bleiben unverändert bestehen — sie werden weiter intern benutzt.

- [ ] **Step 4: README neu schreiben**

`packages/elda/README.md` überarbeiten. Die bestehende Struktur bleibt
(Kurzbeschreibung, Installation, Zugangsdaten, Beispiel, Status-Tabelle,
Fehlerbehandlung, MTOM-Hinweis, v2-Ausblick); der Code wird auf das neue API
gezogen. Inhaltlich MUSS die README enthalten:

- `umgebung` als Pflichtfeld (kein Produktions-Default mehr) und den Hinweis,
  dass leere Zugangsdaten beim Bauen scheitern.
- Das End-to-End-Beispiel unten.
- Die vollständige Status-Code-Tabelle wie bisher, ergänzt um eine Spalte oder
  Fußnote, welche Codes als `zustand` zurückkommen und welche werfen.
- Den Abschnitt „Fehler oder Zustand?" mit der Begründung: erwartete Zustände
  sind kein Kontrollfluss über Ausnahmen, unbehandelbare Codes darf man nicht
  übersehen.
- Einen Abschnitt „Volle Kontrolle: `elda.roh`" mit einem kurzen Beispiel.
- Den unveränderten Hinweis, dass `senden` mit `000` „von ELDA empfangen" heißt,
  nicht „fachlich verarbeitet".
- Den Hinweis, dass `empfangen` unwiderruflich ist und der Inhalt gesichert sein
  muss, bevor weitergearbeitet wird.
- Den MTOM/XOP-Hinweis mit beiden Fehlerarten (`FonProtocolError` bei echter
  multipart-Antwort, `EldaProtocolError` bei XOP-Referenz).
- Den Abschnitt „v2: Meldungs-Builder (Anmeldung/Abmeldung/mBGM) folgen nach
  SV-Datensatzbeschreibung".

Beispiel-Block:
```ts
import { createEldaTransfer, findeRuecksendung } from '@kreiseck/elda';

const elda = createEldaTransfer({
  seriennummer: 'DEINE_SERIENNUMMER',
  kundenpasswort: 'DEIN_KUNDENPASSWORT', // Klartext; wird intern SHA-512-gehasht
  apiKey: 'DEIN_API_KEY',                // bei ELDA anfordern
  umgebung: 'kundentest',                // Pflicht: 'produktion' | 'kundentest' | 'sit'
});

// 1) Meldung senden. Falsche Zugangsdaten oder ein ungültiger Dateiname werfen —
//    ein vergessener Statuscheck ist damit nicht mehr möglich.
const gesendet = await elda.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (gesendet.zustand === 'duplikat') {
  // ELDA hatte die Datei schon (z. B. Wiederholung nach Timeout) — kein Fehler.
}
const meineNr = gesendet.protokollnummer; // persistieren!

// 2) später: Warteschlange der Rücksendungen leeren
for (const rs of await elda.ruecksendungenAuflisten()) {
  const erg = await elda.empfangen(rs.protokollnummer); // einmalig, unwiderruflich
  if (erg.zustand === 'datei') {
    speichere(erg.datei.inhalt); // Buffer mit dem Protokoll-XML — erst sichern, dann parsen
  }
}

// 3) gezielt die Rücksendung zu einer eigenen Sendung suchen
const meine = findeRuecksendung(meineNr!, await elda.ruecksendungenAuflisten());
```

`elda.roh`-Block:
```ts
const erg = await elda.roh.senden({ dateiName: 'mbgm.xml', inhalt: meldungsXml });
if (!erg.ok) {
  // erg.statusCode, erg.meldung — nichts wird geworfen, alles selbst entscheiden
}
```

- [ ] **Step 5: Version und CHANGELOG**

`packages/elda/package.json`: `"version": "0.2.0"`.

In `CHANGELOG.md` einen Eintrag `### 0.2.0 — 2026-07-25` unter dem bestehenden
Abschnitt `## @kreiseck/elda` ergänzen, in der Konvention der Nachbarpakete. Er
muss die Bruchstellen benennen: `umgebung` ist Pflicht, `zuordnung` heißt
`findeRuecksendung`, `senden`/`empfangen` liefern `zustand` statt `ok`,
`ruecksendungenAuflisten` liefert die Liste direkt, nicht behandelbare
Status-Codes werfen `EldaStatusError`, das alte Verhalten steht unter
`elda.roh`, und der Barrel exportiert kein Innenleben mehr.

- [ ] **Step 6: README-Beispiele gegen die echten Exporte prüfen**

```bash
npm run build -w @kreiseck/elda
```
Danach jeden README-Schnipsel gegen `packages/elda/dist/index.d.ts` abgleichen:
Existieren alle benutzten Namen, stimmen Signaturen und Feldnamen? Ein
Schnipsel, der nicht kompilieren würde, ist ein Fehler.

- [ ] **Step 7: Run → PASS**

Run: `npm test -w @kreiseck/elda`

- [ ] **Step 8: Prüfen und committen**

```bash
npm run build -w @kreiseck/elda && npm run format:check && npx eslint packages/elda/src && npm test
git add packages/elda/src/index.ts packages/elda/src/index.test.ts packages/elda/README.md packages/elda/package.json CHANGELOG.md
git commit -m "feat(elda)!: API-Ergonomie v0.2 (Zustaende, Wuerfe, roher Zugang)"
```

---

## Selbst-Review (durchgeführt)

- **Spec-Abdeckung:** Leitunterscheidung Fehler/Zustand (Task 1), `EldaStatusError`
  mit vollem Ergebnis (Task 1), `umgebung` Pflicht + Laufzeitprüfung + leere
  Zugangsdaten (Task 2), `findeRuecksendung` (Task 3), rohe Variante unverändert
  erhalten (Task 4), Komfortschicht mit `Gesendet`/`Empfangen`/`.roh` (Task 5),
  geschrumpfter Barrel + Doku + Version (Task 6). Kein automatisch abholender
  Iterator — bewusst nirgends vorgesehen.
- **Platzhalter:** keine. Jeder Code-Schritt zeigt vollständigen Code; der
  einzige Prosa-Schritt ist die README-Überarbeitung, deren Pflichtinhalte
  einzeln aufgezählt sind.
- **Typkonsistenz:** `EldaConfig` wird in Task 2 definiert und ab Task 4 überall
  von dort bezogen; `EldaDatei` entsteht in Task 4 und wird in Task 5
  wiederverwendet, nicht dupliziert; `createEldaTransferRoh`/`EldaTransferRoh`
  heißen ab Task 4 durchgängig gleich; `zustandOderWurf` und die drei Karten aus
  Task 1 werden in Task 5 unter denselben Namen benutzt.
- **Offen (unverändert, Kundentest nötig):** ob `000` immer eine
  `protokollnummer` trägt, ob die Original-Protokollnummer bei `405` in einem
  Feld oder nur im Meldungstext steht, ob `404` bei `empfangen` überhaupt
  auftritt, sowie MTOM, Form der leeren Rücksendungsliste, `SOAPAction` und
  `created`-Format.
