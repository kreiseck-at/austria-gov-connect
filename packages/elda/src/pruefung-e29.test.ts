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

test('F7069: der Wertebereich aus D.39 gilt auch bei M6, wo die Matrix BBER zulässt', () => {
  // Bewusste Änderung gegenüber der früheren Fassung dieses Tests, die hier ausdrücklich
  // `doesNotThrow` erwartete: Der Prüfkatalog führt F7069 nur unter M3 (die Satzart-Zelle ist
  // mit der von F7068 verbunden und trägt „M3"), die Codeliste steht aber in Kapitel D.39 und
  // gehört zum FELD, nicht zur Satzart. Die Pflichtmatrix lässt BBER bei M6 mit der Stufe `V`
  // zu — ein '99' ging dort stillschweigend durch und stand danach als Beschäftigungsbereich
  // im Satz.
  wirft('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '99' }, 'F7069');
  wirft('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '1' }, 'F7069');
  assert.doesNotThrow(() =>
    pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '13' }),
  );
});

test('F7069: Satzarten, in denen die Matrix BBER auf `-` führt, prüft pruefeInhalt nicht', () => {
  // Bei M4/M8/M9/S3/S4 trägt BBER in der Matrix ein `-`; eine Angabe weist bereits
  // `pruefePflicht` ab, hier ist deshalb nichts zu prüfen. Die Aufteilung ist Absicht:
  // pruefeInhalt entscheidet über Wertebereiche, nicht über Zulässigkeit je Satzart.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12', BBER: '99' }),
  );
});

test('F7104: Ummeldedatum muss TTMMJJJJ sein (reine Formatprüfung wie F7061/F7066)', () => {
  // AGRD/ZTUM/ZKUM sind in allen vier Fixtures ergänzt, damit ausschließlich das Format von
  // UMDA verletzt bzw. erfüllt wird und nicht zusätzlich F7105 (A1: UMDA belegt verlangt
  // Abmeldegrund 12) oder F7108/F7109 (A1: UMDA belegt verlangt ZTUM/ZKUM) zuschlägt — UMDA ist
  // hier ja immer belegt, auch in den werfenden Fällen (nur eben mit ungültigem Format).
  wirft(
    'M4',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
      UMDA: '99992026',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7104',
  );
  // Februar 2026 ist kein Schaltjahr und hat nur 28 Tage.
  wirft(
    'M4',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
      UMDA: '30022026',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7104',
  );
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
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
      AGRD: '12',
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
  // UMDA/ZTUM/ZKUM sind in beiden Fällen ergänzt, damit die Fixture ausschließlich das Format
  // von RUMD verletzt bzw. erfüllt und nicht zusätzlich F7113 (A1: ohne UMDA muss auch RUMD
  // leer bleiben) — das gilt unabhängig davon, in welcher Reihenfolge die Prüfungen in
  // pruefeInhalt laufen, nicht nur, weil F7106 dort zufällig vor F7113 steht.
  wirft(
    'M9',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      RDAT: '02022026',
      RUMD: '99992026',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7106',
  );
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
  // AGRD/UMDA/ZTUM/ZKUM sind ergänzt, damit die Fixture ausschließlich SOUM verletzt und nicht
  // zusätzlich F7105 (A1-Nachtrag: UMDA belegt verlangt Abmeldegrund 12) oder F7112 (A1: ohne
  // UMDA muss auch SOUM leer bleiben) — unabhängig von der Prüfreihenfolge in pruefeInhalt.
  wirft(
    'M4',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
      SOUM: 'N',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7107',
  );
});

test('F7114: Zielversicherungsträger 11 bis 19', () => {
  // AGRD/UMDA/ZKUM sind ergänzt, damit die Fixture ausschließlich ZTUM verletzt und nicht
  // zusätzlich F7112 (A1: ohne UMDA muss auch ZTUM leer bleiben) — ein leeres UMDA neben einem
  // belegten, aber ungültigen ZTUM wäre sonst eine zweite, unabhängige Regelverletzung.
  wirft(
    'M4',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
      UMDA: '01022026',
      ZTUM: '20',
      ZKUM: '7788991',
    },
    'F7114',
  );
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
  // Bei den beiden M4-Fixtures ist AGRD: '12' ergänzt, damit UMDA belegt nicht zusätzlich F7105
  // (A1-Nachtrag: UMDA belegt verlangt Abmeldegrund 12) verletzt — bei M9 entfällt das, F7105
  // gilt dort nicht (siehe der eigene F7105-Test unten).
  wirft(
    'M4',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12', UMDA: '01032026', ZKUM: '7788991' },
    'F7108',
  );
  wirft(
    'M4',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12', UMDA: '01032026', ZTUM: '17' },
    'F7109',
  );
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
  // vollständig belegt: kein Fehler (Fall "muss NICHT werfen" aus dem Bericht). AGRD: '12' ist
  // ergänzt, weil UMDA belegt sonst F7105 (A1-Nachtrag) verletzen würde.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
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

test('F7105 bei M9 bewusst NICHT umgesetzt: Kapitel E.29.2, Seite 326/327 (Beispiel 6) widerspricht der wörtlichen Katalog-Bedingung', () => {
  // "Feld UMDA befüllt und Feld AGRD ist nicht 12" (F7105) wörtlich genommen würde diese
  // dokumentierte, gültige Richtigstellung ablehnen: AGRD wird von 12 auf 02 zurückgestellt,
  // UMDA/ZTUM/ZKUM bleiben aber belegt, weil die ursprüngliche Ummeldung am Zielkonto storniert
  // werden muss (Matrix Seite 320/321, "...auf Abmeldegrund ungleich 12 (Ummeldung) zum Storno
  // der Ummeldung"). Für M9 bleibt die Regel deshalb absichtlich ungeprüft, siehe
  // pruefeInhalt-Doku. Für M4 gilt das NICHT — siehe den folgenden Test.
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

test('F7105 bei M4 umgesetzt (A1-Nachtrag): Ummeldedatum belegt verlangt Abmeldegrund 12', () => {
  // Anders als bei M9 (siehe Test oben) gibt es für M4 auf den Seiten 319–321 kein
  // Gegenbeispiel: Dort existieren nur zwei M4-Matrizen — die erste mit Abmeldegrund 12 und
  // UMDA als "Z" (Seite 319), die Ausnahmematrix "Ummeldung ohne Zielangaben" mit UMDA als "-"
  // (Seite 321). Ein dokumentierter M4-Satz mit belegtem UMDA und einem Abmeldegrund ungleich
  // 12 kommt nirgends vor — F7105 wird für M4 deshalb wörtlich umgesetzt.
  wirft(
    'M4',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '02',
      UMDA: '01032026',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7105',
  );
  // Regelfall (Matrix Seite 319): Abmeldegrund 12 mit belegtem UMDA wirft nicht.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
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

// ---------------------------------------------------------------------------
// Kalenderprüfung der Datumsfelder ohne eigene Katalog-Zeile
// ---------------------------------------------------------------------------

/**
 * Die acht Datumsfelder der Feldtabelle E.29, für die der Prüfkatalog keine Formatzeile
 * führt, samt einer Satzart, in der die Pflichtmatrix sie belegen lässt, und den übrigen
 * Feldern, die diese Satzart zwingend braucht.
 */
const DATUMSFELDER_OHNE_KATALOG: readonly (readonly [
  string,
  Parameters<typeof pruefeInhalt>[0],
  Record<string, string>,
])[] = [
  ['BDAT', 'M6', {}],
  ['EBSV', 'M4', { AGRD: '01' }],
  ['KEAB', 'M4', { AGRD: '01', EBSV: '31012026' }],
  ['KEBI', 'M4', { AGRD: '01', EBSV: '31012026' }],
  ['UEAB', 'M4', { AGRD: '01', EBSV: '31012026' }],
  ['UEBI', 'M4', { AGRD: '01', EBSV: '31012026' }],
  ['BVAB', 'M3', { BBER: '05' }],
  ['BVEN', 'M4', { AGRD: '01', EBSV: '31012026' }],
];

test('E.29: die acht Datumsfelder ohne Katalog-Zeile werden gegen den Kalender geprüft', () => {
  // '31112026' (31. November) und '99999999' haben beide acht Ziffern und kamen deshalb an
  // der Stellenzahlprüfung in festsatz.ts vorbei.
  for (const [feld, satzart, rest] of DATUMSFELDER_OHNE_KATALOG) {
    for (const ungueltig of ['31112026', '99999999', '00000001', '32012026', '29022026']) {
      wirft(satzart, { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', ...rest, [feld]: ungueltig }, 'E.29');
    }
  }
});

test('E.29: gültige Kalenderdaten und die Grundstellung passieren in allen acht Feldern', () => {
  for (const [feld, satzart, rest] of DATUMSFELDER_OHNE_KATALOG) {
    for (const gueltig of ['01022026', '29022024', '31122025', '', '00000000', '0']) {
      assert.doesNotThrow(
        () =>
          pruefeInhalt(satzart, {
            BKNR: '1',
            VSNR: '1234010180',
            ADAT: '01022026',
            ...rest,
            [feld]: gueltig,
          }),
        `${feld} = '${gueltig}'`,
      );
    }
  }
});

test('E.29: ein vertauschtes MMTTJJJJ fällt jetzt auf, solange der Tag über 12 liegt', () => {
  // Der teuerste Fall aus dem Befund: Ein Aufrufer im US-Format liefert für den 25.03.2026
  // '03252026' — Monat 03, Tag 25 wären gültig, in TTMMJJJJ gelesen ist es aber Tag 03,
  // Monat 25. Genau dieser Monat 13..31 ist der Hebel.
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '01', EBSV: '03252026' }, 'E.29');
});

test('E.29: die abgeleitete Kalenderprüfung fasst die Felder mit Katalog-Zeile nicht an', () => {
  // ADAT bei M8 bleibt ungeprüft — der Katalog nennt für F7061 ausdrücklich nur
  // M3/M4/M6/S3/S4, weil ADAT dort das ursprüngliche Datum unverändert fortführt. Diese
  // belegte Auslassung darf die neue Prüfung nicht überschreiben.
  assert.doesNotThrow(() =>
    pruefeInhalt('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '99992026', RDAT: '01022026' }),
  );
  // Umgekehrt wirft dieselbe Eingabe bei M3 weiterhin unter F7061, nicht unter 'E.29'.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '99992026', BBER: '05' }, 'F7061');
});

test('E.29: GEBD behält seine Sonderformen 00MMJJJJ und 0000JJJJ', () => {
  // Die abgeleitete Prüfung darf GEBD nicht erfassen — dort sind Tag und Monat 00 laut
  // Kapitel D.7 ausdrücklich zulässig.
  for (const gebd of ['00051980', '00001980', '01011980']) {
    assert.doesNotThrow(
      () => pruefeInhalt('M3', { BKNR: '1', GEBD: gebd, REFV: 'X', ADAT: '01022026', BBER: '05' }),
      gebd,
    );
  }
});

// ---------------------------------------------------------------------------
// Wertebereiche der Kennzeichenfelder (GERF/FRDV/BVJN) und der Versicherungsnummer
// ---------------------------------------------------------------------------

test('GERF/FRDV/BVJN: nur J und N sind zulässig, in genau dieser Schreibweise', () => {
  // Keines der drei Felder hat eine Zeile im Prüfkatalog; die Werte stehen in der
  // Feldtabelle E.29 (GERF, Feld Nr. 19) bzw. in D.41 (FRDV) und D.47 (BVJN).
  for (const wert of ['n', 'j', 'X', '1', 'Ja']) {
    wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '05', GERF: wert }, 'E.29');
    wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BBER: '05', FRDV: wert }, 'D.41');
    wirft('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BVJN: wert }, 'D.47');
  }
  for (const wert of ['J', 'N']) {
    assert.doesNotThrow(() =>
      pruefeInhalt('M3', {
        BKNR: '1',
        VSNR: '1234010180',
        ADAT: '01022026',
        BBER: '05',
        GERF: wert,
        FRDV: wert,
        VWAZ: '1567',
      }),
    );
    assert.doesNotThrow(() =>
      pruefeInhalt('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', BVJN: wert }),
    );
  }
});

test('GERF/FRDV/BVJN werden in jeder Satzart geprüft, in der die Matrix sie belegen lässt', () => {
  // GERF: Z bei M3/M4/M9, V bei M6 — also vier Satzarten, nicht nur die Anmeldung.
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '12', GERF: 'n' }, 'E.29');
  wirft('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', GERF: 'n' }, 'E.29');
  wirft(
    'M9',
    { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '02022026', AGRD: '12', GERF: 'n' },
    'E.29',
  );
  // FRDV: Z bei M3, V bei M6.
  wirft('M6', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', FRDV: 'n' }, 'D.41');
});

test('FRDV: ein kleingeschriebenes n hebelt F7115 nicht mehr aus, sondern wird abgewiesen', () => {
  // Der Kern des Befundes: Die F7115-Bedingung vergleicht zeichengenau gegen 'N', so wie es
  // der Prüfkatalog formuliert. Ein 'n' war früher belegt, aber ungleich — die Meldung ging
  // ohne VWAZ hinaus UND trug ein Kleinbuchstaben-Byte auf Position 540.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'n' }, 'D.41');
  // Mit dem korrekten 'N' greift F7115 unverändert.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N' }, 'F7115');
});

test('F7115: am Stichtag selbst (ADAT = 31.12.2025) greift die VWAZ-Pflicht noch nicht', () => {
  // Die nicht feuernde Seite der Bedingung „ADAT>31.12.2025" aus Blatt VR Nr. 36 — der
  // 31.12.2025 ist NICHT größer als der 31.12.2025.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '31122025', BBER: '01', FRDV: 'N' }),
  );
  // Einen Tag später greift sie.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N' }, 'F7115');
});

test('F7020: die Versicherungsnummer wird gegen die Stellenfolge aus D.6 geprüft', () => {
  // LLLPTTMMJJ: Tag 01–31, Monat 01–12 bzw. 13–15 beim fingierten Datum (Kapitel D.6,
  // Seite 72). '1234999999' baute früher stillschweigend durch.
  for (const vsnr of ['1234999999', '1234000180', '1234321180', '1234011680', '123401018']) {
    wirft('M3', { BKNR: '1', VSNR: vsnr, ADAT: '01022026', BBER: '05' }, 'F7020');
  }
  // Gültig: echtes Geburtsdatum, Randtage und die drei fingierten Monate 13–15.
  for (const vsnr of ['1234010180', '1234311280', '1234011380', '1234011480', '1234311580']) {
    assert.doesNotThrow(
      () => pruefeInhalt('M3', { BKNR: '1', VSNR: vsnr, ADAT: '01022026', BBER: '05' }),
      vsnr,
    );
  }
});

test('F7020: die Grundstellung der VSNR bleibt eine Grundstellung, kein Formatfehler', () => {
  // '0000000000' ist laut D.6 die ausdrücklich vorgesehene Meldung „VSNR unbekannt" — sie
  // darf nicht in die Strukturprüfung laufen. Stattdessen greift die GEBD/REFV-Alternative.
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', {
      BKNR: '1',
      VSNR: '0000000000',
      GEBD: '01011980',
      REFV: 'REF-VSNR-1',
      ADAT: '01022026',
      BBER: '05',
    }),
  );
});

test('F7020: die Meldung nennt das Feld, nicht die Versicherungsnummer selbst', () => {
  assert.throws(
    () => pruefeInhalt('M3', { BKNR: '1', VSNR: '1234999999', ADAT: '01022026', BBER: '05' }),
    (err: unknown) => {
      const text = (err as Error).message;
      assert.ok(err instanceof EldaError);
      assert.match(text, /F7020/);
      assert.ok(!text.includes('1234999999'), `der Wert steht in der Meldung — ${text}`);
      return true;
    },
  );
});

test('A3: Feldwerte werden vor dem Vergleich getrimmt (Füllzeichen aus einem Festsatz)', () => {
  // FRDV mit Füllzeichen darf F7115 nicht stillschweigend aushebeln.
  wirft('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '01012026', BBER: '01', FRDV: 'N ' }, 'F7115');

  // Eine mit Leerzeichen aufgefüllte Grundstellung zählt weiterhin als "keine VSNR".
  wirft('M3', { BKNR: '1', VSNR: '0000000000 ', ADAT: '01022026', BBER: '05' }, 'F7051');

  // SOUM mit Füllzeichen ('J ') ist weiterhin ein gültiges 'J' und darf nicht F7107 werfen.
  // AGRD/UMDA/ZTUM/ZKUM sind ergänzt, damit nicht stattdessen F7105 (A1-Nachtrag: UMDA belegt
  // verlangt Abmeldegrund 12) oder F7112 (A1: ohne UMDA muss auch SOUM leer bleiben) zuschlägt.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '12',
      SOUM: 'J ',
      UMDA: '01022026',
      ZTUM: '17',
      ZKUM: '7788991',
    }),
  );
});

// ---------------------------------------------------------------------------
// F7111 (Blatt VR, Nr. 35) — Abmeldegrund ohne Ende des Beschaeftigungsverhaeltnisses
// ---------------------------------------------------------------------------

/**
 * Die zwoelf Abmeldegruende, die Blatt `VR` Nr. 35 woertlich aufzaehlt („Feld AGRD 07, 08,
 * 09, 11, 12, 15, 19, 23, 29, 31, 32, 33 und EBSV nicht leer"). Kapitel D.22, Seite 96
 * fuehrt genau fuer diese zwoelf — und fuer keinen weiteren Code — in der Spalte EBSV ein
 * `-` („keine Angabe zulaessig, Feld Grundstellung").
 */
const AGRD_OHNE_EBSV = ['07', '08', '09', '11', '12', '15', '19', '23', '29', '31', '32', '33'];

/** Alle uebrigen Codes der Liste aus Kapitel D.22 — dort steht in der EBSV-Spalte Z oder Z1. */
const AGRD_MIT_EBSV = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '10',
  '13',
  '14',
  '16',
  '17',
  '18',
  '20',
  '21',
  '22',
  '24',
  '25',
  '27',
  '30',
  '34',
];

test('F7111: Abmeldegrund 09 (Zivildienst) mit belegtem EBSV wird abgewiesen', () => {
  // Der nachgestellte Fall: baute frueher durch, ELDA weist ihn mit Status N zurueck.
  wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: '09', EBSV: '31012026' }, 'F7111');
});

test('F7111: gilt fuer alle zwoelf Codes und fuer M4 wie M9', () => {
  for (const agrd of AGRD_OHNE_EBSV) {
    wirft('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: agrd, EBSV: '31012026' }, 'F7111');
    wirft(
      'M9',
      {
        BKNR: '1',
        VSNR: '1234010180',
        ADAT: '01022026',
        RDAT: '02022026',
        AGRD: agrd,
        EBSV: '31012026',
      },
      'F7111',
    );
  }
});

test('F7111: leeres EBSV ist bei denselben zwoelf Codes zulaessig', () => {
  for (const agrd of AGRD_OHNE_EBSV) {
    assert.doesNotThrow(
      () => pruefeInhalt('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', AGRD: agrd }),
      agrd,
    );
  }
  // Auch die Grundstellung als Ziffernfolge zaehlt als leer (siehe normalisiertNumerisch).
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '09',
      EBSV: '00000000',
    }),
  );
});

test('F7111: alle uebrigen Abmeldegruende duerfen EBSV belegen', () => {
  for (const agrd of AGRD_MIT_EBSV) {
    assert.doesNotThrow(
      () =>
        pruefeInhalt('M4', {
          BKNR: '1',
          VSNR: '1234010180',
          ADAT: '01022026',
          AGRD: agrd,
          EBSV: '31012026',
        }),
      agrd,
    );
  }
});

test('F7111: greift nur bei M4 und M9 — der Katalog nennt keine weitere Satzart', () => {
  assert.doesNotThrow(() =>
    pruefeInhalt('M3', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      BBER: '05',
      AGRD: '09',
      EBSV: '31012026',
    }),
  );
});

// ---------------------------------------------------------------------------
// I5/M8 — Grundstellung numerischer Felder
// ---------------------------------------------------------------------------

test('I5: eine Versicherungsnummer aus lauter Nullen gilt in jeder Stellenzahl als unbelegt', () => {
  // Realistischer Ausloeser: String(row.vsnr ?? 0) oder eine Integer-Spalte einer Datenbank.
  // Frueher glich nur das Literal '0000000000' der Grundstellung; '0' galt als belegte
  // Versicherungsnummer, obwohl der Satz niemanden identifiziert.
  for (const vsnr of ['0', '00', '000000', '0000000000']) {
    wirft('M3', { BKNR: '1', VSNR: vsnr, ADAT: '01022026', BBER: '05' }, 'F7051');
  }
});

test('I5: ohne echte VSNR greift bei M4 weiterhin die REFV-Pflicht aus Kapitel E.30.2', () => {
  // Der zweite Teil des Befundes: Mit VSNR = '0' galt vsnrBelegt als wahr und umging damit
  // die REFV-Pflicht vollstaendig.
  wirft('M4', { BKNR: '1', VSNR: '0', GEBD: '01011980', ADAT: '01022026' }, 'F7051');
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '0',
      GEBD: '01011980',
      REFV: 'REF-VSNR-1',
      ADAT: '01022026',
    }),
  );
});

test('M8: ein zurueckgelesenes UMDA in Grundstellung ist leer, kein Formatfehler', () => {
  // '00000000' aus einer Datei gelesen warf frueher F7104 („ungueltig"), obwohl es genau
  // das Gegenteil bedeutet: ein leeres Feld.
  assert.doesNotThrow(() =>
    pruefeInhalt('M4', {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      AGRD: '01',
      UMDA: '00000000',
    }),
  );
});

// ---------------------------------------------------------------------------
// I6 — Personendaten gehoeren nicht in Fehlermeldungen
// ---------------------------------------------------------------------------

test('I6: Formatmeldungen zu Datumsfeldern nennen das Feld, nicht den Wert', () => {
  const ohneWert = (
    satzart: Parameters<typeof pruefeInhalt>[0],
    werte: Record<string, string>,
    code: string,
    wert: string,
  ) => {
    assert.throws(
      () => pruefeInhalt(satzart, werte),
      (err: unknown) => {
        const text = (err as Error).message;
        assert.ok(err instanceof EldaError);
        assert.match(text, new RegExp(code));
        assert.ok(!text.includes(wert), `${code}: der Wert steht in der Meldung — ${text}`);
        return true;
      },
      code,
    );
  };

  ohneWert(
    'M3',
    { BKNR: '1', GEBD: '32011990', REFV: 'X', ADAT: '01022026', BBER: '05' },
    'F7030',
    '32011990',
  );
  ohneWert('M3', { BKNR: '1', VSNR: '1234010180', ADAT: '31042026', BBER: '05' }, 'F7061', '31042026');
  ohneWert('M8', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', RDAT: '31042026' }, 'F7066', '31042026');
  ohneWert('M4', { BKNR: '1', VSNR: '1234010180', ADAT: '01022026', UMDA: '31042026' }, 'F7104', '31042026');
  ohneWert(
    'M9',
    {
      BKNR: '1',
      VSNR: '1234010180',
      ADAT: '01022026',
      RDAT: '02022026',
      UMDA: '01022026',
      RUMD: '31042026',
      AGRD: '12',
      ZTUM: '17',
      ZKUM: '7788991',
    },
    'F7106',
    '31042026',
  );
});
