import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeAbfolge, ABFOLGE } from './abfolge-e32';
import { erstelleMbgmPaket, VERRECHNUNGSGRUNDLAGE, type PaketOptionen } from './mbgm';
import type { RohSatz } from './bestand';

const OPT: PaketOptionen = {
  verfahren: 'selbstabrechnung',
  paketreferenzwert: 'P-1',
  beitragskontonummer: '1234567',
  dienstgebername: 'Musterbetrieb',
  beitragszeitraum: '072026',
  jaehrlicheAbrechnungGeringfuegiger: false,
};

const MELDUNG = {
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
          typ: 'AB' as const,
          betragCent: 200_000,
          positionen: [{ typ: 'T01' as const, prozentsatz: 39.6, betragCent: 79_200 }],
        },
      ],
    },
  ],
};

/** Baut eine Satzfolge nur aus Satzarten -- die Werte spielen hier keine Rolle. */
const folge = (...arten: string[]): RohSatz[] =>
  arten.map((satzart) => ({ satzart, werte: {}, felder: [], satzlaenge: 0 }));

test('die erzeugten Pakete beider Verfahren sind zulaessig', () => {
  assert.deepEqual(pruefeAbfolge(erstelleMbgmPaket([MELDUNG], OPT)), []);
  assert.deepEqual(
    pruefeAbfolge(
      erstelleMbgmPaket(
        [
          {
            ...MELDUNG,
            tarifbloecke: [
              {
                ...MELDUNG.tarifbloecke[0]!,
                basen: [{ typ: 'AB', betragCent: 1, positionen: [{ typ: 'T01' }] }],
              },
            ],
          },
        ],
        { ...OPT, verfahren: 'vorschreibung' },
      ),
    ),
    [],
  );
});

test('ein Tarifblock direkt nach dem Paket ist unzulaessig', () => {
  const b = pruefeAbfolge(folge('PS', 'T1', 'PE'));
  assert.equal(b.length >= 1, true);
  assert.equal(b[0]?.code, 'F9070');
  assert.match(b[0]?.meldung ?? '', /Auf 'PS' darf 'T1' nicht folgen/);
});

test('eine Verrechnungsposition ohne vorangehende Basis ist unzulaessig', () => {
  const b = pruefeAbfolge(folge('PS', 'G1', 'T1', 'V1', 'PE'));
  assert.equal(
    b.some((x) => /Auf 'T1' darf 'V1' nicht folgen/.test(x.meldung)),
    true,
  );
});

test('nach einer Verrechnungsposition darf nur ein zur mBGM passender Tarifblock folgen', () => {
  // Fussnoten 70-75: V1 -> T1/T4 nur bei G1, T2/T5 nur bei G3, T3/T6 nur bei G5.
  assert.deepEqual(pruefeAbfolge(folge('PS', 'G1', 'T1', 'BS', 'V1', 'T1', 'BS', 'V1', 'PE')), []);
  const falsch = pruefeAbfolge(folge('PS', 'G1', 'T1', 'BS', 'V1', 'T2', 'BS', 'V1', 'PE'));
  assert.equal(
    falsch.some((x) => /'T2' nicht folgen/.test(x.meldung)),
    true,
  );
  // Bei G3 ist es umgekehrt.
  assert.deepEqual(pruefeAbfolge(folge('PS', 'G3', 'T2', 'BS', 'V1', 'T2', 'BS', 'V1', 'PE')), []);
});

test('das Storno kommt ohne Tarifblock aus', () => {
  assert.deepEqual(pruefeAbfolge(folge('PS', 'R1', 'PE')), []);
  const b = pruefeAbfolge(folge('PS', 'R1', 'T1', 'PE'));
  assert.equal(
    b.some((x) => /Auf 'R1' darf 'T1' nicht folgen/.test(x.meldung)),
    true,
  );
});

test('mBGM ohne Versicherten ist ohne BMJ-Freigabe gesperrt', () => {
  // Fussnoten 67-69: G7/R7 sind "nur fuer das BMJ".
  const b = pruefeAbfolge(folge('PS', 'G7', 'T1', 'BS', 'V1', 'PE'));
  assert.equal(
    b.some((x) => /'G7' nicht folgen/.test(x.meldung)),
    true,
  );
  assert.deepEqual(pruefeAbfolge(folge('PS', 'G7', 'T1', 'BS', 'V1', 'PE'), true), []);
});

test('die Verfahren duerfen nicht vermischt werden', () => {
  // BV/V2 gehoeren zum Vorschreiber und haben im PS-Paket nichts verloren.
  const b = pruefeAbfolge(folge('PS', 'G1', 'T1', 'BV', 'V2', 'PE'));
  assert.equal(
    b.some((x) => /Auf 'T1' darf 'BV' nicht folgen/.test(x.meldung)),
    true,
  );
});

test('mehrere Tarifbloecke ohne Verrechnung duerfen aufeinander folgen', () => {
  assert.deepEqual(pruefeAbfolge(folge('PS', 'G1', 'T4', 'T4', 'T1', 'BS', 'V1', 'PE')), []);
});

test('NEXT enthaelt PE, sonst koennte kein Paket enden', () => {
  // Die Anmerkung des Dokuments zaehlt an dieser Stelle PS statt PE auf --
  // siehe die Begruendung in abfolge-e32.ts. Ohne PE waere jede Satzfolge
  // unzulaessig, weil PE von keiner anderen Satzart aus erreichbar ist.
  assert.equal(ABFOLGE.nextSelbstabrechnung.includes('PE'), true);
  assert.equal(ABFOLGE.nextVorschreibung.includes('PE'), true);
});

test('nach dem Paket-Ende darf ein weiteres Paket folgen', () => {
  assert.deepEqual(pruefeAbfolge(folge('PS', 'R1', 'PE', 'PS')), []);
  // Auch eines des anderen Verfahrens (Fussnoten 76 und 82).
  assert.deepEqual(pruefeAbfolge(folge('PS', 'R1', 'PE', 'PV')), []);
});
