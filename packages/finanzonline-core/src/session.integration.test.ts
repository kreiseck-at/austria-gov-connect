import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from './index';

// Opt-in-Integrationstest gegen den echten FinanzOnline Session-Webservice.
//
// Läuft NUR, wenn alle vier Zugangsdaten als Umgebungsvariablen gesetzt sind;
// ohne sie wird der Test übersprungen und ist damit nicht Teil des normalen
// Standardlaufs. Diese Datei enthält KEINE Zugangsdaten — sie kommen
// ausschließlich aus der Umgebung. Es werden keine Fachdaten übermittelt:
// nur ein login und ein sofortiges logout.
//
// Ausführen:
//   FON_TID=… FON_BENID=… FON_PIN=… FON_HERSTELLER_UID=… \
//     npm test -w @kreiseck/finanzonline-core

const tid = process.env.FON_TID;
const benid = process.env.FON_BENID;
const pin = process.env.FON_PIN;
const herstellerid = process.env.FON_HERSTELLER_UID;
const konfiguriert = Boolean(tid && benid && pin && herstellerid);

test(
  'Integration: login und logout gegen den FinanzOnline Session-Webservice',
  { skip: konfiguriert ? false : 'FON_TID/FON_BENID/FON_PIN/FON_HERSTELLER_UID nicht gesetzt' },
  async () => {
    const session = await createSession({
      tid: tid!,
      benid: benid!,
      pin: pin!,
      herstellerid: herstellerid!,
    });
    assert.ok(session.id.length > 0, 'Session-ID muss nach erfolgreichem Login vorhanden sein');
    await session.logout();
  },
);
