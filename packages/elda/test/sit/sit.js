#!/usr/bin/env node
'use strict';

// SIT-Werkzeug – Kommandozeile. Bedienung, Sicherheitsregeln und Ablauf je
// Testfenster: README.md daneben.
//
//   node test/sit/sit.js pruefen
//   node test/sit/sit.js plan     [--fenster mo-vm]
//   node test/sit/sit.js zeigen   <ID> [--fenster mo-vm]
//   node test/sit/sit.js lauf     <ID> [<ID> …] [--ja] [--nochmal]      (Alias: senden)
//   node test/sit/sit.js abholen  [--ja]
//   node test/sit/sit.js urteil   <ID> <bestanden|abweichung|blockiert|entfaellt> [--notiz …] [--befund B004]
//   node test/sit/sit.js protokoll
//   node test/sit/sit.js katalog
//   node test/sit/sit.js generalprobe

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const elda = require('../../dist/index.js');
const { redigiereGeheimnisse } = require('../../dist/redigieren.js');
const { FELDER_E29 } = require('../../dist/felder-e29.js');
const { FELDER_E12 } = require('../../dist/felder-e12.js');
const { FELDER_E22 } = require('../../dist/felder-e22.js');

/** Feldtabelle je Bestandsbezeichnung (Vorlaufsatz, Position 23) für `zeigen`. */
const FELDER_NACH_BESTAND = { VR: FELDER_E29, FH: FELDER_E12, SM: FELDER_E22 };
const {
  FENSTER,
  GUELTIG_BIS,
  aktivesFenster,
  zrDatum,
  wocheVon,
  wienerZeit,
  wienerZeitpunkt,
  plusTage,
} = require('./lib/fenster');
const { endpointFuer, pruefeQuellIp } = require('./lib/sicherheit');
const { erstelleAblage, sichererName } = require('./lib/ablage');
const { erstelleSitFetch } = require('./lib/transport');
const { ladeTestdaten } = require('./lib/testdaten');
const { ladeKatalog, planFuer, alsMarkdown, fehlendeVorlaeufe } = require('./lib/katalog');
const { statusJeFall, gelaufenInWoche, enthaeltNummer, URTEILE } = require('./lib/status');
const { baueKontext } = require('./lib/kontext');
const { verfuegbar: kasseneckVerfuegbar } = require('./lib/kasseneck');
const { maskiereObus, maskiereText, ohneSeriennummer, formenDerSeriennummer } = require('./lib/maskierung');

const VERSION = require('../../package.json').version;
const SOFTWARE_ID = `Kreiseck @kreiseck/elda SIT-Werkzeug ${VERSION}`;

/** Nur für Kommandos ohne Netz: erlaubt, ein Fenster vorab durchzuspielen. Netzaufrufe nehmen immer die echte Zeit. */
const offlineJetzt = () => (process.env.SIT_JETZT ? new Date(process.env.SIT_JETZT) : new Date());

class Abbruch extends Error {}
const abbruch = (text) => {
  throw new Abbruch(text);
};

/**
 * Seriennummer aus dem Schlüsselbund (über ELDA_SIT_SERIENNUMMER) – sie steht in
 * keiner Datei. Für Befehle ohne Netz genügt ein Platzhalter: Dort wird nichts
 * gesendet, und in der Ausgabe ist OBUS ohnehin maskiert.
 */
const PLATZHALTER_SERIENNUMMER = '0000000';
function seriennummer({ pflicht }) {
  const wert = process.env.ELDA_SIT_SERIENNUMMER?.trim();
  if (!wert) {
    if (pflicht) abbruch('Es fehlt: ELDA_SIT_SERIENNUMMER.');
    return PLATZHALTER_SERIENNUMMER;
  }
  if (!/^\d{6,7}$/.test(wert)) abbruch('ELDA_SIT_SERIENNUMMER muss 6 oder 7 Ziffern haben.');
  return wert;
}

/** Alle Geheimnisse dieses Prozesses – auch die letzte Fehlerausgabe wird damit geschwärzt. */
const geheimnisse = {};
const schwaerze = (text) => (text ? redigiereGeheimnisse(String(text), geheimnisse) : text);

// --- Argumente und Pfade -------------------------------------------------------

function leseArgumente(argv) {
  const positionen = [];
  const optionen = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--ja' || a === '--nochmal') optionen[a.slice(2)] = true;
    else if (['--fenster', '--notiz', '--befund'].includes(a)) {
      if (argv[i + 1] === undefined) abbruch(`${a} braucht einen Wert.`);
      optionen[a.slice(2)] = argv[(i += 1)];
    } else if (a.startsWith('--')) abbruch(`Unbekannte Option ${a}.`);
    else positionen.push(a);
  }
  return { befehl: positionen.shift(), positionen, optionen };
}

/**
 * Ablage und Testdaten. Für Netzbefehle müssen beide ausdrücklich gesetzt sein:
 * Eine stillschweigend im Checkout angelegte zweite Ablage hätte kein
 * Laufprotokoll – Vorläufe fehlten, die Datenträgernummer begänne von vorn.
 */
function pfade({ fuerNetz }) {
  if (fuerNetz) {
    const fehlt = ['SIT_ABLAGE', 'SIT_TESTDATEN'].filter((n) => !process.env[n]);
    if (fehlt.length)
      abbruch(`Es fehlt: ${fehlt.join(', ')} – Ablage und Testdaten außerhalb des Repos angeben.`);
  }
  return {
    ablage: process.env.SIT_ABLAGE || path.join(__dirname, 'ablage'),
    testdaten: process.env.SIT_TESTDATEN || path.join(__dirname, 'testdaten.local.json'),
  };
}

function grundlagen({ fuerNetz = false } = {}) {
  const p = pfade({ fuerNetz });
  return {
    katalog: ladeKatalog(path.join(__dirname, 'faelle')),
    ablage: erstelleAblage(p.ablage),
    testdatenPfad: p.testdaten,
  };
}

function fallMitId(katalog, id) {
  const fall = katalog.find((f) => f.id === id);
  if (!fall) abbruch(`Fall ${id} gibt es nicht. \`katalog\` zeigt alle.`);
  return fall;
}

const erlaubtIn = (fall, fenster) => fall.fenster === 'jedes' || fall.fenster.includes(fenster);

// --- Netz: Fenster, Zugang, Quell-IP ------------------------------------------

/** Fenster für einen Netzaufruf: nur das echte, aktive – sonst Abbruch vor jedem Aufruf. */
function netzFenster(optionen) {
  const echt = new Date();
  const fenster = aktivesFenster(echt);
  if (!fenster) {
    const w = wienerZeit(echt);
    abbruch(
      `Kein SIT-Testfenster aktiv (${w.datum} ${w.zeit.slice(0, 5)} Wien). ` +
        `Fenster: Mo–Mi 07–09 und 12–14, nicht an testfreien Tagen, Tabelle gültig bis ${GUELTIG_BIS}.`,
    );
  }
  if (optionen.fenster && optionen.fenster !== fenster) {
    abbruch(`--fenster ${optionen.fenster} passt nicht zum aktiven Fenster ${fenster}.`);
  }
  return fenster;
}

function zugangsdaten() {
  const sn = seriennummer({ pflicht: true });
  const kundenpasswort = process.env.ELDA_SIT_KUNDENPASSWORT;
  const hash = process.env.ELDA_SIT_KUNDENPASSWORT_HASH?.trim();
  const apiKey = process.env.ELDA_API_KEY;
  const fehlt = [
    !(kundenpasswort || hash) && 'ELDA_SIT_KUNDENPASSWORT (oder ELDA_SIT_KUNDENPASSWORT_HASH)',
    !apiKey && 'ELDA_API_KEY',
    !process.env.ELDA_SIT_QUELL_IP && 'ELDA_SIT_QUELL_IP',
  ].filter(Boolean);
  if (fehlt.length) abbruch(`Es fehlt: ${fehlt.join(', ')}.`);
  if (!/^[\x21-\x7e]+$/.test(apiKey))
    abbruch('ELDA_API_KEY enthält Zeichen außerhalb von ASCII – bitte prüfen.');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    abbruch('NODE_TLS_REJECT_UNAUTHORIZED=0 ist gesetzt – so nicht.');
  const kundenpasswortHash = hash || elda.hashKundenpasswort(kundenpasswort);
  // Die Seriennummer in beiden Formen: wie vergeben (SOAP) und als OBUS (Bestand, Rücksendungen).
  const [obus, vergeben = obus] = formenDerSeriennummer(sn);
  Object.assign(geheimnisse, {
    apiKey,
    kundenpasswortHash,
    kundenpasswort,
    seriennummer: vergeben,
    seriennummerObus: obus,
  });
  return {
    seriennummer: sn,
    ...(hash ? { kundenpasswortHash: hash } : { kundenpasswort }),
    apiKey,
  };
}

/**
 * Die eigene Quell-Adresse – über einen Drittanbieter (api.ipify.org), also die
 * einzige Anfrage außerhalb des SIT. Sie trägt nichts außer der Frage selbst.
 */
async function eigeneQuellIp() {
  try {
    const antwort = await fetch('https://api.ipify.org', {
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
    });
    if (!antwort.ok) return null;
    const text = (await antwort.text()).trim();
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

async function netzZugang(testdatenPfad) {
  const testdaten = ladeTestdaten(testdatenPfad);
  const config = zugangsdaten();
  pruefeQuellIp(await eigeneQuellIp(), process.env.ELDA_SIT_QUELL_IP);
  return { testdaten, config };
}

function transferFuer(config, ablage, lauf, fenster, manipulation) {
  return elda.createEldaTransferRoh({
    ...config,
    endpoint: endpointFuer('sit'),
    transport: {
      fetchImpl: erstelleSitFetch({ ablage, lauf, geheimnisse, manipulation, fenster }),
      timeoutMs: 60_000,
    },
  });
}

// --- Sichern ------------------------------------------------------------------

function sichereRuecksendung(ablage, protokollnummer, name, roh, mehr = {}) {
  const sn = seriennummer({ pflicht: true });
  const ordner = ablage.ruecksendungsOrdner();
  // Die Seriennummer wird mit gleicher Länge maskiert – im Inhalt und im Namen,
  // den ELDA vergibt; alles andere bleibt byte-gleich.
  const { bytes, anzahl } = maskiereText(roh, sn);
  const dateiName = name == null ? name : ohneSeriennummer(name, sn);
  const ziel = ablage.schreibe(
    ordner,
    `${protokollnummer}__${sichererName(dateiName ?? 'ohne-namen')}`,
    bytes,
  );
  ablage.protokolliere({
    art: 'ruecksendung',
    protokollnummer: String(protokollnummer),
    dateiName,
    datei: path.relative(ablage.basis, ziel),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    seriennummerMaskiert: anzahl,
    ...mehr,
  });
  return ziel;
}

/** Im Fehlerpfad: alles sichern, was am Fehler hängt – Datei, roher Payload, rohe Antwort. */
function sichereAusFehler(ablage, protokollnummer, name, err) {
  const teile = [
    [err.ergebnis?.datei?.inhalt, name],
    [err.ergebnis?.rohPayload, `${name ?? 'ohne-namen'}.rohpayload`],
    [err.rohantwort, `${name ?? 'ohne-namen'}.rohantwort`],
  ];
  for (const [inhalt, n] of teile) {
    if (inhalt === undefined || inhalt === null) continue;
    sichereRuecksendung(
      ablage,
      protokollnummer,
      n,
      Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(String(inhalt), 'latin1'),
      {
        ausFehler: err.name,
      },
    );
  }
}

// --- Anzeige eines gebauten Falls ---------------------------------------------

const VORLAUF = [
  ['PROJ', 21, 2],
  ['BEST', 23, 2],
  ['DTNR', 25, 6],
  ['EDAT', 31, 8],
  ['EZEI', 39, 6],
  ['HRST', 45, 45],
  ['VERS', 150, 2],
  ['SOID', 172, 70],
];
const stueck = (satz, pos, laenge) => satz.slice(pos - 1, pos - 1 + laenge);

function zeigeBestand(inhalt) {
  const text = inhalt.toString('latin1');
  const trenner = text.includes('\r\n') ? '\r\n' : '\n';
  const saetze = text.split(trenner);
  console.log(
    `  ${inhalt.length} Bytes, ${saetze.length} Sätze, Satztrenner ${trenner === '\r\n' ? 'CRLF' : 'LF'}`,
  );
  const tabelle = FELDER_NACH_BESTAND[stueck(saetze[0], 23, 2)] ?? FELDER_E29;
  saetze.forEach((satz, i) => {
    // OBUS ist die Seriennummer – nie ausgeben.
    const kopf = `  Satz ${i + 1} (${satz.slice(0, 2)}, ${satz.length} Zeichen; OBUS *******, VSTR ${stueck(satz, 19, 2)})`;
    if (i === 0) {
      console.log(`${kopf}: ${VORLAUF.map(([n, p, l]) => `${n}=${stueck(satz, p, l).trim()}`).join('  ')}`);
    } else if (i === saetze.length - 1) {
      console.log(`${kopf}: Schlusssatz`);
    } else {
      const felder = tabelle
        .filter((f) => f.pos > 20)
        .map((f) => [f.name, stueck(satz, f.pos, f.laenge).trim()])
        .filter(([, w]) => w !== '' && !/^0+$/.test(w));
      console.log(`${kopf}: ${felder.map(([n, w]) => `${n}=${w}`).join('  ')}`);
    }
  });
}

function zeigeGebaut(fall, ergebnis) {
  console.log(`${fall.id} – ${fall.titel}`);
  console.log(`  Zweck: ${fall.zweck}`);
  console.log(`  Erwartung: ${fall.erwartung}`);
  if (ergebnis.dateiName) console.log(`  Dateiname: ${ergebnis.dateiName}`);
  if (ergebnis.inhalt) zeigeBestand(ergebnis.inhalt);
  if (ergebnis.manipulation) console.log('  Anfrage wird gezielt verändert (siehe Zweck).');
  if (ergebnis.protokollnummer) console.log(`  Protokollnummer: ${ergebnis.protokollnummer}`);
  if (fall.aufrufe > 1) console.log(`  Aufrufe: ${fall.aufrufe}`);
}

/** Hinweis, wenn ein Vorlauf zwar angenommen, aber noch nicht als „bestanden" bewertet ist. */
function hinweisVorlauf(fall, status) {
  const offen = fall.abhaengig.filter((id) => status.get(id)?.status !== 'bestanden');
  if (offen.length) {
    console.log(
      `  Hinweis: Vorlauf ${offen.join(', ')} ist noch nicht als bestanden bewertet – Folgefehler möglich.`,
    );
  }
}

// --- Befehle ohne Netz --------------------------------------------------------

function befehlKatalog() {
  const { katalog, ablage } = grundlagen();
  console.log(alsMarkdown(katalog, statusJeFall(katalog, ablage.ereignisse())));
}

/**
 * Wertet die gesicherten Rücksendungen aus – Mitteilungen und Clearing –, mit
 * den Lesern des Pakets. Clearingfälle werden über den Referenzwert dem
 * eigenen Fall zugeordnet; vom Träger selbst angelegte (Mahnung, mBGM von Amts
 * wegen) tragen einen internen Referenzwert und stehen als „Träger“.
 */
function befehlAuswerten() {
  const { ablage } = grundlagen({ fuerNetz: false });
  const ereignisse = ablage.ereignisse();
  const fallZu = new Map();
  for (const e of ereignisse) {
    if (e.art === 'lauf') for (const r of e.referenzwerte ?? []) fallZu.set(r, e.fall);
  }
  const ordner = path.join(ablage.basis, 'ruecksendungen');
  const dateien = fs.existsSync(ordner) ? fs.readdirSync(ordner).sort() : [];
  const codes = new Map();
  for (const datei of dateien) {
    const name = datei.replace(/^\d+__/, '');
    const art = elda.artDerRuecksendung(name).art;
    const inhalt = fs.readFileSync(path.join(ordner, datei));
    try {
      if (art === 'mitteilung') {
        const m = elda.liesMitteilung(inhalt);
        const refs = m.meldungen
          .map((x) => fallZu.get(x.referenznummer) ?? x.referenznummer)
          .filter((r) => r !== undefined);
        const summen = m.bestaende
          .map((b) => `${b.code} ${b.uebernommen ?? '?'}/${b.empfangen ?? '?'}`)
          .join(', ');
        console.log(`${name}: ${m.status} (${summen}) – ${[...new Set(refs)].join(', ')}`);
        for (const c of [...m.codes, ...m.meldungen.flatMap((x) => x.codes)]) {
          console.log(`  ${c.typ ?? ''} ${c.code} (Zeile ${c.zeilennummer ?? '?'}): ${c.text}`);
        }
      } else if (art === 'clearing') {
        for (const fall of elda.liesClearing(inhalt)) {
          const inh = fall.meldung.inhalt;
          const status = inh?.meldungStatus
            ? `${inh.meldungStatus} ${elda.MELDUNG_STATUS[inh.meldungStatus] ?? ''}`.trim()
            : '–';
          const zusatz = inh?.meldungStatusZusatz ? `/${inh.meldungStatusZusatz}` : '';
          const wer = fallZu.get(fall.referenzwert) ?? 'Träger';
          const zeitraum = fall.fachinformationen.find((f) => f.typ === 'Beitragszeitraum')?.wert ?? '';
          for (const info of inh?.informationen ?? []) {
            codes.set(info.code, (codes.get(info.code) ?? 0) + 1);
            if (wer === 'Träger') continue;
            console.log(
              `${name}: ${wer} ${fall.bestandBez}/${fall.satzart} ${zeitraum} → ${info.code} [${status}${zusatz}, ` +
                `${elda.DRINGLICHKEIT[info.dringlichkeit] ?? info.dringlichkeit ?? '–'}] ${info.text}`,
            );
          }
        }
      }
    } catch (err) {
      console.log(`${name}: nicht lesbar – ${err.message}`);
    }
  }
  if (codes.size > 0) {
    console.log(`Clearing gesamt: ${[...codes].map(([c, n]) => `${c} ×${n}`).join(', ')}`);
  }
}

function befehlProtokoll() {
  const { katalog, ablage } = grundlagen();
  const status = statusJeFall(katalog, ablage.ereignisse());
  for (const fall of katalog) {
    const s = status.get(fall.id);
    let letzter = '';
    if (s.letzter) {
      const w = wienerZeit(new Date(s.letzter.zeit));
      const ergebnis = s.letzter.statusCode ?? (s.letzter.fehler ? 'Fehler' : '?');
      letzter = `${w.datum} ${w.zeit.slice(0, 5)} ${s.letzter.fenster ?? ''} → ${ergebnis}`;
    }
    const urteil = s.urteil
      ? ` – ${s.urteil.notiz ?? ''}${s.urteil.befund ? ` (${s.urteil.befund})` : ''}`
      : '';
    console.log(
      `${fall.id.padEnd(4)} ${s.status.padEnd(12)} Läufe ${String(s.laeufe).padStart(2)}/${String(s.versuche).padStart(2)}  ` +
        `${letzter.padEnd(36)} Rücksendungen ${s.ruecksendungen.length}${urteil}`,
    );
  }
}

function befehlPlan(optionen) {
  const { katalog, ablage } = grundlagen();
  const jetzt = offlineJetzt();
  const fenster = optionen.fenster ?? aktivesFenster(jetzt);
  if (!fenster) abbruch('Kein Fenster aktiv – mit --fenster angeben, z. B. --fenster mo-vm.');
  zrDatum(fenster);
  const ereignisse = ablage.ereignisse();
  const plan = planFuer(
    katalog,
    fenster,
    statusJeFall(katalog, ereignisse),
    gelaufenInWoche(ereignisse, wocheVon(jetzt)),
  );
  console.log(`Plan für ${fenster} (simuliert ${zrDatum(fenster)}), Woche ${wocheVon(jetzt)}:`);
  for (const { fall, grund } of plan.reihenfolge) {
    console.log(
      `  ${fall.id}  ${fall.aktion.padEnd(10)} ${grund === 'vorlauf' ? '[Vorlauf] ' : ''}${fall.titel}${fall.gefahr ? `  ⚠ ${fall.gefahr}` : ''}`,
    );
  }
  if (plan.reihenfolge.length === 0) console.log('  nichts offen');
  for (const { fall, grund } of plan.blockiert) console.log(`  blockiert ${fall.id}: ${grund}`);
}

function befehlZeigen(positionen, optionen) {
  const { katalog, ablage, testdatenPfad } = grundlagen();
  const fall = fallMitId(katalog, positionen[0]);
  if (fall.aktion === 'beobachten')
    abbruch(`${fall.id} beobachtet nur (${fall.aus.join(', ')}) und baut nichts.`);
  const jetzt = offlineJetzt();
  const fenster =
    optionen.fenster ?? (fall.fenster === 'jedes' ? (aktivesFenster(jetzt) ?? 'mo-vm') : fall.fenster[0]);
  if (!erlaubtIn(fall, fenster))
    abbruch(`${fall.id} läuft nicht in ${fenster}, nur in ${fall.fenster.join(', ')}.`);
  const testdaten = ladeTestdaten(testdatenPfad);
  const ereignisse = ablage.ereignisse();
  const ctx = baueKontext({
    fenster,
    testdaten,
    ereignisse,
    jetzt,
    elda,
    ablage,
    softwareId: SOFTWARE_ID,
    seriennummer: seriennummer({ pflicht: false }),
  });
  console.log(`Trockenlauf in ${fenster} (simuliert ${zrDatum(fenster)}) – es wird nichts gesendet.`);
  const fehlt = fehlendeVorlaeufe(fall, gelaufenInWoche(ereignisse, wocheVon(jetzt)));
  if (fehlt.length)
    console.log(`  Hinweis: braucht ${fehlt.join(', ')} in dieser Woche – noch nicht gelaufen.`);
  zeigeGebaut(fall, fall.baue(ctx));
}

function befehlUrteil(positionen, optionen) {
  const { katalog, ablage } = grundlagen();
  const [id, status] = positionen;
  fallMitId(katalog, id);
  if (!URTEILE.includes(status)) abbruch(`Urteil muss eines von ${URTEILE.join(', ')} sein.`);
  ablage.protokolliere({ art: 'urteil', fall: id, status, notiz: optionen.notiz, befund: optionen.befund });
  console.log(`${id}: ${status}${optionen.notiz ? ` – ${optionen.notiz}` : ''}`);
}

/**
 * Baut die ganze Woche ohne Netz: jeder Fall in seinem ersten erlaubten Fenster
 * der laufenden Woche, in einer Wegwerf-Ablage, jeder Sendefall gilt als mit 000
 * angenommen. So zeigt sich vor dem Montag, ob jeder Fall mit den echten
 * Testdaten baut – auch die, die einen Vorlauf brauchen. Die Wegwerf-Ablage wird
 * danach gelöscht.
 */
function befehlGeneralprobe() {
  const { katalog, testdatenPfad } = grundlagen();
  const testdaten = ladeTestdaten(testdatenPfad);
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'sit-generalprobe-'));
  const sn = seriennummer({ pflicht: false });
  try {
    const probe = erstelleAblage(ordner);
    // Wie die Läufe: eine erfundene Rücksendung, damit T15 („nochmal abholen“) baut.
    probe.protokolliere({ art: 'ruecksendung', protokollnummer: '155000001', dateiName: 'probe.xml' });
    const heute = wienerZeit(offlineJetzt());
    const montag = plusTage(heute.datum, 1 - heute.wochentag);
    const zeitpunkt = (fenster) => {
      const f = FENSTER[fenster];
      return wienerZeitpunkt(plusTage(montag, f.wochentag - 1), `${f.von.slice(0, 2)}:30:00`);
    };

    const nachId = new Map(katalog.map((f) => [f.id, f]));
    const fertig = new Set();
    let fehler = 0;
    let nummer = 0;
    const bau = (fall) => {
      if (fertig.has(fall.id)) return;
      fertig.add(fall.id);
      fall.abhaengig.forEach((id) => bau(nachId.get(id)));
      if (fall.aktion === 'beobachten') return;
      if (fall.braucht === 'kasseneck' && !kasseneckVerfuegbar()) {
        console.log(
          `übersprungen ${fall.id}: braucht KASSENECK_PFAD (kasseneck-Checkout mit functions-lohn)`,
        );
        return;
      }
      const fenster = fall.fenster === 'jedes' ? 'mo-vm' : fall.fenster[0];
      const jetzt = zeitpunkt(fenster);
      try {
        const ctx = baueKontext({
          fenster,
          testdaten,
          ereignisse: probe.ereignisse(),
          jetzt,
          elda,
          ablage: probe,
          seriennummer: sn,
        });
        const e = fall.baue(ctx);
        if (fall.aktion === 'senden') {
          const lauf = probe.neuerLauf(fall.id);
          probe.schreibe(lauf.ordner, 'bestand.dat', maskiereObus(e.inhalt, sn));
          nummer += 1;
          probe.protokolliere({
            art: 'lauf',
            fall: fall.id,
            zeit: jetzt.toISOString(),
            aktion: 'senden',
            statusCode: '000',
            zr: ctx.zr,
            ordner: lauf.id,
            dateiName: e.dateiName,
            referenzwerte: e.referenzwerte,
            protokollnummer: String(nummer),
          });
        }
        const satzart = e.inhalt ? e.inhalt.toString('latin1').split(/\r?\n/)[1]?.slice(0, 2) : '';
        console.log(
          `ok     ${fall.id} ${fenster} ${fall.aktion}${satzart ? ` ${satzart}` : ''}${e.inhalt ? ` ${e.inhalt.length} Bytes` : ''}`,
        );
      } catch (err) {
        fehler += 1;
        console.log(`FEHLER ${fall.id} ${fenster}: ${err.message}`);
      }
    };
    katalog.forEach(bau);
    console.log(fehler ? `${fehler} Fall/Fälle bauen nicht.` : 'Alle Fälle bauen.');
    if (fehler) process.exitCode = 1;
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true });
  }
}

// --- Befehle mit Netz ---------------------------------------------------------

async function befehlLauf(positionen, optionen) {
  const { katalog, ablage, testdatenPfad } = grundlagen({ fuerNetz: true });
  if (positionen.length === 0) abbruch('Welche Fälle? z. B. `lauf Z01 V01 V02`.');
  const doppelt = positionen.filter((id, i) => positionen.indexOf(id) !== i);
  if (doppelt.length) abbruch(`Fall ${doppelt[0]} steht zweimal im Aufruf.`);
  const faelle = positionen.map((id) => fallMitId(katalog, id));
  for (const f of faelle)
    if (f.aktion === 'beobachten') abbruch(`${f.id} beobachtet nur und hat keinen eigenen Lauf.`);

  // Vor jedem Netzaufruf: Fenster, erlaubte Fälle, Vorläufe dieser Woche (oder weiter vorn im selben Aufruf),
  // kein zweites Senden derselben Meldung in dieser Woche ohne --nochmal.
  const fenster = netzFenster(optionen);
  for (const f of faelle) if (!erlaubtIn(f, fenster)) abbruch(`${f.id} läuft nicht in ${fenster}.`);
  const gelaufen = gelaufenInWoche(ablage.ereignisse(), wocheVon(new Date()));
  faelle.forEach((f, i) => {
    const vorher = new Set([...gelaufen, ...faelle.slice(0, i).map((x) => x.id)]);
    const fehlt = fehlendeVorlaeufe(f, vorher);
    if (fehlt.length)
      abbruch(`${f.id} braucht ${fehlt.join(', ')} in dieser Woche – zuerst ${fehlt.join(', ')}.`);
    if (f.aktion === 'senden' && gelaufen.has(f.id) && !optionen.nochmal) {
      abbruch(`${f.id} ist diese Woche schon mit 000 gesendet – ein zweites Mal nur mit --nochmal.`);
    }
  });

  const veraendert = faelle.filter((f) => f.aktion !== 'auflisten');
  if (veraendert.length > 0 && !optionen.ja) {
    // Trockenlauf: ohne Zugangsdaten, ohne Quell-IP-Abfrage, ohne Netz.
    const testdaten = ladeTestdaten(testdatenPfad);
    console.log(
      `Trockenlauf in ${fenster} – ${veraendert.map((f) => f.id).join(', ')} würden senden bzw. abholen. Mit --ja ausführen.`,
    );
    for (const fall of faelle) {
      try {
        const ctx = baueKontext({
          fenster,
          testdaten,
          ereignisse: ablage.ereignisse(),
          jetzt: new Date(),
          elda,
          ablage,
          softwareId: SOFTWARE_ID,
          seriennummer: seriennummer({ pflicht: false }),
        });
        zeigeGebaut(fall, fall.baue(ctx));
      } catch (err) {
        console.log(`${fall.id} – baut erst nach seinem Vorlauf: ${err.message}`);
      }
    }
    return;
  }

  const { testdaten, config } = await netzZugang(testdatenPfad);
  for (const fall of faelle) {
    if (aktivesFenster(new Date()) !== fenster)
      abbruch(`Fenster ${fenster} ist zu – ${fall.id} und alle weiteren nicht gelaufen.`);
    // Für jeden Fall frisch: Vorläufe aus demselben Aufruf sind dann protokolliert –
    // und ist einer davon gescheitert, wird der abhängige Fall übersprungen.
    const ereignisse = ablage.ereignisse();
    const fehlt = fehlendeVorlaeufe(fall, gelaufenInWoche(ereignisse, wocheVon(new Date())));
    if (fehlt.length) {
      ablage.protokolliere({
        art: 'uebersprungen',
        fall: fall.id,
        fenster,
        grund: `Vorlauf ${fehlt.join(', ')} ohne 000`,
      });
      console.log(`${fall.id} übersprungen: ${fehlt.join(', ')} ist in dieser Woche nicht mit 000 gelaufen.`);
      continue;
    }
    hinweisVorlauf(fall, statusJeFall(katalog, ereignisse));

    let ergebnis;
    try {
      const ctx = baueKontext({
        fenster,
        testdaten,
        ereignisse,
        jetzt: new Date(),
        elda,
        ablage,
        softwareId: SOFTWARE_ID,
        seriennummer: config.seriennummer,
      });
      ergebnis = fall.baue(ctx);
    } catch (err) {
      ablage.protokolliere({ art: 'uebersprungen', fall: fall.id, fenster, grund: schwaerze(err.message) });
      console.log(`${fall.id} übersprungen – baut nicht: ${schwaerze(err.message)}`);
      continue;
    }

    const lauf = ablage.neuerLauf(fall.id);
    // Gespeichert mit maskiertem OBUS; gesendet wird der vollständige Bestand.
    if (ergebnis.inhalt) {
      ablage.schreibe(lauf.ordner, 'bestand.dat', maskiereObus(ergebnis.inhalt, config.seriennummer));
    }
    const transfer = transferFuer(config, ablage, lauf, fenster, ergebnis.manipulation);

    for (let aufruf = 1; aufruf <= (fall.aufrufe ?? 1); aufruf += 1) {
      let r;
      try {
        if (fall.aktion === 'auflisten') r = await transfer.ruecksendungenAuflisten();
        else if (fall.aktion === 'senden')
          r = await transfer.senden({ dateiName: ergebnis.dateiName, inhalt: ergebnis.inhalt });
        else r = await transfer.empfangen(ergebnis.protokollnummer);
      } catch (err) {
        if (fall.aktion === 'empfangen')
          sichereAusFehler(ablage, ergebnis.protokollnummer, `${fall.id}`, err);
        r = { fehler: `${err.name}: ${schwaerze(err.message)}` };
      }
      if (r.datei?.inhalt) {
        sichereRuecksendung(ablage, ergebnis.protokollnummer, r.datei.name, r.datei.inhalt, {
          dateiTyp: r.datei.dateiTyp,
        });
      }
      ablage.protokolliere({
        art: 'lauf',
        fall: fall.id,
        fenster,
        zr: zrDatum(fenster),
        aktion: fall.aktion,
        aufruf,
        ordner: lauf.id,
        statusCode: r.statusCode,
        ok: r.ok,
        meldung: schwaerze(r.meldung),
        protokollnummer: r.protokollnummer,
        dateiId: r.dateiId,
        eldaZeitstempel: r.eldaZeitstempel,
        anzahl: r.ruecksendungen?.length,
        ruecksendungen: r.ruecksendungen?.map((x) => ohneSeriennummer(x.dateiName, config.seriennummer)),
        dateiName: ergebnis.dateiName,
        referenzwerte: ergebnis.referenzwerte,
        fehler: r.fehler,
        http: lauf.http,
      });
      const text =
        r.fehler ??
        `${r.statusCode}${r.protokollnummer ? ` Protokollnummer ${r.protokollnummer}` : ''}${r.meldung ? ` „${schwaerze(r.meldung)}"` : ''}`;
      console.log(`${fall.id} ${fall.aktion}${fall.aufrufe > 1 ? ` (${aufruf})` : ''} → ${text}`);
      if (lauf.http?.wartung) abbruch('SIT in Wartung (HTTP 403 „Wartung") – Lauf beendet.');
      // Bekannter ELDA-Fehler auf der SIT (lswh, 05.10.2026): Auflisten bei leerer
      // Outbox liefert 500. Kein Zugangsproblem – Senden funktioniert trotzdem.
      if (fall.aktion === 'auflisten' && r.statusCode === '500') {
        console.log(
          '  Hinweis: 500 beim Auflisten = leere Outbox (SIT-Fehler, Befund B004), kein Zugangsfehler.',
        );
      }
    }
  }
  console.log(
    'Rücksendungen nach der Sammelverarbeitung mit `abholen` ansehen und mit `abholen --ja` sichern.',
  );
}

async function befehlAbholen(optionen) {
  const { ablage, testdatenPfad } = grundlagen({ fuerNetz: true });
  const fenster = netzFenster(optionen);
  const { config } = await netzZugang(testdatenPfad);
  const lauf = ablage.neuerLauf('abholen');

  let liste;
  try {
    liste = await transferFuer(config, ablage, lauf, fenster).ruecksendungenAuflisten();
  } catch (err) {
    ablage.protokolliere({
      art: 'abholung',
      ordner: lauf.id,
      fehler: `${err.name}: ${schwaerze(err.message)}`,
    });
    abbruch(`Auflisten gescheitert: ${err.name}: ${schwaerze(err.message)} (Mitschnitt: ${lauf.id})`);
  }
  ablage.protokolliere({
    art: 'abholung',
    ordner: lauf.id,
    statusCode: liste.statusCode,
    anzahl: liste.ruecksendungen.length,
  });
  if (!liste.ok && liste.statusCode === '500') {
    // Bekannter SIT-Fehler (lswh, 05.10.2026): 500 statt einer leeren Liste.
    console.log('Outbox leer (SIT antwortet dann mit 500, Befund B004).');
    return;
  }
  if (!liste.ok) abbruch(`Auflisten → ${liste.statusCode} „${schwaerze(liste.meldung) ?? ''}"`);

  const laeufe = ablage.ereignisse().filter((e) => e.art === 'lauf' && e.protokollnummer);
  const zuFall = (dateiName) => laeufe.find((l) => enthaeltNummer(dateiName, l.protokollnummer))?.fall ?? '–';
  console.log(`${liste.ruecksendungen.length} Rücksendung(en) offen:`);
  for (const r of liste.ruecksendungen)
    console.log(
      `  ${r.protokollnummer}  ${ohneSeriennummer(r.dateiName, config.seriennummer)}  (Fall ${zuFall(r.dateiName)})`,
    );
  if (!optionen.ja) {
    console.log('Mit --ja werden alle abgeholt – auf der SIT gehört die Outbox nur uns.');
    return;
  }

  for (const r of liste.ruecksendungen) {
    const einzel = ablage.neuerLauf(`empfangen-${r.protokollnummer}`);
    try {
      const e = await transferFuer(config, ablage, einzel, fenster).empfangen(r.protokollnummer);
      if (e.datei?.inhalt) {
        const ziel = sichereRuecksendung(
          ablage,
          r.protokollnummer,
          e.datei.name ?? r.dateiName,
          e.datei.inhalt,
          {
            dateiTyp: e.datei.dateiTyp,
          },
        );
        console.log(`  gesichert ${r.protokollnummer} → ${path.relative(process.cwd(), ziel)}`);
      } else {
        console.log(`  ${r.protokollnummer} → ${e.statusCode} „${schwaerze(e.meldung) ?? ''}"`);
      }
      ablage.protokolliere({
        art: 'abholung',
        protokollnummer: r.protokollnummer,
        ordner: einzel.id,
        statusCode: e.statusCode,
      });
    } catch (err) {
      sichereAusFehler(ablage, r.protokollnummer, r.dateiName, err);
      const text = `${err.name}: ${schwaerze(err.message)}`;
      ablage.protokolliere({
        art: 'abholung',
        protokollnummer: r.protokollnummer,
        ordner: einzel.id,
        fehler: text,
      });
      console.log(`  ${r.protokollnummer} → Fehler ${text} (Mitschnitt: ${einzel.id})`);
      if (/Fenster .* ist zu/.test(err.message)) abbruch('Fenster zu – Abholen beendet.');
    }
  }
}

async function befehlPruefen(optionen) {
  const { katalog, testdatenPfad } = grundlagen({ fuerNetz: true });
  console.log(`Katalog: ${katalog.length} Fälle geprüft.`);
  ladeTestdaten(testdatenPfad);
  console.log(`Testdaten: in Ordnung.`);
  const fenster = aktivesFenster(new Date());
  console.log(
    `Fenster: ${fenster ? `${fenster} (simuliert ${zrDatum(fenster)})` : 'keines aktiv'}; Tabelle gültig bis ${GUELTIG_BIS}.`,
  );
  if (!fenster) {
    console.log('Ohne aktives Fenster kein Netzaufruf.');
    return;
  }
  await befehlLauf(['Z01'], optionen);
}

// --- Start --------------------------------------------------------------------

async function main() {
  const { befehl, positionen, optionen } = leseArgumente(process.argv.slice(2));
  switch (befehl) {
    case 'pruefen':
      return befehlPruefen(optionen);
    case 'plan':
      return befehlPlan(optionen);
    case 'zeigen':
      return befehlZeigen(positionen, optionen);
    case 'lauf':
    case 'senden':
      return befehlLauf(positionen, optionen);
    case 'abholen':
      return befehlAbholen(optionen);
    case 'urteil':
      return befehlUrteil(positionen, optionen);
    case 'auswerten':
      return befehlAuswerten();
    case 'protokoll':
      return befehlProtokoll();
    case 'katalog':
      return befehlKatalog();
    case 'generalprobe':
      return befehlGeneralprobe();
    default:
      abbruch(`Befehl fehlt oder unbekannt: ${befehl ?? '(keiner)'}. Siehe README.md.`);
  }
}

// Nie das Fehlerobjekt ausgeben: Ein SOAP-Fault trägt in `detail` womöglich die
// Anfrage samt Zugangsdaten. Nur Name und geschwärzte Meldung.
main().catch((err) => {
  let text;
  try {
    text = schwaerze(err.message);
  } catch {
    text = '(Meldung enthält ein Geheimnis und wird nicht ausgegeben)';
  }
  console.error(err instanceof Abbruch ? `Abbruch: ${text}` : `Fehler: ${err.name}: ${text}`);
  process.exitCode = 1;
});
