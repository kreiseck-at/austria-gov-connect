import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '@kreiseck/finanzonline-core';
import { createRksv } from './index';

// Opt-in-Integrationstest gegen den echten rkdb-Webservice.
//
// Läuft NUR, wenn alle vier Zugangsdaten als Umgebungsvariablen gesetzt sind;
// ohne sie wird der Test übersprungen. Diese Datei enthält KEINE Zugangsdaten.
//
// Nicht-registrierend: login -> Statusabfrage einer nicht existierenden Kasse
// (verändert nichts) -> logout. uebermittlung 'test' => art_uebermittlung 'T'.
//
// Ausführen:
//   FON_TID=… FON_BENID=… FON_PIN=… FON_HERSTELLER_UID=… \
//     npm test -w @kreiseck/rksv

const tid = process.env.FON_TID;
const benid = process.env.FON_BENID;
const pin = process.env.FON_PIN;
const herstellerid = process.env.FON_HERSTELLER_UID;
const konfiguriert = Boolean(tid && benid && pin && herstellerid);

test(
  'Integration: rkdb Statusabfrage einer nicht registrierten Kasse',
  { skip: konfiguriert ? false : 'FON_TID/FON_BENID/FON_PIN/FON_HERSTELLER_UID nicht gesetzt' },
  async () => {
    const session = await createSession({
      tid: tid!,
      benid: benid!,
      pin: pin!,
      herstellerid: herstellerid!,
    });
    try {
      const rksv = createRksv({ session, uebermittlung: 'test' });
      const erg = await rksv.status.kasse({
        paketNr: 1,
        kassenidentifikationsnummer: 'KREISECK-TEST-DOESNOTEXIST',
      });
      assert.equal(erg.ok, false, 'nicht registrierte Kasse darf nicht ok sein');
      assert.equal(erg.status, undefined, 'nicht registrierte Kasse hat kein Statusergebnis');
      assert.ok(erg.rc.length > 0, 'Returncode muss vorhanden sein');
    } finally {
      await session.logout();
    }
  },
);
