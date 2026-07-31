import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgangErgebnis, vorgangKlasse, type VorgangKlasse } from './urteil';
import { RKDB_RC } from './returncodes';
import type { Vorgang } from './vorgaenge';

// Jeder Fall hier war einmal ein echter Fehler in Produktion. Die Testnamen
// benennen ihn, damit später niemand die Zuordnung „aufräumt".

const ALLE: readonly VorgangKlasse[] = [
  'registrierung',
  'ausfall',
  'ausserbetriebnahme',
  'wiederinbetriebnahme',
];

test('rc 0 heißt bei jeder Vorgangsklasse: Ziel erreicht', () => {
  for (const k of ALLE) {
    const u = vorgangErgebnis(k, { rc: '0', msg: '' });
    assert.equal(u.zielerreicht, true, k);
    assert.equal(u.bereitsSo, false, k);
    assert.equal(u.statusUnklar, false, k);
  }
});

test('B6 bei Außerbetriebnahme: Ziel erreicht — der Altfall blieb sonst unheilbar', () => {
  const u = vorgangErgebnis('ausserbetriebnahme', { rc: 'B6', msg: 'bereits erfolgt' });
  assert.equal(u.zielerreicht, true);
  assert.equal(u.bereitsSo, true);
  assert.equal(u.statusUnklar, false);
});

test('B6 bei Wiederinbetriebnahme: abgelehnt — eine abgemeldete Einheit läuft nicht wieder an', () => {
  const u = vorgangErgebnis('wiederinbetriebnahme', { rc: 'B6', msg: 'bereits erfolgt' });
  assert.equal(u.zielerreicht, false);
  assert.equal(u.statusUnklar, false);
});

test('B6 bei Ausfall und Registrierung: abgelehnt', () => {
  assert.equal(vorgangErgebnis('ausfall', { rc: 'B6' }).zielerreicht, false);
  assert.equal(vorgangErgebnis('registrierung', { rc: 'B6' }).zielerreicht, false);
});

test('B13 bei Wiederinbetriebnahme: Ziel erreicht — nicht jede Antwort ist ein Erfolg, diese aber schon', () => {
  const u = vorgangErgebnis('wiederinbetriebnahme', { rc: 'B13', msg: 'Status bereits gesetzt' });
  assert.equal(u.zielerreicht, true);
  assert.equal(u.bereitsSo, true);
});

test('B13 bei Ausfall: Ziel erreicht', () => {
  const u = vorgangErgebnis('ausfall', { rc: 'B13' });
  assert.equal(u.zielerreicht, true);
  assert.equal(u.bereitsSo, true);
});

test('B13 bei Außerbetriebnahme: abgelehnt', () => {
  assert.equal(vorgangErgebnis('ausserbetriebnahme', { rc: 'B13' }).zielerreicht, false);
});

test('B10 bei Registrierung: weder Erfolg noch schlichte Ablehnung, sondern Zustand unklar', () => {
  const u = vorgangErgebnis('registrierung', { rc: 'B10', msg: 'bereits gespeichert' });
  assert.equal(u.zielerreicht, false, 'als Erfolg gewertet hat eine Abmeldung lokal überschrieben');
  assert.equal(u.statusUnklar, true);
  assert.equal(u.bereitsSo, false);
});

test('B1 bei Registrierung: Zustand unklar — der Kassen-Zwilling zu B10', () => {
  const u = vorgangErgebnis('registrierung', { rc: 'B1' });
  assert.equal(u.statusUnklar, true);
  assert.equal(u.zielerreicht, false);
});

test('B10/B1 außerhalb der Registrierung: abgelehnt, nicht unklar', () => {
  for (const k of ALLE.filter((x) => x !== 'registrierung')) {
    for (const rc of ['B1', 'B10']) {
      const u = vorgangErgebnis(k, { rc });
      assert.equal(u.statusUnklar, false, `${k}/${rc}`);
      assert.equal(u.zielerreicht, false, `${k}/${rc}`);
    }
  }
});

test('B32/B33 bleiben Ablehnung — „nicht registriert ODER abgemeldet" ist nicht auflösbar', () => {
  for (const k of ALLE) {
    for (const rc of ['B32', 'B33']) {
      const u = vorgangErgebnis(k, { rc });
      assert.equal(u.zielerreicht, false, `${k}/${rc}`);
      assert.equal(u.statusUnklar, false, `${k}/${rc}`);
    }
  }
});

test('unbekannter Returncode: abgelehnt, nie Ziel erreicht', () => {
  for (const k of ALLE) {
    const u = vorgangErgebnis(k, { rc: 'ZZZ', msg: '' });
    assert.equal(u.zielerreicht, false);
    assert.equal(u.statusUnklar, false);
  }
});

test('leerer Returncode: abgelehnt', () => {
  assert.equal(vorgangErgebnis('registrierung', { rc: '' }).zielerreicht, false);
});

test('zielerreicht und statusUnklar nie zugleich, bereitsSo nie ohne zielerreicht — über den ganzen Katalog', () => {
  for (const k of ALLE) {
    for (const rc of [...Object.keys(RKDB_RC), '', 'UNBEKANNT']) {
      const u = vorgangErgebnis(k, { rc });
      assert.equal(u.zielerreicht && u.statusUnklar, false, `${k}/${rc}`);
      if (u.bereitsSo) assert.equal(u.zielerreicht, true, `${k}/${rc}`);
    }
  }
});

test('rc und msg werden unverändert durchgereicht', () => {
  const u = vorgangErgebnis('ausfall', { rc: 'B18', msg: 'irgendein Text' });
  assert.equal(u.rc, 'B18');
  assert.equal(u.msg, 'irgendein Text');
});

test('wiederholbar folgt istWiederholbar — ein interner Fehler bleibt einen Versuch wert', () => {
  assert.equal(vorgangErgebnis('registrierung', { rc: '1336' }).wiederholbar, true);
  assert.equal(vorgangErgebnis('registrierung', { rc: 'B10' }).wiederholbar, false);
});

// ---------------------------------------------------------------------------
// vorgangKlasse: die Klasse aus dem tatsächlich gesendeten Vorgang ableiten
// ---------------------------------------------------------------------------

test('vorgangKlasse trennt Ausfall und Außerbetriebnahme, obwohl beide im ausfall_se-Vorgang stecken', () => {
  const ausfall: Vorgang = {
    art: 'ausfall_se',
    zertifikatsseriennummer: '1B9066BE',
    ausfall: { begruendung: 2, beginn: new Date('2026-01-01T00:00:00Z') },
  };
  const abn: Vorgang = {
    art: 'ausfall_se',
    zertifikatsseriennummer: '1B9066BE',
    ausserbetriebnahme: { begruendung: 7 },
  };
  assert.equal(vorgangKlasse(ausfall), 'ausfall');
  assert.equal(vorgangKlasse(abn), 'ausserbetriebnahme');
});

test('vorgangKlasse: Kasse und SEE fallen in dieselbe Klasse', () => {
  assert.equal(
    vorgangKlasse({
      art: 'registrierung_kasse',
      kassenidentifikationsnummer: 'K1',
      benutzerschluessel: 'a'.repeat(44),
    }),
    'registrierung',
  );
  assert.equal(
    vorgangKlasse({ art: 'registrierung_se', artSe: 'SIGNATURKARTE', vdaId: 'AT1', zertifikatsseriennummer: 'AB' }),
    'registrierung',
  );
  assert.equal(
    vorgangKlasse({ art: 'wiederinbetriebnahme_kasse', kassenidentifikationsnummer: 'K1', ende: new Date() }),
    'wiederinbetriebnahme',
  );
  assert.equal(
    vorgangKlasse({ art: 'wiederinbetriebnahme_se', zertifikatsseriennummer: 'AB', ende: new Date() }),
    'wiederinbetriebnahme',
  );
});

test('vorgangKlasse der Belegprüfung ist null — sie liefert Daten, kein Ziel', () => {
  assert.equal(vorgangKlasse({ art: 'belegpruefung', beleg: '_R1-AT0_K1_1_2026-01-01T00:00:00_1,00' }), null);
});

test('das gemessene Zusammenspiel: Außerbetriebnahme quittiert mit B6 gilt als erledigt', () => {
  // 0x6F0404F0 war bereits abgemeldet; der zweite Versuch kam mit B6 zurück.
  // Zuvor galt das als Fehler und der Datensatz blieb unheilbar stehen.
  const v: Vorgang = {
    art: 'ausfall_se',
    zertifikatsseriennummer: '6F0404F0',
    ausserbetriebnahme: { begruendung: 6 },
  };
  const klasse = vorgangKlasse(v);
  assert.notEqual(klasse, null);
  const u = vorgangErgebnis(klasse!, { rc: 'B6', msg: 'Außerbetriebnahme bereits erfolgt' });
  assert.equal(u.zielerreicht, true);
  assert.equal(u.bereitsSo, true);
});
