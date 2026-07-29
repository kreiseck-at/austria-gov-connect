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
  // die VSNR/GEBD-Alternative aus F7051 zuschlägt.
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

test('F7030: Geburtsdatum mit unmöglichem Tag wird gegen die Monatslänge geprüft (Schaltjahr)', () => {
  // Februar 1980 hat wegen Schaltjahr 29 Tage, aber nicht 30.
  wirft('M3', { BKNR: '1', GEBD: '30021980', REFV: 'X', ADAT: '01022026', BBER: '05' }, 'F7030');
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', GEBD: '29021980', REFV: 'X', ADAT: '01022026', BBER: '05' }),
  );
  // 1981 ist kein Schaltjahr, der 29.02. existiert dort nicht.
  wirft('M3', { BKNR: '1', GEBD: '29021981', REFV: 'X', ADAT: '01022026', BBER: '05' }, 'F7030');
});

test('F7051: weder VSNR noch GEBD', () => {
  wirft('M3', { BKNR: '1', ADAT: '01022026', BBER: '05' }, 'F7051');
});

test('F7051: gültige VSNR allein reicht, GEBD/REFV bleiben leer (M3/M4/M6/M8)', () => {
  // Dies ist genau der Fall, den die Ergänzung um die REFV-Flanke NICHT werfen darf:
  // eine gültige VSNR ist vorhanden, weder Geburtsdatum noch Referenzwert sind nötig.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '05' }),
  );
  assert.doesNotThrow(() => pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026' }));
  assert.doesNotThrow(() => pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026' }));
  assert.doesNotThrow(() =>
    pruefeInhalt('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026' }),
  );
});

test('F7051-Ausnahme (A1, kritisch): M3 ohne VSNR braucht laut Kapitel E.29.2/E.30.2 nur GEBD, REFV darf per M8 nachgereicht werden', () => {
  // Kapitel E.29.2, Seite 305: "Wenn zum Zeitpunkt der Anmeldung die Übermittlung der VSNR
  // Anforderung nicht möglich war, muss die Referenz der VSNR-Anforderung zur Anmeldung per
  // Richtigstellung (SART M8) nachgetragen werden." E.30.2, Seite 332, bestätigt das für den
  // Fall, dass die Anmeldung selbst betroffen ist. Der Prüfkatalog kennt dafür keinen
  // Fehlercode — eine M3 ohne VSNR und ohne REFV, aber mit Geburtsdatum, ist zulässig.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', BBER: '05' }),
  );
});

test('F7051-Ergänzung (A2, nicht aus dem Katalog): ohne VSNR muss bei M4/M6/M8 neben GEBD auch REFV belegt sein', () => {
  // Kapitel E.30.2, Seite 332: "Ist vor Rückmeldung der VSNR eine Abmeldung (SART M4),
  // Änderungsmeldung (SART M6) oder Richtigstellung Anmeldung (SART M8) erforderlich, muss
  // zwingend zusätzlich zum Geburtsdatum (GEBD) auch der Referenzwert der VSNR-Anforderung
  // (REFV) angegeben werden." — anders als bei M3 (siehe Test oben) reicht GEBD hier allein
  // nicht aus.
  wirft('M4', { BKNR: '1', GEBD: '01011980', ADAT: '01022026' }, 'F7051');
  wirft('M6', { BKNR: '1', GEBD: '01011980', ADAT: '01022026' }, 'F7051');
  wirft('M8', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', RDAT: '02022026' }, 'F7051');

  // Mit REFV zusätzlich zum Geburtsdatum ist die Alternative vollständig.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', GEBD: '01011980', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M6', { BKNR: '1', GEBD: '01011980', REFV: 'ANFORDERUNG-001', ADAT: '01022026' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M8', {
      BKNR: '1',
      GEBD: '01011980',
      REFV: 'ANFORDERUNG-001',
      ADAT: '01022026',
      RDAT: '02022026',
    }),
  );
});

test('F7051-Ergänzung gilt nicht bei M9: Kapitel E.30.2 nennt dort keine REFV-Pflicht', () => {
  // M9 (Richtigstellung Abmeldung) fehlt in der Aufzählung aus Kapitel E.30.2, Seite 332
  // ("Abmeldung (SART M4), Änderungsmeldung (SART M6) oder Richtigstellung Anmeldung (SART
  // M8)") — hier reicht GEBD ohne REFV, sofern die VSNR fehlt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M9', { BKNR: '1', GEBD: '01011980', ADAT: '01022026', RDAT: '02022026' }),
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

test('F7061: ADAT mit unmöglichem Tag wird gegen die Monatslänge geprüft', () => {
  // April hat nur 30 Tage.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '31042026', BBER: '05' }, 'F7061');
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '30042026', BBER: '05' }),
  );
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

test('F7104: Ummeldedatum muss TTMMJJJJ sein (reine Formatprüfung wie F7061/F7066)', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '99992026' }, 'F7104');
  // Februar 2026 ist kein Schaltjahr und hat nur 28 Tage.
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '30022026' }, 'F7104');
  // ZTUM/ZKUM sind hier ergänzt, damit ausschließlich das Format von UMDA geprüft wird und
  // nicht F7108/F7109 (A1: UMDA belegt verlangt ZTUM/ZKUM) zuschlägt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
  // 2024 ist ein Schaltjahr.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      UMDA: '29022024',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
});

test('F7104 gilt nicht bei M6: Blatt VR führt UMDA nur für M4, M9, S4', () => {
  assert.doesNotThrow(() =>
    pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '99992026' }),
  );
});

test('F7106: richtiges Ummeldedatum muss TTMMJJJJ sein, nur bei M9', () => {
  wirft(
    'M9',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', RUMD: '99992026' },
    'F7106',
  );
  // UMDA/ZTUM/ZKUM sind hier ergänzt, damit ausschließlich das Format von RUMD geprüft wird und
  // nicht F7113 (A1: ohne UMDA muss auch RUMD leer bleiben) zuschlägt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M9', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      RDAT: '02022026',
      RUMD: '01022026',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
});

test('F7106 gilt nicht bei M4: Blatt VR führt RUMD nur für M9', () => {
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RUMD: '99992026' }),
  );
});

test('F7107: Sonderfall Ummeldung nur J oder leer', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', SOUM: 'N' }, 'F7107');
});

test('F7114: Zielversicherungsträger 11 bis 19', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ZTUM: '20' }, 'F7114');
});

test('F7096: Abmeldegrund gegen die Codeliste aus Kapitel D.22', () => {
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '99' }, 'F7096');
  // 26 und 28 fehlen in der Codeliste bewusst (Lücke im Dokument selbst, Kapitel D.22, Seite 94/95).
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '26' }, 'F7096');
  wirft('M9', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', AGRD: '28' }, 'F7096');
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12' }),
  );
  // Rand der Liste: kleinster ('00') und größter ('34') Code.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '00' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '34' }),
  );
});

test('F7108/F7109 (A1): Ummeldedatum belegt verlangt Zielversicherungsträger und Beitragskontonummer Ummeldung', () => {
  // Kapitel E.29.2, Seite 319, erste Tabelle ("Abmeldung mit Abmeldegrund 12"): UMDA, ZTUM und
  // ZKUM stehen dort gemeinsam mit Pflichtstufe Z. Diese beiden Katalog-Codes decken die Hälfte
  // davon ab, die anhand des Ummeldedatums selbst entscheidbar ist — ohne jede Kenntnis von AGRD.
  wirft(
    'M4',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '01032026', ZKUM: '7788991' },
    'F7108',
  );
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '01032026', ZTUM: '17' }, 'F7109');
  wirft(
    'M9',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', UMDA: '01032026', ZKUM: '7788991' },
    'F7108',
  );
  wirft(
    'M9',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', UMDA: '01032026', ZTUM: '17' },
    'F7109',
  );
  // vollständig belegt: kein Fehler (Fall "muss NICHT werfen" aus dem Bericht).
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      UMDA: '01032026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
});

test('F7112/F7113 (A1): Ummeldedatum leer verlangt, dass auch SOUM/ZTUM/ZKUM (bei M9 zusätzlich RUMD) leer bleiben', () => {
  // Kapitel E.29.2, Seite 321, "Ausnahmefall: Abmeldung mit Abmeldegrund 12 ohne Angaben zum
  // Ziel-Beitragskonto (Ummeldung ohne Zielangaben)": UMDA, SOUM, ZTUM, ZKUM (und bei M9 auch
  // RUMD) stehen dort gemeinsam mit "-" — das ist die Grundstellungs-Ausnahme aus dem Bericht.
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ZTUM: '17' }, 'F7112');
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ZKUM: '7788991' }, 'F7112');
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', SOUM: 'J' }, 'F7112');
  wirft(
    'M9',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', RUMD: '01032026' },
    'F7113',
  );
  wirft('M9', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', ZTUM: '17' }, 'F7113');
  // Grundstellungs-Ausnahme: alle fünf Felder leer, unabhängig vom Abmeldegrund — wirft nicht.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12' }),
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M9', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      RDAT: '02022026',
      AGRD: '12',
    }),
  );
});

test('F7105 bewusst NICHT umgesetzt: Kapitel E.29.2, Seite 326/327 (Beispiel 6) widerspricht der wörtlichen Katalog-Bedingung', () => {
  // "Feld UMDA befüllt und Feld AGRD ist nicht 12" (F7105) wörtlich genommen würde diese
  // dokumentierte, gültige Richtigstellung ablehnen: AGRD wird von 12 auf 02 zurückgestellt,
  // UMDA/ZTUM/ZKUM bleiben aber belegt, weil die ursprüngliche Ummeldung am Zielkonto storniert
  // werden muss (Matrix Seite 320/321, "...auf Abmeldegrund ungleich 12 (Ummeldung) zum Storno
  // der Ummeldung"). Diese Regel wird deshalb absichtlich nicht geprüft, siehe pruefeInhalt-Doku.
  assert.doesNotThrow(() =>
    pruefeInhalt('M9', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      RDAT: '02022026',
      AGRD: '02',
      UMDA: '01032026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
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

test('A3: Feldwerte werden vor dem Vergleich getrimmt (Füllzeichen aus einem Festsatz)', () => {
  // FRDV mit Füllzeichen darf F7115 nicht stillschweigend aushebeln.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N ' }, 'F7115');

  // Eine mit Leerzeichen aufgefüllte Grundstellung zählt weiterhin als "keine VSNR".
  wirft('M3', { BKNR: '1', VSNR: '0000000000 ', ADAT: '01022026', BBER: '05' }, 'F7051');

  // SOUM mit Füllzeichen ('J ') ist weiterhin ein gültiges 'J' und darf nicht F7107 werfen.
  // UMDA/ZTUM/ZKUM sind ergänzt, damit nicht stattdessen F7112 (A1: ohne UMDA muss auch SOUM
  // leer bleiben) zuschlägt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      SOUM: 'J ',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
});
