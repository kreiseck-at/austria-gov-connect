// Reproduzierbarer DataBox-Live-Check gegen den ECHTEN Dienst. NICHT Teil von `npm test`.
//   node packages/finanzonline/test/live/live-check.js
//
// Standard: read-only `liste()` gegen den ÖFFENTLICHEN BMF-Test-Teilnehmer
// (aus dem DataBox-Handbuch): tid=1000103u3032, benid=webserv99, pin=webserv99.
// Nur die herstellerid muss gesetzt sein (Software-Hersteller-ID):
//   HERSTELLER_ID (oder FON_TEST_HERSTELLER)
// Eigene Creds überschreiben die Defaults: FON_TEST_TID/BENID/PIN.
// DATABOX_EINTRAG=1 lädt zusätzlich EINEN XML-Eintrag (markiert ihn als gelesen!).

const { createDatabox } = require('../../dist/index.js');
const { createSession } = require('@kreiseck/finanzonline-core');

const herstellerid = process.env.HERSTELLER_ID || process.env.FON_TEST_HERSTELLER;
const tid = process.env.FON_TEST_TID || '1000103u3032';
const benid = process.env.FON_TEST_BENID || 'webserv99';
const pin = process.env.FON_TEST_PIN || 'webserv99';

(async () => {
  if (!herstellerid) {
    console.log('Übersprungen: HERSTELLER_ID (oder FON_TEST_HERSTELLER) nicht gesetzt.');
    return;
  }
  let session;
  try {
    session = await createSession({ tid, benid, pin, herstellerid });
    console.log('Login ok (Teilnehmer', tid + ').');
  } catch (e) {
    console.log('Login Fehler (' + e.constructor.name + '):', e.message);
    return;
  }
  try {
    const db = createDatabox(session);
    console.log('\n=== liste() (read-only) ===');
    const alle = await db.liste({});
    console.log('Einträge:', alle.length);
    for (const e of alle.slice(0, 10)) {
      console.log(`  ${String(e.erltyp).padEnd(3)}/${String(e.anbringen).padEnd(9)} ${e.fileart} key=${e.applkey} "${(e.betreff || e.filebez || '').slice(0, 40)}"`);
    }

    if (process.env.DATABOX_EINTRAG === '1') {
      const ziel = alle.find((e) => e.fileart === 'XML');
      if (ziel) {
        console.log('\n=== eintrag() an EINEM XML-Eintrag (markiert als gelesen) ===');
        const res = await db.eintrag(ziel.applkey, ziel.fileart);
        console.log('fileart:', res.fileart, '| Bytes:', res.inhalt.length, '| valides XML?', /^\s*<\?xml|^\s*</.test(res.inhalt.toString('utf8')));
      }
    }
  } finally {
    await session.logout();
    console.log('\nLogout ok.');
  }
})();
