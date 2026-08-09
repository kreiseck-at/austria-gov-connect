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
// Ein Befund gilt nur dann als beantwortet, wenn der zugehörige Aufruf
// TATSÄCHLICH gelungen ist (Status 000). Andernfalls steht dort „Frage offen"
// samt Status — eine falsche Antwort wäre schlimmer als gar keine, denn sie
// wanderte anschließend als vermeintlich belegte Annahme ins Paket.
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
// Nur für 'sit':
//   ELDA_SIT_QUELL_IP  erwartete öffentliche Quell-IP. Weicht die tatsächliche
//                      ab, bricht der Lauf ab, statt in eine irreführende
//                      Netzwerkabweisung zu laufen (siehe `quellIp`).
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
//   ELDA_TEST_PROTOKOLLNUMMER       Ziel für `empfangen`, WENN in diesem Lauf
//                                   nicht gesendet wurde.
//
// Abgeholt wird ausschließlich die Rücksendung zur eigenen Sendung aus DIESEM
// Lauf oder die ausdrücklich genannte Protokollnummer — NIE ein Eintrag aus der
// Liste in Befund 1. Der erste Eintrag dort ist die älteste offene Rücksendung
// und gehört fast sicher einer fremden Verarbeitung; sie abzuholen hieße, ein
// Verarbeitungsprotokoll zu vernichten, das jemand anderes braucht.
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
// Verzeichnis ist gitignoriert, die Dateien tragen 0600, und Seriennummer,
// API-Key sowie Passwort-Hash sind in BEIDEN Richtungen geschwärzt (ein
// SOAP-Fault zitiert die Anfrage regelmäßig in seinem <detail>). Lässt sich ein
// Geheimnis nicht schwärzen, wird die Datei nicht geschrieben.

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  createEldaTransferRoh,
  anmeldung,
  erstelleBestand,
  wochenarbeitszeit,
  hashKundenpasswort,
} = require('../../dist/index.js');
const { redigiereGeheimnisse } = require('../../dist/redigieren.js');

const MITSCHNITT = path.join(__dirname, 'mitschnitt');
const LAUF = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Die Werte, die in keinem Mitschnitt stehen dürfen. Wird von `baueConfig`
 * befüllt — der Passwort-Hash auch dann, wenn nur das Klartextpasswort gesetzt
 * ist, denn auf der Leitung steht immer der Hash.
 */
const geheimnisse = {};

/** Schreibt Bytes unverändert in den Mitschnitt (nur für Nutzdaten ohne Zugangsdaten). */
function schreibeBytes(name, daten) {
  fs.mkdirSync(MITSCHNITT, { recursive: true });
  const ziel = path.join(MITSCHNITT, `${LAUF}-${name}`);
  fs.writeFileSync(ziel, daten, { mode: 0o600 });
  return path.relative(process.cwd(), ziel);
}

/**
 * Schwärzt und schreibt. Wirft, wenn ein Geheimnis nach der Schwärzung noch im
 * Text steht — dann entsteht keine Datei.
 *
 * Der Umweg über `latin1` ist kein Zufall: Er bildet jedes Byte umkehrbar auf
 * genau ein Zeichen ab. Eine Antwort, in der nichts zu schwärzen ist, geht damit
 * byteweise unverändert auf die Platte (MTOM-Treue), und eine, in der etwas zu
 * schwärzen ist, wird trotzdem vollständig erfasst — auch wenn sie teils binär
 * ist. `utf8` würde alles außerhalb von ASCII beim Dekodieren verändern.
 */
function schreibeText(name, kopf, koerper) {
  const roh = Buffer.concat([Buffer.from(kopf, 'latin1'), koerper]).toString('latin1');
  return schreibeBytes(name, Buffer.from(redigiereGeheimnisse(roh, geheimnisse), 'latin1'));
}

const austausch = [];
const letzter = () => austausch[austausch.length - 1];

/**
 * `fetch`-Ersatz, der Anfrage und Antwort mitschreibt. Die Antwort wird als
 * Bytes gelesen und unverändert neu verpackt weitergereicht — der Mitschnitt
 * entsteht also VOR dem Parsen durch den Client. Das ist Absicht: Scheitert das
 * Parsen (MTOM, MD5-Abweichung), liegen die Bytes bereits auf der Platte.
 */
async function mitschnittFetch(url, init) {
  const nr = String(austausch.length + 1).padStart(2, '0');
  const methode = /<v4:(\w+)/.exec(init.body)?.[1] ?? 'unbekannt';
  const eintrag = { nr, methode, url, anfrageHeader: init.headers, anfrageBody: init.body };
  austausch.push(eintrag);

  const kopf = [`POST ${url}`, ...Object.entries(init.headers).map(([k, v]) => `${k}: ${v}`), '', ''].join(
    '\n',
  );
  // Bewusst VOR dem Absenden und ohne Auffangnetz: Lässt sich die Anfrage nicht
  // schwärzen, geht sie auch nicht raus. Hier ist noch nichts verloren.
  eintrag.anfrageDatei = schreibeText(
    `${nr}-${methode}-anfrage.txt`,
    kopf,
    Buffer.from(init.body, 'utf8'),
  );

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
  try {
    eintrag.antwortDatei = schreibeText(`${nr}-${methode}-antwort.txt`, antwortKopf, bytes);
  } catch (err) {
    // Hier NICHT werfen: Die Antwort ist schon da, und bei `empfangen` hinge an
    // ihr die einzige Kopie der Rücksendung. Also weiterreichen, aber laut
    // sagen, dass kein Mitschnitt entstanden ist.
    eintrag.antwortDatei = undefined;
    console.log(`\n!!! Antwort-Mitschnitt NICHT geschrieben: ${err.message}`);
  }

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

/** Einheitlicher Text für „der Aufruf ging schief, die Frage bleibt offen". */
function offen(grund) {
  console.log(`FRAGE OFFEN — ${grund}`);
}

function fehlertext(err) {
  const teile = [`${err.constructor.name}: ${err.message}`];
  if (err.statusCode) teile.push(`statusCode=${err.statusCode}`);
  return teile.join(' | ');
}

const mitschnittHinweis = () => `Mitschnitt: ${letzter()?.antwortDatei ?? '(keiner)'}`;

/**
 * Öffentliche Quell-IP dieses Laufs, best effort.
 *
 * Der SIT lässt nur freigeschaltete Adressen zu und weist alles andere schon
 * auf Netzwerkebene ab ("Connection reset by peer"). Das sieht aus wie ein
 * Serverausfall, liegt aber an der eigenen Adresse — ein eingeschaltetes VPN
 * oder ein Mobilfunk-Hotspot genügt. Ohne diese Auskunft sucht man den Fehler
 * bei ELDA statt bei sich.
 *
 * Bewusst NICHT über `mitschnittFetch`: der Mitschnitt soll ausschließlich den
 * ELDA-Verkehr enthalten. Und bewusst fehlertolerant — die Adresse ist eine
 * Hilfe bei der Fehlersuche, kein Bestandteil des Tests.
 */
async function quellIp() {
  try {
    const antwort = await fetch('https://api.ipify.org', {
      signal: AbortSignal.timeout(5_000),
    });
    if (!antwort.ok) return null;
    const text = (await antwort.text()).trim();
    return /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

/**
 * Prüft vor dem ersten SIT-Aufruf, ob dieser Lauf von der erwarteten Adresse
 * ausgeht. Liefert `false`, wenn abgebrochen werden soll.
 *
 * Der Abbruch ist der eigentliche Zweck: Ein Lauf aus der falschen Adresse
 * erzeugt lauter Fehlbefunde, die anschließend als vermeintliche Erkenntnisse
 * über ELDA weiterleben — genau das, was dieses Skript sonst verhindert.
 */
async function pruefeQuellIp() {
  const ip = await quellIp();
  const erwartet = process.env.ELDA_SIT_QUELL_IP?.trim();
  console.log(`Quell-IP: ${ip ?? 'nicht ermittelbar'}`);
  if (!erwartet) {
    console.log(
      'Hinweis: Der SIT lässt nur freigeschaltete Quell-IPs zu. Mit ' +
        'ELDA_SIT_QUELL_IP wird die erwartete Adresse vor dem Lauf geprüft.',
    );
    return true;
  }
  if (!ip) {
    console.log(
      `Abgebrochen: erwartet war ${erwartet}, die tatsächliche Adresse ließ sich ` +
        'nicht ermitteln. Ohne diese Gewissheit wären alle Befunde wertlos.',
    );
    return false;
  }
  if (ip !== erwartet) {
    console.log(
      `Abgebrochen: erwartet war ${erwartet}. Der SIT weist diese Adresse ab — ` +
        'läuft ein VPN oder ein Mobilfunk-Hotspot?',
    );
    return false;
  }
  return true;
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
  geheimnisse.apiKey = apiKey;
  geheimnisse.seriennummer = seriennummer;
  geheimnisse.kundenpasswortHash = passwortanteil.kundenpasswortHash ?? hashKundenpasswort(klartext);
  if (klartext) geheimnisse.kundenpasswort = klartext;

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
    // Bewusst NICHT die echte ELDA-Seriennummer als Vorbelegung: Der Bestand
    // wird vor dem Senden vollständig ausgedruckt, sie stünde dann in der
    // Ausgabe. Wer sie im Feld OBUS braucht, setzt ELDA_TEST_OBUS ausdrücklich —
    // und nimmt in Kauf, dass sie im Klartext auf dem Bildschirm erscheint.
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

// --- 1 bis 3: ruecksendungenAuflisten (verändert nichts) --------------------

async function auflisten(elda) {
  befund(1, 'ruecksendungenAuflisten — Erfolg und Drahtform der LEEREN Liste');
  let erg;
  try {
    erg = await elda.ruecksendungenAuflisten();
  } catch (err) {
    offen(`der Aufruf scheiterte: ${fehlertext(err)}`);
    console.log(mitschnittHinweis());
    const a = letzter();
    befund(2, 'SOAPAction-Header, so wie dieser Client ihn sendet');
    if (a) console.log(`gesendet: SOAPAction: ${a.anfrageHeader.SOAPAction}`);
    offen('ohne auswertbare Antwort ist über den Header nichts zu sagen.');
    befund(3, 'created-Format (ISO-8601 mit Millisekunden und Z)');
    if (a) console.log(`gesendet: ${/<created>([^<]*)<\/created>/.exec(a.anfrageBody)?.[1]}`);
    offen('ohne auswertbare Antwort ist über das Format nichts zu sagen.');
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
  console.log(
    'Diese Liste ist reine Anzeige — sie wird NICHT als Ziel für `empfangen` verwendet.',
  );

  if (!erg.ok) {
    offen(
      `ELDA hat den Aufruf mit Status ${erg.statusCode} abgelehnt` +
        `${erg.meldung ? ` ("${erg.meldung}")` : ''}. Eine leere Liste bedeutet hier NICHT ` +
        '„keine offen", sondern nur, dass der Aufruf selbst fehlschlug.',
    );
  } else if (erg.ruecksendungen.length === 0) {
    console.log('\nLeere Liste — Rohantwort (genau die offene Frage aus der README):');
    console.log(letzter().antwortBytes.toString('utf8'));
  } else {
    offen(
      'die Liste ist nicht leer. Den Lauf wiederholen, wenn die Warteschlange ' +
        'abgearbeitet ist — dann zeigt sich die Drahtform der leeren Liste.',
    );
  }
  console.log(mitschnittHinweis());

  const a = letzter();
  befund(2, 'SOAPAction-Header, so wie dieser Client ihn sendet');
  console.log(`gesendet: SOAPAction: ${a.anfrageHeader.SOAPAction}`);
  console.log(`Content-Type: ${a.anfrageHeader['Content-Type']}`);
  console.log(`HTTP ${a.status}, Antwort-Content-Type: ${a.antwortHeader['content-type'] ?? '(keiner)'}`);
  if (erg.ok) {
    console.log('AKZEPTIERT — der Aufruf ist mit genau diesem Header durchgelaufen (Status 000).');
  } else if (erg.statusCode === '559') {
    console.log('ABGELEHNT — Status 559 „unerlaubter Content-Type".');
  } else {
    offen(
      `ELDA antwortete mit Status ${erg.statusCode}. Dass die Antwort ankam, heißt nicht, ` +
        'dass der Header akzeptiert wurde — der Aufruf ist an einer anderen Stelle gescheitert.',
    );
  }

  befund(3, 'created-Format (ISO-8601 mit Millisekunden und Z)');
  console.log(`gesendet: ${/<created>([^<]*)<\/created>/.exec(a.anfrageBody)?.[1]}`);
  if (erg.ok) {
    console.log('AKZEPTIERT — der Aufruf ist mit genau diesem Zeitstempel durchgelaufen (Status 000).');
  } else if (erg.statusCode === '551' || erg.statusCode === '555') {
    console.log(`ABGELEHNT — Status ${erg.statusCode} (Request abgelaufen bzw. created nicht gesetzt).`);
  } else {
    offen(
      `ELDA antwortete mit Status ${erg.statusCode} — etwa ein falscher API-Key (557) oder falsche ` +
        'Zugangsdaten (558). Das `created` hat ELDA dann gar nicht bewertet.',
    );
  }

  return erg;
}

// --- 4 und 6: senden (legt echte Daten an) ---------------------------------

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
    offen(`der Testbestand ließ sich nicht bauen: ${fehlertext(err)}`);
    console.log('Felder über ELDA_TEST_M3_<FELD> bzw. ELDA_TEST_* anpassen.');
    befund(6, 'Bestand — Fixlängensätze ohne Trennzeichen?');
    offen('es wurde nichts gesendet.');
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
  console.log(`  Mitschnitt des Bestands: ${schreibeBytes('bestand.dat', bestand)}`);

  let erg;
  try {
    erg = await elda.senden({ dateiName, inhalt: bestand });
  } catch (err) {
    offen(`der Aufruf scheiterte: ${fehlertext(err)}`);
    console.log(mitschnittHinweis());
    befund(6, 'Bestand — Fixlängensätze ohne Trennzeichen?');
    offen('die Sendung kam nicht durch.');
    return undefined;
  }
  console.log(
    `\nstatusCode=${erg.statusCode} ok=${erg.ok}` +
      (erg.protokollnummer ? ` protokollnummer=${erg.protokollnummer}` : ' (KEINE protokollnummer!)') +
      (erg.dateiId ? ` dateiId=${erg.dateiId}` : '') +
      (erg.eldaZeitstempel ? ` eldaZeitstempel=${erg.eldaZeitstempel}` : '') +
      (erg.meldung ? ` meldung="${erg.meldung}"` : ''),
  );
  if (erg.ok) {
    console.log('INLINE base64Binary wurde ANGENOMMEN — MTOM ist für senden nicht erforderlich.');
  } else {
    offen(
      `ELDA antwortete mit Status ${erg.statusCode}${erg.meldung ? ` ("${erg.meldung}")` : ''}. ` +
        'Das ist keine Aussage über das Payload-Format: Zugangsdaten (558), Dateiname (401/402) ' +
        'oder ein Duplikat (405) scheitern unabhängig davon, wie der Payload kodiert war.',
    );
  }
  console.log(mitschnittHinweis());

  befund(6, 'Bestand — Fixlängensätze ohne Trennzeichen?');
  console.log(
    `Gesendet wurde EIN Byte-Strom ohne Satztrenner (${bestand.length} Bytes, ` +
      `Meldungssatzlänge ${satzlaenge}, kein \\n und kein \\r\\n: ` +
      `${!bestand.includes(0x0a) && !bestand.includes(0x0d)}).`,
  );
  if (erg.ok) {
    console.log(
      'ELDA hat die Datei entgegengenommen. Das ist noch KEINE fachliche Zusage — ob die Sätze ' +
        'richtig getrennt gelesen wurden, sagt erst das Mitteilungsfile zur Protokollnummer ' +
        `${erg.protokollnummer ?? '(keine erhalten)'}. Genau die holt dieses Skript mit ` +
        'ELDA_TEST_ALLOW_EMPFANGEN=1 im selben Lauf ab; darin die Satzanzahl prüfen. ' +
        'KEINE fremde Rücksendung aus der Liste in Befund 1 abholen.',
    );
  } else {
    offen('bereits die Entgegennahme scheiterte — siehe Status oben.');
  }
  return erg;
}

// --- 5: empfangen (unwiderruflich) -----------------------------------------

/**
 * Bestimmt, WELCHE Rücksendung geholt wird. Ausschließlich die eigene Sendung
 * aus diesem Lauf oder eine ausdrücklich genannte Protokollnummer. Der erste
 * Eintrag aus `ruecksendungenAuflisten` wäre die ÄLTESTE offene Rücksendung —
 * also fast sicher eine fremde, die jemand anderes für seine Lohnverrechnung
 * braucht. `empfangen` ist einmalig; sie wäre danach für immer weg, und der
 * daraus gezogene Befund stammte obendrein aus der falschen Datei.
 */
function zielProtokollnummer(gesendet) {
  const eigene = gesendet?.protokollnummer;
  const ausEnv = process.env.ELDA_TEST_PROTOKOLLNUMMER;
  if (eigene) {
    if (ausEnv && ausEnv !== eigene) {
      console.log(
        `Hinweis: ELDA_TEST_PROTOKOLLNUMMER=${ausEnv} wird NICHT verwendet — in diesem Lauf ` +
          'wurde gesendet, und geholt wird ausschließlich die eigene Rücksendung.',
      );
    }
    return { nummer: eigene, herkunft: 'Protokollnummer der eigenen Sendung aus diesem Lauf' };
  }
  if (ausEnv) return { nummer: ausEnv, herkunft: 'ELDA_TEST_PROTOKOLLNUMMER' };
  return undefined;
}

async function empfangen(elda, gesendet) {
  befund(5, 'empfangen — Payload inline oder als Anhang, und worüber geht die md5?');
  if (process.env.ELDA_TEST_ALLOW_EMPFANGEN !== '1') {
    console.log('Übersprungen: empfangen VERBRAUCHT die Rücksendung endgültig.');
    console.log('Freigabe: ELDA_TEST_ALLOW_EMPFANGEN=1');
    return;
  }
  const ziel = zielProtokollnummer(gesendet);
  if (!ziel) {
    console.log('Übersprungen: keine eigene Protokollnummer aus diesem Lauf.');
    console.log(
      'Entweder zusätzlich ELDA_TEST_ALLOW_STATE_CHANGE=1 setzen (dann wird die Rücksendung zur ' +
        'eigenen Sendung geholt) oder ELDA_TEST_PROTOKOLLNUMMER ausdrücklich angeben. Ein Eintrag ' +
        'aus der Liste in Befund 1 wird NICHT von selbst genommen — er gehört fast sicher einer ' +
        'fremden Verarbeitung.',
    );
    return;
  }

  console.log('');
  console.log('!!! ACHTUNG — UNWIDERRUFLICH !!!');
  console.log(`Die Rücksendung ${ziel.nummer} wird jetzt abgeholt und ist damit VERBRAUCHT:`);
  console.log('ELDA liefert sie danach niemandem mehr aus — auch nicht der Lohnverrechnung,');
  console.log('die sie eigentlich braucht. Die abgeholten Bytes werden hier weggeschrieben,');
  console.log('bevor irgendetwas anderes geschieht; sie sind dann die einzige Kopie.');
  console.log(`Quelle der Protokollnummer: ${ziel.herkunft}.`);
  console.log('');

  let erg;
  let fehler;
  try {
    erg = await elda.empfangen(ziel.nummer);
  } catch (err) {
    fehler = err;
  }

  // Zuerst sichern, dann auswerten — in dieser Reihenfolge, weil ein Absturz
  // der Auswertung sonst die einzige Kopie mitnähme.
  const inhalt = erg?.datei?.inhalt ?? fehler?.ergebnis?.datei?.inhalt;
  if (inhalt) console.log('Bytes gesichert:', schreibeBytes(`ruecksendung-${ziel.nummer}.bin`, inhalt));
  const a = letzter();
  console.log(mitschnittHinweis());

  if (fehler) {
    console.log('empfangen wirft:', fehlertext(fehler));
  } else {
    console.log(
      `statusCode=${erg.statusCode} ok=${erg.ok}` +
        (erg.datei ? ` name=${erg.datei.name ?? '-'} dateiTyp=${erg.datei.dateiTyp ?? '-'}` : ' (keine datei)') +
        (erg.meldung ? ` meldung="${erg.meldung}"` : ''),
    );
  }
  if (!a?.antwortBytes) {
    offen('es liegt keine Antwort vor.');
    return;
  }

  const text = a.antwortBytes.toString('utf8');
  const contentType = a.antwortHeader['content-type'] ?? '';
  const mtom = contentType.includes('multipart/') || contentType.includes('application/xop');
  const xop = /<(\w+:)?Include\b/.test(text);
  const md5Gemeldet = /<md5>([\s\S]*?)<\/md5>/.exec(text)?.[1]?.trim();
  const payloadRoh = /<payload>([\s\S]*?)<\/payload>/.exec(text)?.[1];

  console.log(`\nÜbertragungsform: Content-Type "${contentType}"`);
  if (mtom || xop) {
    console.log(`→ ANHANG (MTOM/XOP${xop ? ', xop:Include im Body' : ''}) — der Client erwartet inline Base64.`);
  } else if (payloadRoh !== undefined) {
    console.log('→ INLINE (<payload> im XML), so wie dieser Client es erwartet.');
  } else {
    offen('die Antwort enthält weder einen inline <payload> noch eine XOP-Referenz.');
    return;
  }

  if (!md5Gemeldet) {
    offen('ELDA hat keine md5 mitgeliefert — die Bezugsgröße bleibt unbeantwortet.');
    return;
  }
  if (payloadRoh === undefined) {
    console.log(`md5 von ELDA: ${md5Gemeldet}`);
    offen('ohne inline <payload> ist nichts zu vergleichen.');
    return;
  }
  const kompakt = payloadRoh.replace(/\s+/g, '');
  const treffer = (wert) => (wert === md5Gemeldet.toLowerCase() ? '  <== Treffer' : '');
  const ueberBytes = createHash('md5').update(Buffer.from(kompakt, 'base64')).digest('hex');
  const ueberBase64 = createHash('md5').update(kompakt, 'utf8').digest('hex');
  const ueberBase64Roh = createHash('md5').update(payloadRoh, 'utf8').digest('hex');
  console.log(`md5 von ELDA:               ${md5Gemeldet}`);
  console.log(`md5 der dekodierten Bytes:  ${ueberBytes}${treffer(ueberBytes)}`);
  console.log(`md5 des Base64-Textes:      ${ueberBase64}${treffer(ueberBase64)}`);
  if (ueberBase64Roh !== ueberBase64) {
    console.log(`md5 des Base64 mit Whitespace: ${ueberBase64Roh}${treffer(ueberBase64Roh)}`);
  }
  if (![ueberBytes, ueberBase64, ueberBase64Roh].includes(md5Gemeldet.toLowerCase())) {
    offen('keine der drei Rechnungen trifft — die md5 bezieht sich auf etwas anderes.');
  }
}

// --- Ablauf ----------------------------------------------------------------

(async () => {
  const config = baueConfig();
  if (!config) return;
  console.log(`ELDA-Live-Check gegen Umgebung '${config.umgebung}'.`);
  console.log(`Passwortanteil: ${config.kundenpasswortHash ? 'kundenpasswortHash' : 'kundenpasswort (Klartext)'}`);
  console.log(`Mitschnitt: ${path.relative(process.cwd(), MITSCHNITT)} (geschwärzt, 0600)`);

  // Nur beim SIT: dort entscheidet die Quell-IP über Erreichbarkeit überhaupt.
  // Kundentest und Produktion prüfen sie nicht — belegt am 08.08.2026, beide
  // liefen aus einem dynamischen Cloud-Adresspool durch.
  if (config.umgebung === 'sit' && !(await pruefeQuellIp())) return;

  let elda;
  try {
    elda = createEldaTransferRoh(config);
  } catch (err) {
    console.log('Konfiguration abgelehnt:', fehlertext(err));
    return;
  }

  await auflisten(elda);
  const gesendet = await senden(elda);
  await empfangen(elda, gesendet);
})();
