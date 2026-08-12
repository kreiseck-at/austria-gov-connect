import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeMbgmPaket, pruefeBeitragskontonummer, HOECHSTANZAHL } from './pruefung-e32';
import {
  erstelleMbgmPaket,
  VERRECHNUNGSGRUNDLAGE,
  type PaketOptionen,
  type Beitragsgrundlagenmeldung,
} from './mbgm';

const OPT: PaketOptionen = {
  verfahren: 'selbstabrechnung',
  paketreferenzwert: 'P-1',
  beitragskontonummer: '1234567',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

const MELDUNG: Beitragsgrundlagenmeldung = {
  referenzwert: 'M-1',
  versicherungsnummer: '1234010180',
  familienname: 'Muster',
  vorname: 'Max',
  verrechnungsgrundlage: VERRECHNUNGSGRUNDLAGE.SV_MIT_ZEIT,
  tarifbloecke: [
    {
      beschaeftigtengruppe: 'B002',
      beginnDerVerrechnung: 1,
      basen: [
        {
          typ: 'AB',
          betragCent: 200_000,
          positionen: [{ typ: 'T01', prozentsatz: 39.6, betragCent: 79_200 }],
        },
      ],
    },
  ],
};

test('ein selbst gebautes Paket loest keine der kodierten Regeln aus', () => {
  assert.deepEqual(pruefeMbgmPaket(erstelleMbgmPaket([MELDUNG], OPT)), []);
  assert.deepEqual(pruefeMbgmPaket(erstelleMbgmPaket([MELDUNG], { ...OPT, verfahren: 'vorschreibung' })), []);
});

test('F9051: eine verfaelschte Gesamtsumme wird mit dem ELDA-Code benannt', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, GSUM: '99999' } };
  const b = pruefeMbgmPaket(saetze);
  assert.equal(b.length, 1);
  assert.equal(b[0]?.code, 'F9051');
  assert.equal(b[0]?.schwere, 'fehler');
});

test('F9051 gilt nur fuer den Selbstabrechner', () => {
  // Beim Vorschreiber ist GSUM mit Z4 gekennzeichnet und der Pruefkatalog
  // fuehrt fuer PV keine entsprechende Regel.
  const saetze = erstelleMbgmPaket([MELDUNG], { ...OPT, verfahren: 'vorschreibung' });
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, GSUM: '99999' } };
  assert.deepEqual(pruefeMbgmPaket(saetze), []);
});

test('F9060: eine falsche Anzahl wird in Kopf und Ende erkannt', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, ANZM: '7' } };
  const b = pruefeMbgmPaket(saetze);
  assert.equal(b.filter((x) => x.code === 'F9060').length, 1);
});

test('F9040: der Beitragszeitraum ist erst ab 01.01.2019 fachlich gueltig', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  const mit = (bzrm: string) => {
    const kopie = [...saetze];
    kopie[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, BZRM: bzrm } };
    return pruefeMbgmPaket(kopie).filter((b) => b.code === 'F9040');
  };
  assert.equal(mit('122018').length, 1, 'Dezember 2018 liegt davor');
  assert.equal(mit('012019').length, 0, 'Jaenner 2019 ist der erste gueltige');
  assert.equal(mit('132026').length, 1, 'Monat 13 gibt es nicht');
  assert.equal(mit('072026').length, 0);
});

test('F9031: JAGB kennt nur J und N', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  saetze[0] = { ...saetze[0]!, werte: { ...saetze[0]!.werte, JAGB: 'X' } };
  assert.equal(pruefeMbgmPaket(saetze).filter((b) => b.code === 'F9031').length, 1);
});

test('F9070: das Paket muss mit PS/PV beginnen und mit PE enden', () => {
  const saetze = erstelleMbgmPaket([MELDUNG], OPT);
  assert.equal(
    pruefeMbgmPaket(saetze.slice(1)).some((b) => b.code === 'F9070'),
    true,
  );
  assert.equal(
    pruefeMbgmPaket([]).some((b) => b.code === 'F9070'),
    true,
  );
});

test('F9072: die Hoechstanzahl der Verrechnungspositionen ist eine Warnung', () => {
  // erstelleMbgmPaket weist das inzwischen selbst ab (E.32.2.2.5), deshalb hier
  // eine von Hand gebaute Folge: Die Pruefung soll die Warnung auch dann
  // nennen, wenn die Saetze aus einer anderen Quelle stammen.
  const saetze = [
    {
      satzart: 'PS',
      werte: { REFP: 'P', BKNR: '1', DGNA: 'D', JAGB: 'N', BZRM: '072026', GSVZ: '+', GSUM: '0', ANZM: '1' },
      felder: [],
      satzlaenge: 0,
    },
    { satzart: 'G1', werte: { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }, felder: [], satzlaenge: 0 },
    { satzart: 'T1', werte: {}, felder: [], satzlaenge: 0 },
    { satzart: 'BS', werte: {}, felder: [], satzlaenge: 0 },
    ...Array.from({ length: HOECHSTANZAHL.verrechnungsposition + 1 }, () => ({
      satzart: 'V1',
      werte: {},
      felder: [],
      satzlaenge: 0,
    })),
    { satzart: 'PE', werte: { REFP: 'P', ANZM: '1' }, felder: [], satzlaenge: 0 },
  ];
  const f = pruefeMbgmPaket(saetze).filter((x) => x.code === 'F9072');
  assert.equal(f.length, 1);
  assert.equal(f[0]?.schwere, 'warnung', 'Status W im Pruefkatalog');
});

test('die Beitragskontonummer wird gegen den Traeger geprueft', () => {
  // Salzburg: sieben Stellen.
  assert.deepEqual(pruefeBeitragskontonummer('1234567', 'ÖGK-S'), []);
  const b = pruefeBeitragskontonummer('12345678', 'ÖGK-S');
  assert.equal(b[0]?.schwere, 'warnung', 'eine abweichende Laenge weist ELDA nicht zurueck');
  assert.match(b[0]?.meldung ?? '', /7/);
  // Unbekannter Traeger: keine Aussage statt einer geratenen.
  assert.deepEqual(pruefeBeitragskontonummer('123', 'IRGENDWER'), []);
});

test('jeder Traeger hat seinen EIGENEN Fehlercode', () => {
  // Der Pruefkatalog vergibt je Traeger einen eigenen Code; F9013 gilt allein
  // fuer die OeGK-W. Diese Datei meldete bis 04.08.2026 immer F9013 -- fuer
  // neun von zehn Traegern der falsche. Wer ihn im Ruecksendungsprotokoll
  // nachschlaegt, landet beim falschen Bundesland.
  const erwartet: Record<string, string> = {
    'ÖGK-W': 'F9013',
    'ÖGK-N': 'F9014',
    'ÖGK-B': 'F9015',
    'ÖGK-O': 'F9016',
    'ÖGK-ST': 'F9017',
    'ÖGK-K': 'F9018',
    'ÖGK-S': 'F9019',
    'ÖGK-T': 'F9080',
    'ÖGK-V': 'F9081',
    BVAEB: 'F9082',
  };
  for (const [traeger, code] of Object.entries(erwartet)) {
    // Eine Nummer, die fuer keinen Traeger die richtige Laenge hat.
    const b = pruefeBeitragskontonummer('123', traeger).filter((x) => x.schwere === 'warnung');
    assert.equal(b[0]?.code, code, `${traeger} muss ${code} melden`);
  }
});

test('F9012: bei der OeGK-V weist ein fuehrendes Leerzeichen die Meldung ZURUECK', () => {
  // Die einzige traegerbezogene BKNR-Pruefung mit Status N. Geprueft wird der
  // rohe Wert -- wer vorher trimmt, sieht den Fehler nie.
  const b = pruefeBeitragskontonummer(' 12345', 'ÖGK-V');
  const f9012 = b.find((x) => x.code === 'F9012');
  assert.equal(f9012?.schwere, 'fehler');

  // Ohne Leerzeichen ist dieselbe Nummer in Ordnung (Vorarlberg: sechs Stellen).
  assert.deepEqual(pruefeBeitragskontonummer('123456', 'ÖGK-V'), []);
  // Und die Regel gilt NUR fuer die OeGK-V.
  assert.equal(
    pruefeBeitragskontonummer(' 234567', 'ÖGK-S').some((x) => x.code === 'F9012'),
    false,
  );
});

test('F9000 gilt auch fuer den Ende-Satz, nicht nur fuer den Kopf', () => {
  // Der Katalog nennt PS, PV UND PE. Der Referenzwert ist auch im Ende-Satz
  // Pflicht; geprueft wurde bis 04.08.2026 nur der Kopf.
  const ohneRefpImEnde = [
    roh('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '0',
      ANZM: '0',
    }),
    roh('PE', { ANZM: '0' }),
  ];
  const f = pruefeMbgmPaket(ohneRefpImEnde).filter((x) => x.code === 'F9000');
  assert.equal(f.length, 1);
  assert.match(f[0]?.meldung ?? '', /Ende-Satz/);
});

// --- Grundsaetze aus E.32.2.2.2 -------------------------------------------

/** Baut eine Satzfolge aus Satzart und Werten; Feldtabelle spielt hier keine Rolle. */
const roh = (satzart: string, werte: Record<string, string | undefined> = {}) => ({
  satzart,
  werte,
  felder: [],
  satzlaenge: 0,
});

test('Storno-Meldungen werden von der Gesamtsumme ABGEZOGEN, nicht addiert', () => {
  // E.32.2.2.2, Grundsaetze fuer das Storno (Selbstabrechnung), Punkt 4:
  // "Allerdings ist bei der Summierung der mBGM in einem mBGM-Paket (im
  // Datenfeld GSUM) die VSUM der Storno-mBGM abzuziehen."
  const saetze = [
    roh('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '3000',
      ANZM: '2',
    }),
    roh('R1', { REFW: 'S1', REFU: 'ALT', VSNR: '1234010180', VSUM: '5000' }),
    roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '8000' }),
    roh('PE', { REFP: 'P', ANZM: '2' }),
  ];
  // 8000 - 5000 = 3000
  assert.deepEqual(
    pruefeMbgmPaket(saetze).filter((b) => b.code === 'F9051'),
    [],
  );

  const falsch = [...saetze];
  falsch[0] = roh('PS', { ...saetze[0]!.werte, GSUM: '13000' });
  const b = pruefeMbgmPaket(falsch).filter((x) => x.code === 'F9051');
  assert.equal(b.length, 1, 'die Summe 8000+5000 waere falsch');
});

test('je Versichertem ist nur eine mBGM pro Beschaeftigungsfolge zulaessig', () => {
  // "Auch wenn z.B. in einem Kalendermonat mehrere (regelmaessige)
  // Beschaeftigungen liegen, ist nur eine mBGM zulaessig."
  const zweimalRegelmaessig = [
    roh('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '0',
      ANZM: '2',
    }),
    roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
    roh('G1', { REFW: 'M2', VSNR: '1234010180', VSUM: '0' }),
    roh('PE', { REFP: 'P', ANZM: '2' }),
  ];
  const b = pruefeMbgmPaket(zweimalRegelmaessig);
  assert.equal(
    b.some((x) => /Beschäftigungsfolge/.test(x.meldung)),
    true,
  );
});

test('verschiedene Beschaeftigungsfolgen desselben Versicherten sind erlaubt', () => {
  const gemischt = [
    roh('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '0',
      ANZM: '2',
    }),
    roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
    roh('G3', { REFW: 'M2', VSNR: '1234010180', VSUM: '0' }),
    roh('PE', { REFP: 'P', ANZM: '2' }),
  ];
  assert.equal(
    pruefeMbgmPaket(gemischt).some((x) => /Beschäftigungsfolge/.test(x.meldung)),
    false,
  );
});

test('ein Storno und die neue Meldung desselben Versicherten sind erlaubt', () => {
  // Grundsatz 1 der Storno-Regeln verlangt genau das: "Bei Aenderungen einer
  // mBGM ist im Bereich der Selbstabrechnung immer ein Storno der zuletzt
  // uebermittelten mBGM mit nachfolgender neuer mBGM erforderlich."
  const stornoUndNeu = [
    roh('PS', {
      REFP: 'P',
      BKNR: '1',
      DGNA: 'D',
      JAGB: 'N',
      BZRM: '072026',
      GSVZ: '+',
      GSUM: '0',
      ANZM: '2',
    }),
    roh('R1', { REFW: 'S1', REFU: 'ALT', VSNR: '1234010180', VSUM: '0' }),
    roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
    roh('PE', { REFP: 'P', ANZM: '2' }),
  ];
  assert.equal(
    pruefeMbgmPaket(stornoUndNeu).some((x) => /Beschäftigungsfolge/.test(x.meldung)),
    false,
  );
});

// --- ÖGK-FAK 3.1.11: nur ein Tarifblock je mBGM ---------------------------

/** Rahmen um eine mBGM samt ihrer Untersaetze. */
function paket(...inhalt: ReturnType<typeof roh>[]) {
  const kopf = {
    REFP: 'P',
    BKNR: '1',
    DGNA: 'D',
    JAGB: 'N',
    BZRM: '072026',
    GSVZ: '+',
    GSUM: '0',
    ANZM: '1',
  };
  return [roh('PS', kopf), ...inhalt, roh('PE', { REFP: 'P', ANZM: '1' })];
}

const FAK_TARIFBLOCK = /FAK-3\.1\.11/;

test('FAK 3.1.11: zwei Tarifbloecke bei regelmaessiger Beschaeftigung sind eine Warnung', () => {
  const befunde = pruefeMbgmPaket(
    paket(
      roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
      roh('T1', {}),
      roh('BS', {}),
      roh('V1', {}),
      roh('T1', {}),
      roh('BS', {}),
      roh('V1', {}),
    ),
  );
  const treffer = befunde.filter((b) => FAK_TARIFBLOCK.test(b.code));
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0]?.schwere, 'warnung', 'ELDA weist deswegen nichts zurueck');
  assert.match(treffer[0]?.meldung ?? '', /1234010180/);
});

test('FAK 3.1.11: ein Tarifblock ist der Regelfall und schweigt', () => {
  const befunde = pruefeMbgmPaket(
    paket(
      roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
      roh('T1', {}),
      roh('BS', {}),
      roh('V1', {}),
    ),
  );
  assert.equal(
    befunde.some((b) => FAK_TARIFBLOCK.test(b.code)),
    false,
  );
});

test('FAK 3.1.11 gilt nicht fuer fallweise und kuerzer als einen Monat', () => {
  // FAK 3.2.8: "bei diesen mBGM wird ja pro Beschaeftigungszeit je ein
  // Tarifblock gemeldet" — mehrere Bloecke sind dort der Normalfall.
  for (const [mbgm, block] of [
    ['G3', 'T2'],
    ['G5', 'T3'],
  ] as const) {
    const befunde = pruefeMbgmPaket(
      paket(
        roh(mbgm, { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }),
        roh(block, {}),
        roh('BS', {}),
        roh('V1', {}),
        roh(block, {}),
        roh('BS', {}),
        roh('V1', {}),
      ),
    );
    assert.equal(
      befunde.some((b) => FAK_TARIFBLOCK.test(b.code)),
      false,
      `${mbgm}/${block} darf mehrere Tarifbloecke haben`,
    );
  }
});

test('FAK 3.1.11: der Tarifblock ohne Verrechnung (T4) zaehlt mit', () => {
  // T1 und T4 sind derselbe Tarifblock der regelmaessigen Beschaeftigung, nur
  // einmal mit und einmal ohne Verrechnung. Zwei davon sind zwei Bloecke.
  const befunde = pruefeMbgmPaket(
    paket(roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }), roh('T4', {}), roh('T4', {})),
  );
  assert.equal(
    befunde.some((b) => FAK_TARIFBLOCK.test(b.code)),
    true,
  );
});

test('FAK-Befunde sind am Praefix von den Pruefkatalog-Codes unterscheidbar', () => {
  // Wer nur wissen will, ob ELDA das Paket zurueckweist, filtert ueber das
  // Praefix — der Katalog vergibt fuer diese Regel keinen Code.
  const befunde = pruefeMbgmPaket(
    paket(roh('G1', { REFW: 'M1', VSNR: '1234010180', VSUM: '0' }), roh('T1', {}), roh('T1', {})),
  );
  for (const b of befunde.filter((x) => !x.code.startsWith('F'))) {
    assert.match(b.code, /^FAK-/);
    assert.equal(b.schwere, 'warnung');
  }
});

test('F9051 liest das Vorzeichen der Gesamtsumme aus GSVZ, nicht aus GSUM', () => {
  // GSUM traegt kein Vorzeichen -- das steht getrennt in GSVZ. Ein reines
  // Stornopaket hat deshalb einen positiven GSUM und GSVZ = '-'. Wer nur GSUM
  // liest, haelt jedes Storno des Dokuments fuer falsch.
  const storno = erstelleMbgmPaket(
    [
      {
        referenzwert: 'S-1',
        referenzUrspruenglicheMeldung: 'M-1',
        versicherungsnummer: '1234010180',
        summeCent: 79_200,
      },
    ],
    OPT,
  );
  assert.equal(storno[0]?.werte.GSVZ, '-');
  assert.equal(storno[0]?.werte.GSUM, '79200', 'der Betrag steht ohne Vorzeichen');
  assert.deepEqual(
    pruefeMbgmPaket(storno).filter((b) => b.code === 'F9051'),
    [],
  );

  // Und andersherum: dasselbe Paket mit '+' ist tatsaechlich falsch.
  const verdreht = storno.map((s) => (s.satzart === 'PS' ? { ...s, werte: { ...s.werte, GSVZ: '+' } } : s));
  assert.equal(pruefeMbgmPaket(verdreht).filter((b) => b.code === 'F9051').length, 1);
});
