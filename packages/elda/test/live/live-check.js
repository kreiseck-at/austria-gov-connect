// Reproduzierbarer Live-Check gegen den ECHTEN ELDA-Transfer-Webservice.
// NICHT Teil von `npm test`.
//
//   npm run test:live --workspace @kreiseck/elda
//   (oder direkt: node packages/elda/test/live/live-check.js)
//
// Zweck: die Fragen beantworten, die die Schnittstellenbeschreibung offen lässt
// (siehe Abschnitt „Reifegrad" der README) — Drahtformat der leeren
// Rücksendungsliste, SOAPAction, created-Format, inline-Base64 vs. MTOM,
// Bezugsgröße der md5, Bestand ohne Satztrenner. Jede Antwort wird als
// nummerierter Befund ausgegeben.
//
// Zugangsdaten (fehlt eines, wird sauber übersprungen):
//   ELDA_SERIENNUMMER
//   ELDA_API_KEY
//   ELDA_KUNDENPASSWORT       Klartext — ODER:
//   ELDA_KUNDENPASSWORT_HASH  fertiger SHA-512-Hex-Digest (128 Zeichen, klein)
//   ELDA_UMGEBUNG             'kundentest' (Default) | 'sit' | 'produktion'
//
// Weder Passwort noch Digest werden je ausgegeben.
//
// Standardmäßig läuft NUR `ruecksendungenAuflisten` — es verändert nichts und
// ist zugleich die Probe auf die Zugangsdaten. Die beiden anderen Methoden sind
// unwiderruflich und deshalb je hinter einer eigenen Freigabe:
//
//   ELDA_TEST_ALLOW_STATE_CHANGE=1  erlaubt `senden` — legt eine ECHTE Sendung
//                                   im Konto an (als Testdaten markiert).
//   ELDA_TEST_ALLOW_EMPFANGEN=1     erlaubt `empfangen` — VERBRAUCHT die
//                                   Rücksendung endgültig, auch für jeden
//                                   anderen Abrufer.
//   ELDA_TEST_PROTOKOLLNUMMER       welche Rücksendung geholt wird; ohne
//                                   Angabe die erste aus der Liste.
//
// Die zu sendende Meldung wird mit den Bausteinen des Pakets selbst gebaut
// (`anmeldung` + `erstelleBestand`) und ist mit erfundenen Werten vorbelegt.
// Jedes Feld ist überschreibbar, damit keine echten Personendaten im Skript
// stehen müssen:
//   ELDA_TEST_M3_<FELD>   z. B. ELDA_TEST_M3_VSNR, ELDA_TEST_M3_FANA,
//                         ELDA_TEST_M3_ADAT … (leerer Wert entfernt das Feld)
//   ELDA_TEST_OBUS        Seriennummer zum Datensammelsystem (7 Ziffern)
//   ELDA_TEST_VSTR        Versicherungsträger, ELDA_TEST_UVST Datenübernehmer
//   ELDA_TEST_DTNR        Datenträgernummer
//   ELDA_TEST_VNMF        Versionsnummer Mitteilungsfile
//   ELDA_TEST_ECHTDATEN=1 setzt PROJ auf 'DM' statt 'TM' (Voreinstellung: TM)
//   ELDA_TEST_HERSTELLER_{NAME,KFZ,PLZ,ORT,STRASSE,TELEFON,SOFTWAREID,MAIL}
//   ELDA_TEST_DATEINAME   Dateiname der Sendung
//
// Der vollständige HTTP-Austausch (Anfrage- und Antwort-Bodys) landet in
// `mitschnitt/` neben diesem Skript — inklusive der Bytes einer abgeholten
// Rücksendung, damit auch bei einem späteren Absturz nichts verloren geht. Das
// Verzeichnis ist gitignoriert; API-Key und Passwort-Hash sind in den
// Anfrage-Mitschnitten geschwärzt.

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  createEldaTransferRoh,
  anmeldung,
  erstelleBestand,
  wochenarbeitszeit,
} = require('../../dist/index.js');

const MITSCHNITT = path.join(__dirname, 'mitschnitt');
const LAUF = new Date().toISOString().replace(/[:.]/g, '-');

/** Schreibt eine Datei in den Mitschnitt und liefert den Pfad zur Ausgabe. */
function schreibe(name, daten) {
  fs.mkdirSync(MITSCHNITT, { recursive: true });
  const ziel = path.join(MITSCHNITT, `${LAUF}-${name}`);
  fs.writeFileSync(ziel, daten);
  return path.relative(process.cwd(), ziel);
}

/** Schwärzt die beiden Geheimnisse in einem Anfrage-Body. */
function redigiere(xml) {
  return xml
    .replace(/<apiKey>[^<]*<\/apiKey>/, '<apiKey>***</apiKey>')
    .replace(/<kundenpasswort>[^<]*<\/kundenpasswort>/, '<kundenpasswort>***</kundenpasswort>');
}

const austausch = [];
const letzter = () => austausch[austausch.length - 1];

/**
 * `fetch`-Ersatz, der Anfrage und Antwort mitschreibt. Die Antwort wird als
 * Bytes gelesen und unverändert neu verpackt weitergereicht — so bleibt eine
 * eventuelle MTOM-/Binärantwort im Mitschnitt exakt erhalten, während der
 * Client sie wie eine gewöhnliche Antwort verarbeitet.
 */
async function mitschnittFetch(url, init) {
  const nr = String(austausch.length + 1).padStart(2, '0');
  const methode = /<v4:(\w+)/.exec(init.body)?.[1] ?? 'unbekannt';
  const eintrag = { nr, methode, url, anfrageHeader: init.headers, anfrageBody: init.body };
  austausch.push(eintrag);

  const kopf = [`POST ${url}`, ...Object.entries(init.headers).map(([k, v]) => `${k}: ${v}`), '', ''].join(
    '\n',
  );
  eintrag.anfrageDatei = schreibe(`${nr}-${methode}-anfrage.txt`, kopf + redigiere(init.body));

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    eintrag.fehler = err;
    throw err;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  eintrag.status = res.status;
  eintrag.antwortHeader = Object.fromEntries(res.headers);
  eintrag.antwortBytes = bytes;
  const antwortKopf = [
    `HTTP ${res.status} ${res.statusText}`,
    ...Object.entries(eintrag.antwortHeader).map(([k, v]) => `${k}: ${v}`),
    '',
    '',
  ].join('\n');
  eintrag.antwortDatei = schreibe(
    `${nr}-${methode}-antwort.txt`,
    Buffer.concat([Buffer.from(antwortKopf, 'utf8'), bytes]),
  );

  const leer = res.status === 204 || res.status === 304;
  return new Response(leer ? null : bytes, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

function befund(nr, titel) {
  console.log(`\n=== Befund ${nr}: ${titel} ===`);
}

function fehlertext(err) {
  const teile = [`${err.constructor.name}: ${err.message}`];
  if (err.statusCode) teile.push(`statusCode=${err.statusCode}`);
  return teile.join(' | ');
}

// --- Zugangsdaten ----------------------------------------------------------

function baueConfig() {
  const seriennummer = process.env.ELDA_SERIENNUMMER;
  const apiKey = process.env.ELDA_API_KEY;
  const klartext = process.env.ELDA_KUNDENPASSWORT;
  const hash = process.env.ELDA_KUNDENPASSWORT_HASH;
  const umgebung = process.env.ELDA_UMGEBUNG || 'kundentest';

  if (!seriennummer || !apiKey || !(klartext || hash)) {
    console.log(
      'Übersprungen: ELDA_SERIENNUMMER, ELDA_API_KEY und ELDA_KUNDENPASSWORT ' +
        '(oder ELDA_KUNDENPASSWORT_HASH) müssen gesetzt sein.',
    );
    return undefined;
  }
  if (klartext && hash) {
    console.log(
      'Hinweis: ELDA_KUNDENPASSWORT und ELDA_KUNDENPASSWORT_HASH sind beide gesetzt — ' +
        'verwendet wird der Hash (beides zugleich weist die Konfiguration zurück).',
    );
  }

  const passwortanteil = hash ? { kundenpasswortHash: hash.trim() } : { kundenpasswort: klartext };
  return {
    seriennummer,
    apiKey,
    ...passwortanteil,
    umgebung,
    transport: { fetchImpl: mitschnittFetch, timeoutMs: 60_000 },
  };
}

// --- Testmeldung -----------------------------------------------------------

/** TTMMJJJJ des heutigen Tages in Wiener Ortszeit. */
function heute() {
  const teile = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const wert = (typ) => teile.find((t) => t.type === typ).value;
  return `${wert('day')}${wert('month')}${wert('year')}`;
}

/**
 * Baut den Datenbestand für `senden`. Alle Werte sind erfunden und über
 * `ELDA_TEST_M3_<FELD>` bzw. die übrigen `ELDA_TEST_*`-Variablen ersetzbar —
 * echte Personendaten haben in diesem Skript nichts verloren.
 */
function baueTestbestand() {
  const felder = {
    REFW: `LIVECHECK-${LAUF}`,
    BKNR: '1234567',
    DGNA: 'Musterbetrieb Testdaten',
    INF1: 'LIVECHECK',
    VSNR: '1234010180',
    FANA: 'Mustermann',
    VONA: 'Max',
    ADAT: heute(),
    BBER: '01',
    GERF: 'N',
    FRDV: 'N',
    VWAZ: wochenarbeitszeit(15, 40),
  };
  for (const [name, wert] of Object.entries(process.env)) {
    if (!name.startsWith('ELDA_TEST_M3_')) continue;
    const feld = name.slice('ELDA_TEST_M3_'.length);
    if (wert === '') delete felder[feld];
    else felder[feld] = wert;
  }

  const hersteller = {
    name: process.env.ELDA_TEST_HERSTELLER_NAME || 'Musterhersteller Software',
    kfz: process.env.ELDA_TEST_HERSTELLER_KFZ || 'A',
    plz: process.env.ELDA_TEST_HERSTELLER_PLZ || '1010',
    ort: process.env.ELDA_TEST_HERSTELLER_ORT || 'Wien',
    strasse: process.env.ELDA_TEST_HERSTELLER_STRASSE || 'Teststrasse 1',
    mail: process.env.ELDA_TEST_HERSTELLER_MAIL || 'live-check@example.org',
  };
  if (process.env.ELDA_TEST_HERSTELLER_TELEFON) hersteller.telefon = process.env.ELDA_TEST_HERSTELLER_TELEFON;
  if (process.env.ELDA_TEST_HERSTELLER_SOFTWAREID)
    hersteller.softwareId = process.env.ELDA_TEST_HERSTELLER_SOFTWAREID;

  const optionen = {
    // Bewusst NICHT die echte ELDA-Seriennummer als Vorbelegung: sie stünde
    // sonst im Klartext in der Ausgabe dieses Skripts. Wer sie im Feld OBUS
    // braucht, setzt ELDA_TEST_OBUS ausdrücklich.
    seriennummer: process.env.ELDA_TEST_OBUS || '1234567',
    versicherungstraeger: process.env.ELDA_TEST_VSTR || '11',
    datentraegernummer: process.env.ELDA_TEST_DTNR || '000001',
    erstellt: new Date(),
    testdaten: process.env.ELDA_TEST_ECHTDATEN !== '1',
    hersteller,
  };
  if (process.env.ELDA_TEST_UVST) optionen.datenuebernehmer = process.env.ELDA_TEST_UVST;
  if (process.env.ELDA_TEST_VNMF) optionen.mitteilungsfileVersion = process.env.ELDA_TEST_VNMF;

  const meldung = anmeldung(felder);
  return { bestand: erstelleBestand([meldung], optionen), satzlaenge: meldung.satzlaenge, optionen };
}

// --- 1: ruecksendungenAuflisten (verändert nichts) --------------------------

async function auflisten(elda) {
  befund(1, 'ruecksendungenAuflisten — Erfolg und Drahtform der LEEREN Liste');
  let erg;
  try {
    erg = await elda.ruecksendungenAuflisten();
  } catch (err) {
    console.log('FEHLGESCHLAGEN:', fehlertext(err));
    console.log('Mitschnitt:', letzter()?.antwortDatei ?? '(keine Antwort)');
    return undefined;
  }
  console.log(
    `statusCode=${erg.statusCode} ok=${erg.ok} rücksendungen=${erg.ruecksendungen.length}` +
      (erg.meldung ? ` meldung="${erg.meldung}"` : ''),
  );
  for (const rs of erg.ruecksendungen.slice(0, 20)) {
    console.log(`  ${String(rs.protokollnummer).padEnd(12)} ${rs.dateiName}`);
  }
  if (erg.ruecksendungen.length > 20) console.log(`  … und ${erg.ruecksendungen.length - 20} weitere`);

  if (erg.ok && erg.ruecksendungen.length === 0) {
    console.log('\nLeere Liste — Rohantwort (genau die offene Frage aus der README):');
    console.log(letzter().antwortBytes.toString('utf8'));
  } else if (erg.ruecksendungen.length > 0) {
    console.log(
      '\nDie Liste ist NICHT leer — die Drahtform der leeren Liste bleibt offen. ' +
        'Den Lauf wiederholen, wenn die Warteschlange abgearbeitet ist.',
    );
  }
  console.log('Mitschnitt:', letzter().antwortDatei);

  befund(2, 'SOAPAction-Header, so wie dieser Client ihn sendet');
  const a = letzter();
  console.log(`gesendet: SOAPAction: ${a.anfrageHeader.SOAPAction}`);
  console.log(`Content-Type: ${a.anfrageHeader['Content-Type']}`);
  console.log(
    `HTTP ${a.status}, Antwort-Content-Type: ${a.antwortHeader['content-type'] ?? '(keiner)'} → ` +
      (a.status === 200 && erg.statusCode !== '559'
        ? 'akzeptiert (kein 559 „unerlaubter Content-Type", kein HTTP-Fehler)'
        : 'NICHT akzeptiert — siehe Status oben'),
  );

  befund(3, 'created-Format (ISO-8601 mit Millisekunden und Z)');
  const created = /<created>([^<]*)<\/created>/.exec(a.anfrageBody)?.[1];
  console.log(`gesendet: ${created}`);
  console.log(
    erg.statusCode === '551' || erg.statusCode === '555'
      ? `ABGELEHNT (statusCode ${erg.statusCode}) — Format oder Uhrzeit stimmen nicht.`
      : 'akzeptiert (weder 551 „Request abgelaufen" noch 555 „created nicht gesetzt").',
  );

  return erg;
}

// --- 4/6: senden (legt echte Daten an) -------------------------------------

async function senden(elda) {
  befund(4, 'senden — inline base64Binary oder MTOM?');
  if (process.env.ELDA_TEST_ALLOW_STATE_CHANGE !== '1') {
    console.log('Übersprungen: senden legt eine ECHTE Sendung im Konto an.');
    console.log('Freigabe: ELDA_TEST_ALLOW_STATE_CHANGE=1');
    befund(6, 'Bestand — Fixlängensätze ohne Trennzeichen?');
    console.log('Übersprungen (setzt senden voraus).');
    return undefined;
  }

  let gebaut;
  try {
    gebaut = baueTestbestand();
  } catch (err) {
    console.log('Testbestand ließ sich nicht bauen:', fehlertext(err));
    console.log('Felder über ELDA_TEST_M3_<FELD> bzw. ELDA_TEST_* anpassen.');
    return undefined;
  }
  const { bestand, satzlaenge, optionen } = gebaut;
  const dateiName = process.env.ELDA_TEST_DATEINAME || `livecheck-${LAUF}.dat`;

  console.log('Es geht GENAU DAS FOLGENDE an ELDA:');
  console.log(`  dateiName: ${dateiName}`);
  console.log(`  Bytes: ${bestand.length} (ISO-8859-15), Satzlänge ${satzlaenge}`);
  console.log(`  PROJ: ${optionen.testdaten ? 'TM (Testdaten)' : 'DM (ECHTDATEN!)'}`);
  // Vorlaufsatz, Meldungssätze und Schlusssatz sind alle auf die Satzlänge des
  // Bestands aufgefüllt — die Zerlegung zur Anzeige ist deshalb exakt.
  const text = bestand.toString('latin1');
  for (let i = 0, satz = 1; i < text.length; i += satzlaenge, satz++) {
    console.log(`  Satz ${satz}: ${text.slice(i, i + satzlaenge)}`);
  }
  console.log(`  Mitschnitt des Bestands: ${schreibe('bestand.dat', bestand)}`);

  let erg;
  try {
    erg = await elda.senden({ dateiName, inhalt: bestand });
  } catch (err) {
    console.log('FEHLGESCHLAGEN:', fehlertext(err));
    console.log('Mitschnitt:', letzter()?.antwortDatei ?? '(keine Antwort)');
    return undefined;
  }
  console.log(
    `\nstatusCode=${erg.statusCode} ok=${erg.ok}` +
      (erg.protokollnummer ? ` protokollnummer=${erg.protokollnummer}` : ' (KEINE protokollnummer!)') +
      (erg.dateiId ? ` dateiId=${erg.dateiId}` : '') +
      (erg.eldaZeitstempel ? ` eldaZeitstempel=${erg.eldaZeitstempel}` : '') +
      (erg.meldung ? ` meldung="${erg.meldung}"` : ''),
  );
  console.log(
    erg.ok
      ? 'Inline base64Binary wurde ANGENOMMEN — MTOM ist für senden nicht erforderlich.'
      : 'Inline base64Binary NICHT angenommen — Status und Meldung oben deuten den Grund.',
  );
  console.log('Mitschnitt:', letzter().antwortDatei);

  befund(6, 'Bestand — Fixlängensätze ohne Trennzeichen?');
  console.log(
    `Gesendet wurde EIN Byte-Strom ohne Satztrenner (${bestand.length} Bytes, ` +
      `Meldungssatzlänge ${satzlaenge}, kein \\n und kein \\r\\n: ` +
      `${!bestand.includes(0x0a) && !bestand.includes(0x0d)}).`,
  );
  console.log(
    erg.ok
      ? 'ELDA hat die Datei entgegengenommen. Das ist noch KEINE fachliche Zusage — ' +
          'ob die Sätze richtig getrennt gelesen wurden, sagt erst das Mitteilungsfile ' +
          `zur Protokollnummer ${erg.protokollnummer ?? '(unbekannt)'}: mit ` +
          'ELDA_TEST_ALLOW_EMPFANGEN=1 abholen und darin die Satzanzahl prüfen.'
      : 'Bereits die Entgegennahme scheiterte — siehe Status oben.',
  );
  return erg;
}

// --- 5: empfangen (unwiderruflich) -----------------------------------------

async function empfangen(elda, liste) {
  befund(5, 'empfangen — Payload inline oder als Anhang, und worüber geht die md5?');
  if (process.env.ELDA_TEST_ALLOW_EMPFANGEN !== '1') {
    console.log('Übersprungen: empfangen VERBRAUCHT die Rücksendung endgültig.');
    console.log('Freigabe: ELDA_TEST_ALLOW_EMPFANGEN=1');
    return;
  }
  const nummer = process.env.ELDA_TEST_PROTOKOLLNUMMER || liste?.ruecksendungen[0]?.protokollnummer;
  if (!nummer) {
    console.log('Übersprungen: keine Protokollnummer — weder ELDA_TEST_PROTOKOLLNUMMER noch eine offene Rücksendung.');
    return;
  }

  console.log('');
  console.log('!!! ACHTUNG — UNWIDERRUFLICH !!!');
  console.log(`Die Rücksendung ${nummer} wird jetzt abgeholt und ist damit VERBRAUCHT:`);
  console.log('ELDA liefert sie danach niemandem mehr aus — auch nicht der Lohnverrechnung,');
  console.log('die sie eigentlich braucht. Die abgeholten Bytes werden hier weggeschrieben,');
  console.log('bevor irgendetwas anderes geschieht; sie sind dann die einzige Kopie.');
  console.log('');

  let erg;
  let fehler;
  try {
    erg = await elda.empfangen(nummer);
  } catch (err) {
    fehler = err;
  }

  // Zuerst sichern, dann auswerten — in dieser Reihenfolge, weil ein Absturz
  // der Auswertung sonst die einzige Kopie mitnähme.
  const inhalt = erg?.datei?.inhalt ?? fehler?.ergebnis?.datei?.inhalt;
  if (inhalt) console.log('Bytes gesichert:', schreibe(`ruecksendung-${nummer}.bin`, inhalt));
  const a = letzter();
  console.log('Mitschnitt:', a?.antwortDatei ?? '(keine Antwort)');

  if (fehler) {
    console.log('empfangen wirft:', fehlertext(fehler));
  } else {
    console.log(
      `statusCode=${erg.statusCode} ok=${erg.ok}` +
        (erg.datei ? ` name=${erg.datei.name ?? '-'} dateiTyp=${erg.datei.dateiTyp ?? '-'}` : ' (keine datei)') +
        (erg.meldung ? ` meldung="${erg.meldung}"` : ''),
    );
  }
  if (!a?.antwortBytes) return;

  const text = a.antwortBytes.toString('utf8');
  const contentType = a.antwortHeader['content-type'] ?? '';
  const mtom = contentType.includes('multipart/') || contentType.includes('application/xop');
  const xop = /<(\w+:)?Include\b/.test(text);
  console.log(`\nÜbertragungsform: Content-Type "${contentType}"`);
  console.log(
    mtom || xop
      ? `→ ANHANG (MTOM/XOP${xop ? ', xop:Include im Body' : ''}) — der Client erwartet inline Base64.`
      : '→ INLINE (<payload> im XML), so wie dieser Client es erwartet.',
  );

  const md5Gemeldet = /<md5>([\s\S]*?)<\/md5>/.exec(text)?.[1]?.trim();
  const payloadRoh = /<payload>([\s\S]*?)<\/payload>/.exec(text)?.[1];
  if (!md5Gemeldet) {
    console.log('ELDA hat KEINE md5 mitgeliefert — die Bezugsgröße bleibt offen.');
    return;
  }
  if (payloadRoh === undefined) {
    console.log(`md5 von ELDA: ${md5Gemeldet} — aber kein inline <payload> zum Vergleichen.`);
    return;
  }
  const kompakt = payloadRoh.replace(/\s+/g, '');
  const ueberBytes = createHash('md5').update(Buffer.from(kompakt, 'base64')).digest('hex');
  const ueberBase64 = createHash('md5').update(kompakt, 'utf8').digest('hex');
  const ueberBase64Roh = createHash('md5').update(payloadRoh, 'utf8').digest('hex');
  console.log(`md5 von ELDA:               ${md5Gemeldet}`);
  console.log(`md5 der dekodierten Bytes:  ${ueberBytes}${ueberBytes === md5Gemeldet.toLowerCase() ? '  <== Treffer' : ''}`);
  console.log(`md5 des Base64-Textes:      ${ueberBase64}${ueberBase64 === md5Gemeldet.toLowerCase() ? '  <== Treffer' : ''}`);
  if (ueberBase64Roh !== ueberBase64) {
    console.log(
      `md5 des Base64 inkl. Whitespace: ${ueberBase64Roh}${ueberBase64Roh === md5Gemeldet.toLowerCase() ? '  <== Treffer' : ''}`,
    );
  }
  if (![ueberBytes, ueberBase64, ueberBase64Roh].includes(md5Gemeldet.toLowerCase())) {
    console.log('KEIN Treffer — die md5 bezieht sich auf etwas anderes als den Payload dieser Antwort.');
  }
}

// --- Ablauf ----------------------------------------------------------------

(async () => {
  const config = baueConfig();
  if (!config) return;
  console.log(`ELDA-Live-Check gegen Umgebung '${config.umgebung}'.`);
  console.log(`Passwortanteil: ${config.kundenpasswortHash ? 'kundenpasswortHash' : 'kundenpasswort (Klartext)'}`);
  console.log(`Mitschnitt: ${path.relative(process.cwd(), MITSCHNITT)}`);

  let elda;
  try {
    elda = createEldaTransferRoh(config);
  } catch (err) {
    console.log('Konfiguration abgelehnt:', fehlertext(err));
    return;
  }

  const liste = await auflisten(elda);
  await senden(elda);
  await empfangen(elda, liste);
})();
