// Reproduzierbarer Live-Check gegen die ECHTEN Dienste. NICHT Teil von `npm test`.
// Zweck: "ab und zu" gegen VIES/FON prüfen, bis für alle Fälle echte Antworten
// vorliegen (v. a. wenn ein Mitgliedstaat gerade nicht erreichbar ist).
//
//   node packages/uid/test/live/live-check.js
//
// VIES (keyless) läuft immer. Steuerung per Env:
//   UID_ZIEL     einzelne Ziel-UID (Default: DE289901008 — DE für den Hauptfall)
//   UID_LISTE    Komma-Liste weiterer UIDs für pruefe
//   UID_ANTRAGSTELLER  eigene UID (ATU…) für bestaetige/FON (Default: nur wenn gesetzt)
//
// FON-UID (nur mit vollständigen Creds, sonst übersprungen):
//   FON_TEST_TID, FON_TEST_BENID, FON_TEST_PIN, HERSTELLER_ID (oder FON_TEST_HERSTELLER)
//   Hinweis: FON-UID ist auf 2 Abfragen/Tag pro UID limitiert und braucht ein
//   für die UID-Abfrage freigeschaltetes Konto (sonst rc -4 nicht_berechtigt).

const { createUid, viesPruefe, viesStatus } = require('../../dist/index.js');

const ZIEL = process.env.UID_ZIEL || 'DE289901008';
const LISTE = (process.env.UID_LISTE || '').split(',').map((s) => s.trim()).filter(Boolean);
const ANTRAGSTELLER = process.env.UID_ANTRAGSTELLER || '';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function vies() {
  console.log('=== VIES check-status ===');
  try {
    const s = await viesStatus();
    console.log('vow:', s.vowVerfuegbar, '| DE:', s.land.DE, '| AT:', s.land.AT);
  } catch (e) {
    console.log('viesStatus Fehler:', e.message);
  }

  console.log('\n=== VIES pruefe ===');
  for (const u of [ZIEL, ...LISTE]) {
    try {
      const r = await viesPruefe(u);
      const extra =
        r.ergebnis === 'gueltig'
          ? ` | ${r.name || '(kein Name)'}`
          : ` | ${r.grund || '-'} (${r.rohRc || '-'})`;
      console.log(`${u.padEnd(14)} -> ${r.ergebnis}${extra}`);
    } catch (e) {
      console.log(`${u.padEnd(14)} -> wirft ${e.constructor.name}: ${e.message}`);
    }
    await pause(500);
  }

  if (ANTRAGSTELLER) {
    console.log('\n=== VIES bestaetige (Konsultationsnummer) ===');
    const uid = createUid({ antragsteller: ANTRAGSTELLER });
    try {
      const r = await uid.bestaetige({ uid: ZIEL });
      console.log(`${ZIEL} -> ${r.ergebnis} | nachweis=${r.nachweis ? r.nachweis.id : '(keine)'}`);
    } catch (e) {
      console.log(`${ZIEL} -> wirft ${e.constructor.name}: ${e.message}`);
    }
  }
}

async function fon() {
  const herst = process.env.HERSTELLER_ID || process.env.FON_TEST_HERSTELLER;
  const { FON_TEST_TID: tid, FON_TEST_BENID: benid, FON_TEST_PIN: pin } = process.env;
  if (!(tid && benid && pin && herst && ANTRAGSTELLER)) {
    console.log('\n=== FON-UID übersprungen (FON_TEST_*/HERSTELLER_ID/UID_ANTRAGSTELLER nicht vollständig gesetzt) ===');
    return;
  }
  const { createSession } = require('@kreiseck/finanzonline-core');
  console.log('\n=== FON-UID fon.abfrage (Stufe 2) ===');
  let session;
  try {
    session = await createSession({ tid, benid, pin, herstellerid: herst });
  } catch (e) {
    console.log('FON-Login Fehler:', e.message);
    return;
  }
  try {
    const uid = createUid({ antragsteller: ANTRAGSTELLER, session });
    const r = await uid.fon.abfrage({ uid: ZIEL, stufe: 2 });
    console.log(`${ZIEL} -> ${r.ergebnis} (rc ${r.rohRc})${r.name ? ' | ' + r.name : ''}`);
  } catch (e) {
    console.log(`${ZIEL} -> wirft ${e.constructor.name}: ${e.message}`);
  } finally {
    await session.logout();
  }
}

(async () => {
  await vies();
  await fon();
})();
