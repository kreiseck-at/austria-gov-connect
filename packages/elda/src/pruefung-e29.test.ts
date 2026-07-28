import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeInhalt } from './pruefung-e29';
import { EldaError } from './errors';

const wirft = (satzart: Parameters<typeof pruefeInhalt>[0], werte: Record<string, string>, code: string) => {
  assert.throws(
    () => pruefeInhalt(satzart, werte),
    (err: unknown) => {
      assert.ok(err instanceof EldaError, `${code}: erwartet EldaError`);
      assert.match((err as Error).message, new RegExp(code), `${code} soll im Text stehen`);
      return true;
    },
    code,
  );
};

test('F7000: leere Beitragskontonummer', () => {
  wirft('M3', { BKNR: '', ADAT: '01022026', VSNR: '1234010180' }, 'F7000');
});

test('F7030: Geburtsdatum in zulässiger Form', () => {
  // REFV ist hier gesetzt, damit ausschließlich das Format von GEBD geprüft wird und nicht
  // die VSNR/GEBD/REFV-Alternative aus F7051 zuschlägt (M3 ohne VSNR braucht REFV, siehe unten).
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', GEBD: '01011980', REFV: 'X', ADAT: '01022026', BBER: '05' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', GEBD: '00051980', REFV: 'X', ADAT: '01022026', BBER: '05' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', GEBD: '00001980', REFV: 'X', ADAT: '01022026', BBER: '05' }),
  );
  wirft('M3', { BKNR: '1', GEBD: '32011980', ADAT: '01022026', BBER: '05' }, 'F7030');
});

test('F7051: weder VSNR noch GEBD', () => {
  wirft('M3', { BKNR: '1', ADAT: '01022026', BBER: '05' }, 'F7051');
});

test('F7051: gültige VSNR allein reicht, GEBD/REFV bleiben leer (M3/M4/M6)', () => {
  // Dies ist genau der Fall, den die Ergänzung um die REFV-Flanke NICHT werfen darf:
  // eine gültige VSNR ist vorhanden, weder Geburtsdatum noch Referenzwert sind nötig.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '05' }),
  );
  assert.doesNotThrow(() => pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026' }));
  assert.doesNotThrow(() => pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026' }));
});

test('F7051 (Ergänzung, nicht aus dem Katalog): ohne VSNR muss bei M3/M4/M6 neben GEBD auch REFV belegt sein', () => {
  // Geburtsdatum allein reicht laut Kapitel E.29.2 (Satzart M3) ohne VSNR nicht aus, wenn
  // die Referenz der VSNR-Anforderung fehlt.
  wirft('M3', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', BBER: '05' }, 'F7051');
  wirft('M4', { BKNR: '1', GEBD: '01011980', ADAT: '01022026' }, 'F7051');
  wirft('M6', { BKNR: '1', GEBD: '01011980', ADAT: '01022026' }, 'F7051');

  // Mit REFV zusätzlich zum Geburtsdatum ist die Alternative vollständig.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', {
      BKNR: '1',
      GEBD: '01011980',
      REFV: 'ANFORDERUNG-001',
      ADAT: '01022026',
      BBER: '05',
    }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', GEBD: '01011980', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M6', { BKNR: '1', GEBD: '01011980', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }),
  );
});

test('F7051-Ergänzung gilt nicht außerhalb von M3/M4/M6: REFV hat dort eine eigene, unverbundene Zelle', () => {
  // Bei M8 bilden laut Kapitel E.29.1 nur VSNR und GEBD die Alternative; REFV steht für
  // sich (Task 4, ALTERNATIVGRUPPEN). Ohne VSNR reicht GEBD hier allein.
  assert.doesNotThrow(() =>
    pruefeInhalt('M8', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', RDAT: '02022026' }),
  );
});

test('F7050: Referenzwert der VSNR-Anforderung ohne Geburtsdatum', () => {
  wirft(
    'M3',
    { BKNR: '1', VSNR: '1234010180', REFV: 'ANFORDERUNG-001', ADAT: '01022026', BBER: '05' },
    'F7050',
  );
  wirft('M4', { BKNR: '1', VSNR: '1234010180', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }, 'F7050');
  wirft('M6', { BKNR: '1', VSNR: '1234010180', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }, 'F7050');

  assert.doesNotThrow(() =>
    pruefeInhalt('M3', {
      BKNR: '1',
      VSNR: '1234010180',
      GEBD: '01011980',
      REFV: 'ANFORDERUNG-001',
      ADAT: '01022026',
      BBER: '05',
    }),
  );
});

test('F7060 und F7062: An-/Abmeldedatum', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '' }, 'F7060');
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '31122018' }, 'F7062');
  assert.doesNotThrow(() => pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01012019' }));
});

test('F7061 gilt laut Prüfkatalog nicht für M8/M9: ADAT wird dort unverändert aus der Ursprungsmeldung übernommen', () => {
  // Die Satzart-Spalte zu F7061 im Blatt VR lautet „M3, M4, M6, S3, S4“ — M8/M9 fehlen
  // dort bewusst, weil ADAT bei der Richtigstellung das ursprüngliche Datum fortführt
  // (Kapitel E.29.2, Satzart M8) und nur RDAT (F7066) neu geprüft wird.
  assert.doesNotThrow(() =>
    pruefeInhalt('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '99992026', RDAT: '01022026' }),
  );
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '99992026', BBER: '05' }, 'F7061');
});

test('F7065 und F7067: richtiges An-/Abmeldedatum bei Richtigstellung', () => {
  wirft('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '' }, 'F7065');
  wirft('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '31122018' }, 'F7067');
});

test('F7069: Beschäftigungsbereich 01 bis 13', () => {
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '14' }, 'F7069');
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '00' }, 'F7069');
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '13' }),
  );
});

test('F7069 gilt laut Prüfkatalog nur für M3, nicht für M6', () => {
  // Im Blatt VR ist die Satzart-Zelle zu F7069 mit der von F7068 (Nr. 26, „leer“) verbunden
  // und trägt „M3“; die BBER-Regel zu M6 (F7101, GERF/FRDV-Konsistenz) ist eine eigene,
  // unverbundene Zelle und eine Warnung — hier bewusst nicht umgesetzt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '99' }),
  );
});

test('F7107: Sonderfall Ummeldung nur J oder leer', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', SOUM: 'N' }, 'F7107');
});

test('F7114: Zielversicherungsträger 11 bis 19', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ZTUM: '20' }, 'F7114');
});

test('F7115: VWAZ bei Anmeldung ab 2026 für die betroffenen Beschäftigungsbereiche', () => {
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N' }, 'F7115');
  // vor der Stichtagsgrenze nicht gefordert
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '31122025', BBER: '01', FRDV: 'N' }),
  );
  // nicht betroffener Beschäftigungsbereich
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '05', FRDV: 'N' }),
  );
});

test('F7115 gilt laut Prüfkatalog nur, wenn FRDV mit N belegt ist (kein freier Dienstvertrag)', () => {
  // Die Bedingungszelle zu F7115 im Blatt VR lautet wörtlich u. a. "...und Feld FRDV ist mit
  // N belegt" — bei einem freien Dienstvertrag (FRDV = J) kann VWAZ laut Kapitel E.29.2
  // entfallen, wenn keine Arbeitszeit vereinbart wurde.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'J' }),
  );
});

test('F7116: VWAZ vierstellig', () => {
  wirft(
    'M3',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N', VWAZ: '156' },
    'F7116',
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01012026',
      BBER: '01',
      FRDV: 'N',
      VWAZ: '1567',
    }),
  );
});
