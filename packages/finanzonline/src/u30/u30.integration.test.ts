// Integrationstest gegen das echte FinanzOnline — NUR Testmodus (uebermittlung T).
// Läuft nur, wenn alle Variablen gesetzt sind, sonst übersprungen (CI ohne Zugang bleibt grün):
//   FON_TID=… FON_BENID=… FON_PIN=… FON_HERSTELLER_UID=… FON_STNR=… \
//     npm test -w @kreiseck/finanzonline
// FON_STNR = Steuernummer des Teilnehmers (9 Ziffern); gesendet wird eine Nullmeldung für
// das letzte abgeschlossene Quartal. FinanzOnline sperrt nach drei Fehlanmeldungen: Der
// Test meldet sich genau einmal an und bricht bei einem Login-Fehler sofort ab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '@kreiseck/finanzonline-core';
import { createU30 } from './client';
import { laufenderMonat } from './zeitraum';

const env = {
  tid: process.env['FON_TID'],
  benid: process.env['FON_BENID'],
  pin: process.env['FON_PIN'],
  herstellerid: process.env['FON_HERSTELLER_UID'],
  stnr: process.env['FON_STNR'],
};
const vollstaendig = Object.values(env).every((v) => typeof v === 'string' && v.length > 0);

function letztesAbgeschlossenesQuartal(jetzt: Date): { jahr: number; quartal: 1 | 2 | 3 | 4 } {
  const [jahr, monat] = laufenderMonat(jetzt).split('-').map(Number) as [number, number];
  const quartal = Math.floor((monat - 1) / 3) + 1;
  return quartal === 1 ? { jahr: jahr - 1, quartal: 4 } : { jahr, quartal: (quartal - 1) as 1 | 2 | 3 };
}

const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test(
  'U30 Nullmeldung im Testmodus: senden und Protokoll abholen',
  {
    skip: vollstaendig ? false : 'FON_TID/FON_BENID/FON_PIN/FON_HERSTELLER_UID/FON_STNR nicht gesetzt',
    timeout: 240_000,
  },
  async () => {
    const start = new Date();
    // Kein try/catch, kein zweiter Versuch: Ein Login-Fehler beendet den Test sofort.
    const session = await createSession({
      tid: env.tid as string,
      benid: env.benid as string,
      pin: env.pin as string,
      herstellerid: env.herstellerid as string,
    });
    try {
      const u30 = createU30(session);
      const paketNr = (Math.floor(start.getTime() / 1000) % 900_000_000) + 1;
      const r = await u30.sende({
        paketNr,
        erklaerungen: [
          {
            steuernummer: env.stnr as string,
            zeitraum: letztesAbgeschlossenesQuartal(start),
            kennzahlen: { kz000: 0 },
            kundeninfo: 'AGC-Integrationstest',
          },
        ],
      }); // ohne echt → Testmodus
      assert.equal(r.uebermittlung, 'T');
      assert.equal(r.angenommen, true, `rc ${r.rc}: ${r.msg ?? ''}`);

      const fenster = { von: new Date(start.getTime() - 5 * 60_000), paketNr };
      for (let i = 0; i < 12; i++) {
        await warte(15_000);
        const gefunden = await u30.protokolle({ ...fenster, bis: new Date(Date.now() + 5 * 60_000) });
        if (gefunden.length > 0) {
          assert.equal(gefunden[0]?.protokoll.uebermittlung, 'T');
          assert.equal(gefunden[0]?.protokoll.paketNr, paketNr);
          return;
        }
      }
      assert.fail(`Kein Protokoll für Paket ${paketNr} nach 3 Minuten`);
    } finally {
      await session.logout();
    }
  },
);
