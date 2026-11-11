import { EldaError } from './errors';
import {
  DKT_ADRESSE,
  DKT_ANGEHOERIGER,
  DKT_BEGINN,
  DKT_BEZUG,
  DKT_BLOCKLAENGE_LEISTUNG,
  DKT_BLOCK_BEGRUENDUNG,
  DKT_BLOCK_DIAGNOSE,
  DKT_BLOCK_LEISTUNG,
  DKT_DATEIENDE,
  DKT_EKVK,
  DKT_EKVK_PATIENT,
  DKT_EKVK_WEITERE,
  DKT_KOPF,
  DKT_KOPFLAENGE,
  DKT_LEISTUNG,
  DKT_PAUSCHALE,
  DKT_SATZLAENGE,
  DKT_SCHLUSS,
  DKT_SUMME,
  DKT_TEXT,
  DKT_TRANSPORT,
  DKT_VERSICHERTER,
  DKT_VORLAUF,
  type DktFeld,
} from './dkt-felder';
import { ABLG, ABST, BEST_DKT, type AblehnungsGruppe } from './dkt-codes';

/**
 * Liest einen DKT-Datenbestand — die eigene Abrechnung (BEST `TK`/`T1`, Abfolge
 * E.2.1) ebenso wie den Retourdatenträger des Trägers (BEST `TR`, Abfolge E.2.2,
 * DKT 2.2 Seite 50). Gelesen wird, was im Satz steht: Datumsangaben bleiben im
 * Format des Dokuments (`TTMMJJ`), weil das Jahrhundert darin nicht steht;
 * Geldbeträge kommen als ganze Cent, bei den Summensätzen mit dem Vorzeichen aus
 * VZS/VZK/VZZS/VZR (D.65) verrechnet.
 *
 * Geprüft werden nur Dinge, ohne die das Lesen keinen Sinn ergibt: Satzlänge 128,
 * die Abfolge der Satzarten, lückenlose SATNR, gleicher Satzkopf in allen Sätzen
 * (ein Vertragspartner, ein Zeitraum; B.3), die Zähler im Dateiende und SANZ.
 * Reservefelder werden nicht geprüft — das Muster E.3 trägt in SART 00 noch die
 * frühere DVR-Nummer.
 */

/** Ein Ablehnungsgrund (D.1); unbekannte Codes kommen ohne Text zurück. */
export interface DktAblehnung {
  code: string;
  gruppe?: AblehnungsGruppe;
  text?: string;
}

/** Satzkopf (F.3). */
export interface DktKopf {
  abrechnungsstelle: string;
  bundeslandAbrechnungsstelle: string;
  vpnr: string;
  adresscode: string;
  /** AJAHR, zweistellig (D.6). */
  abrechnungsjahr: string;
  abrechnungszeitraum: string;
}

export interface DktGeleseneLeistung {
  /** `L` Leistung; in SART 62 `A` Abzug oder `N` Nachverrechnung durch den SV-Träger (D.13). */
  art: 'L' | 'A' | 'N';
  position: string;
  tarifCent: number;
  anzahl: number;
  /** BETR: bei SART 21 TAR × ANZKM, bei SART 22 der anerkannte Betrag (D.11). */
  betragCent: number;
  ustProzent: number;
  kostenbeteiligung?: { satz: string; bruttoCent: number };
  ablehnungsgrund?: DktAblehnung;
  bewilligungsnummer?: string;
  /** Die Begründungsblöcke, die unmittelbar auf diesen Leistungsblock folgen (F.10). */
  begruendungen: string[];
}

export interface DktGelesenerFall {
  /** SART 41 statt 01: Korrektur bzw. Nachverrechnung durch den SV-Träger (E.2.2). */
  korrektur: boolean;
  versicherter: {
    traeger: string;
    bundesland?: string;
    /** BSNR; bei SART 41 nicht belegt (D.14). */
    belegnummer?: number;
    familienname: string;
    vorname: string;
    vsnr: string;
    kategorie?: string;
    verordnerVpnr: string;
    verordnerName?: string;
    fachgebiet?: string;
    /** UEDAT, TTMMJJ. */
    antragsdatum: string;
    /** VORZ (D.65): `1` = Werte negativ. */
    vorzeichen: string;
  };
  bezug?: {
    vpnrLeistungserbringer?: string;
    abrechnungsjahr?: string;
    abrechnungszeitraum?: string;
    rechnungsnummer?: string;
    belegnummer?: number;
    ablehnungsgrund?: DktAblehnung;
  };
  /** SART 39 auf Transportebene. */
  texte: string[];
  angehoeriger?: { vsnr: string; familienname: string; vorname: string };
  adresse?: { staat: string; plz: string; strasse: string; ort: string; uvAktenzeichen?: string };
  ekvk: { patient?: Record<string, string>; weitere?: Record<string, string> };
  transport: {
    /** LDAT, TTMMJJ. */
    datum: string;
    /** HHMM; ANK/WZV/WZB `9999` = Grundstellung, END `9999` = über 24 Stunden (D.66). */
    beginn: string;
    ankunft: string;
    warteVon: string;
    warteBis: string;
    ende: string;
    nummer?: string;
    kennzeichen?: string;
    vonOrt?: string;
    /** PLZV wie im Satz, z. B. `AUT 6330` oder eine Vertragspartnernummer. */
    von: string;
    nachOrt?: string;
    nach: string;
    grund: string;
    art: string;
    fahrzeug: string;
    zeitkritisch: boolean;
    befoerderung: string;
    vpnrLeistungserbringer?: string;
    naca?: string;
  };
  /** RNR der SART 21/22/62 — Rechnungsnummer des Transportes (D.43). */
  rechnungsnummer: string;
  leistungen: DktGeleseneLeistung[];
  diagnose?: { kennzeichen: string; inhalt: string };
}

export interface DktGeleseneSumme {
  sart: '23' | '24' | '64';
  /** Leer bei SART 64 (D.43). */
  rechnungsnummer?: string;
  /** RDAT, TTMMJJ; leer bei SART 64 (D.16). */
  rechnungsdatum?: string;
  ustProzent: number;
  anzahlLeistungsbloecke: number;
  summeCent: number;
  kostenbeteiligungCent: number;
  zwischensummeCent: number;
  ustBetragCent: number;
  rechnungsbetragCent: number;
  status: { code: string; text?: string };
  kostenbeteiligungUstCent: number;
  /** PSKO in Hundertstel Prozent: „2 Stellen plus 2 Nachkommastellen" (D.40). */
  skontoHundertstelProzent: number;
  skontoCent: number;
}

export interface DktGelesenePauschale {
  vpnrLeistungserbringer: string;
  /** `A` Abzug, `Z` Zahlung (D.35). */
  art: string;
  nettoCent: number;
  ustCent: number;
  bruttoCent: number;
  begruendung: string;
}

export interface DktGelesenerBestand {
  /** `true` bei BEST `TR` (Retourdatenträger). */
  rueckmeldung: boolean;
  vorlauf: Record<string, string>;
  kopf: DktKopf;
  beginn: Record<string, string>;
  faelle: DktGelesenerFall[];
  summen: DktGeleseneSumme[];
  korrekturen: DktGelesenerFall[];
  korrekturSummen: DktGeleseneSumme[];
  pauschalen: DktGelesenePauschale[];
  /** SART 39 auf Rechnungsebene. */
  hinweise: string[];
  dateiende: Record<string, number>;
  schluss: Record<string, string>;
}

function fehler(zeile: number, text: string): EldaError {
  return new EldaError(`DKT, Satz ${zeile}: ${text}`);
}

/** Schneidet die Felder einer Tabelle aus einem Text, ungetrimmt. */
function felder(tabelle: readonly DktFeld[], text: string): Record<string, string> {
  const werte: Record<string, string> = {};
  for (const f of tabelle) werte[f.name] = text.slice(f.pos - 1, f.pos - 1 + f.laenge);
  return werte;
}

const leer = (s: string | undefined): boolean => s === undefined || s.trim() === '';
const optional = (s: string | undefined): string | undefined => (leer(s) ? undefined : s!.trimEnd());
/** Numerisches Feld: leer oder nur Nullen ist Grundstellung (F.1). */
const optionalN = (s: string | undefined): string | undefined => (leer(s) || /^0+$/.test(s!) ? undefined : s);

/** Setzt eine optionale Eigenschaft nur, wenn ein Wert da ist — gelesene Objekte tragen keine `undefined`-Schlüssel. */
function setze<T extends object, K extends keyof T>(ziel: T, schluessel: K, wert: T[K] | undefined): void {
  if (wert !== undefined) ziel[schluessel] = wert;
}

function zahl(s: string | undefined, zeile: number, feld: string): number {
  if (s === undefined || !/^\d+$/.test(s)) throw fehler(zeile, `${feld} ist nicht numerisch.`);
  return Number(s);
}

function ablehnung(code: string | undefined): DktAblehnung | undefined {
  const c = optionalN(code);
  if (c === undefined) return undefined;
  const zweistellig = c.slice(-2);
  const eintrag = ABLG[zweistellig];
  return eintrag === undefined ? { code: c } : { code: c, gruppe: eintrag.gruppe, text: eintrag.text };
}

/**
 * Zerlegt die Datei in Sätze. Getrennt durch CRLF oder LF; ohne Trenner in
 * Stücke zu 128 Zeichen. Gelesen wird als ISO-8859-1, damit ein Byte ein Zeichen
 * bleibt und die Positionen stimmen.
 */
function saetze(inhalt: Buffer | string): string[] {
  const text = typeof inhalt === 'string' ? inhalt : inhalt.toString('latin1');
  let zeilen: string[];
  if (/[\r\n]/.test(text)) {
    zeilen = text.split(/\r?\n/);
    if (zeilen[zeilen.length - 1] === '') zeilen.pop();
  } else {
    if (text.length % DKT_SATZLAENGE !== 0) {
      throw new EldaError(
        `DKT: Datei ohne Satztrenner ist kein Vielfaches von ${DKT_SATZLAENGE} Zeichen lang.`,
      );
    }
    zeilen = [];
    for (let i = 0; i < text.length; i += DKT_SATZLAENGE) zeilen.push(text.slice(i, i + DKT_SATZLAENGE));
  }
  zeilen.forEach((z, i) => {
    if (z.length !== DKT_SATZLAENGE) throw fehler(i + 1, `${z.length} statt ${DKT_SATZLAENGE} Zeichen.`);
  });
  if (zeilen.length < 4)
    throw new EldaError('DKT: Ein Bestand hat mindestens Vorlauf, SART 00, SART 99 und Schlusssatz.');
  return zeilen;
}

function leistungsbloecke(
  zeile: number,
  bloecke: string[],
  fall: DktGelesenerFall,
  erlaubt: readonly string[],
): void {
  for (const b of bloecke) {
    if (leer(b)) continue;
    const kz = b[0]!;
    if (kz === 'B') {
      const letzte = fall.leistungen[fall.leistungen.length - 1];
      if (letzte === undefined)
        throw fehler(zeile, 'Begründungsblock ohne vorangehenden Leistungsblock (F.10).');
      letzte.begruendungen.push(felder(DKT_BLOCK_BEGRUENDUNG, b)['GRUN']!.trimEnd());
    } else if (kz === 'D') {
      if (fall.diagnose !== undefined) throw fehler(zeile, 'Mehr als ein Diagnoseblock (E.2.1: „1 x D").');
      const d = felder(DKT_BLOCK_DIAGNOSE, b);
      fall.diagnose = { kennzeichen: d['DIAKZ']!, inhalt: d['DIAGN']!.trimEnd() };
    } else if (erlaubt.includes(kz)) {
      const l = felder(DKT_BLOCK_LEISTUNG, b);
      const leistung: DktGeleseneLeistung = {
        art: kz as 'L' | 'A' | 'N',
        position: l['POSNR']!,
        tarifCent: zahl(l['TAR'], zeile, 'TAR'),
        anzahl: zahl(l['ANZKM'], zeile, 'ANZKM'),
        betragCent: zahl(l['BETR'], zeile, 'BETR'),
        ustProzent: zahl(l['UST'], zeile, 'UST'),
        begruendungen: [],
      };
      const kbs = optionalN(l['KBS']);
      if (kbs !== undefined)
        leistung.kostenbeteiligung = { satz: kbs, bruttoCent: zahl(l['SUMKB'], zeile, 'SUMKB') };
      const abl = ablehnung(l['ABLG']);
      if (abl !== undefined) leistung.ablehnungsgrund = abl;
      const bew = optional(l['BEWNR']);
      if (bew !== undefined) leistung.bewilligungsnummer = bew;
      fall.leistungen.push(leistung);
    } else {
      throw fehler(zeile, `Blockkennzeichen '${kz}' ist hier nicht zulässig (D.13).`);
    }
  }
}

function summe(zeile: number, sart: '23' | '24' | '64', s: Record<string, string>): DktGeleseneSumme {
  const vz = (feld: string): number => (s[feld] === '1' ? -1 : 1);
  const status = s['ABST']!;
  const ergebnis: DktGeleseneSumme = {
    sart,
    ustProzent: zahl(s['UST'], zeile, 'UST'),
    anzahlLeistungsbloecke: zahl(s['ANZLB'], zeile, 'ANZLB'),
    summeCent: vz('VZS') * zahl(s['SUM'], zeile, 'SUM'),
    kostenbeteiligungCent: vz('VZK') * zahl(s['KOBE'], zeile, 'KOBE'),
    zwischensummeCent: vz('VZZS') * zahl(s['ZSUM'], zeile, 'ZSUM'),
    ustBetragCent: vz('VZS') * zahl(s['UBE'], zeile, 'UBE'),
    rechnungsbetragCent: vz('VZR') * zahl(s['REBE'], zeile, 'REBE'),
    status: Object.prototype.hasOwnProperty.call(ABST, status)
      ? { code: status, text: ABST[status as keyof typeof ABST] }
      : { code: status },
    kostenbeteiligungUstCent: vz('VZK') * zahl(s['KOBEUST'], zeile, 'KOBEUST'),
    skontoHundertstelProzent: zahl(s['PSKO'], zeile, 'PSKO'),
    skontoCent: zahl(s['SKO'], zeile, 'SKO'),
  };
  const rnr = optional(s['RNR']);
  if (rnr !== undefined) ergebnis.rechnungsnummer = rnr;
  const rdat = optionalN(s['RDAT']);
  if (rdat !== undefined) ergebnis.rechnungsdatum = rdat;
  return ergebnis;
}

/**
 * Rang einer Satzart innerhalb der Ebene 2 laut E.2.1/E.2.2: 01 → 11 → 39 → 02
 * → 06 → 07 → 20 → 21. Ein Satz darf keinen kleineren Rang haben als sein
 * Vorgänger in derselben Ebene.
 */
const RANG: Readonly<Record<string, number>> = {
  '11': 1,
  '39': 2,
  '02': 3,
  '42': 3,
  '06': 4,
  '07': 5,
  '20': 6,
  '60': 6,
  '21': 7,
  '22': 7,
  '62': 7,
};

/** Liest einen DKT-Datenbestand; siehe Modulbeschreibung. */
export function liesDktBestand(inhalt: Buffer | string): DktGelesenerBestand {
  const zeilen = saetze(inhalt);
  const vorlaufText = zeilen[0]!;
  const schlussText = zeilen[zeilen.length - 1]!;
  if (vorlaufText.slice(0, 2) !== '00') throw fehler(1, 'Der erste Satz ist kein Vorlaufsatz (F.2).');
  if (schlussText.slice(0, 2) !== '99')
    throw fehler(zeilen.length, 'Der letzte Satz ist kein Schlusssatz (F.14.1).');
  const vorlauf = felder(DKT_VORLAUF, vorlaufText);
  const schluss = felder(DKT_SCHLUSS, schlussText);
  const rueckmeldung = vorlauf['BEST'] === BEST_DKT.rueckmeldung;
  const leistungsSart = rueckmeldung ? '22' : '21';
  const summenSart = rueckmeldung ? '24' : '23';

  const mitte = zeilen.slice(1, -1);
  const ersterKopf = mitte[0]!.slice(0, DKT_KOPFLAENGE - 5);
  const kopfFelder = felder(DKT_KOPF, mitte[0]!.slice(0, DKT_KOPFLAENGE));

  const bestand: DktGelesenerBestand = {
    rueckmeldung,
    vorlauf,
    kopf: {
      abrechnungsstelle: kopfFelder['VSTRA']!,
      bundeslandAbrechnungsstelle: kopfFelder['BLNDA']!,
      vpnr: kopfFelder['VPNR']!,
      adresscode: kopfFelder['VPADR']!,
      abrechnungsjahr: kopfFelder['AJAHR']!,
      abrechnungszeitraum: kopfFelder['ABZR']!,
    },
    beginn: {},
    faelle: [],
    summen: [],
    korrekturen: [],
    korrekturSummen: [],
    pauschalen: [],
    hinweise: [],
    dateiende: {},
    schluss,
  };

  // Phasen der Abfolge: beginn → faelle → summen → korrekturen → korrekturSummen
  // → pauschalen → hinweise → ende.
  type Phase =
    'beginn' | 'faelle' | 'summen' | 'korrekturen' | 'korrekturSummen' | 'pauschalen' | 'hinweise' | 'ende';
  let phase = 'beginn' as Phase;
  let fall: DktGelesenerFall | undefined;
  let rang = 0;
  const zaehler: Record<string, number> = {};
  const zaehle = (sart: string): void => {
    zaehler[sart] = (zaehler[sart] ?? 0) + 1;
  };

  const schliesseFall = (zeile: number): void => {
    if (fall === undefined) return;
    if (fall.transport.datum === '')
      throw fehler(zeile, 'Ebene 2 ohne Transportsatz (E.2.1: „1 x SART 20").');
    if (fall.leistungen.length === 0) throw fehler(zeile, 'Ebene 2 ohne Leistungsblock (E.2.1: „>=1 x L").');
    fall = undefined;
  };

  mitte.forEach((text, i) => {
    const zeile = i + 2;
    if (text.slice(0, DKT_KOPFLAENGE - 5) !== ersterKopf) {
      throw fehler(
        zeile,
        'Satzkopf weicht ab — ein Bestand gilt einem Vertragspartner und einem Zeitraum (B.3).',
      );
    }
    const satnr = Number(text.slice(DKT_KOPFLAENGE - 5, DKT_KOPFLAENGE));
    if (satnr !== i + 1) throw fehler(zeile, `SATNR ${satnr} statt ${i + 1} — lückenlos ab 00001 (D.46).`);
    const sart = text.slice(20, 22);
    zaehle(sart);

    if (phase === 'beginn') {
      if (sart !== '00') throw fehler(zeile, 'Nach dem Vorlaufsatz folgt SART 00 Datensatzbeginn (E.2.1).');
      bestand.beginn = felder(DKT_BEGINN, text);
      phase = 'faelle';
      return;
    }

    const neuerFall = (korrektur: boolean): void => {
      schliesseFall(zeile);
      const v = felder(DKT_VERSICHERTER, text);
      const versicherter: DktGelesenerFall['versicherter'] = {
        traeger: v['VSTRL']!,
        familienname: v['ZUNVS']!.trimEnd(),
        vorname: v['VONVS']!.trimEnd(),
        vsnr: v['VSNRV']!,
        verordnerVpnr: v['VPNUW']!,
        antragsdatum: v['UEDAT']!,
        vorzeichen: v['VORZ']!,
      };
      const bl = optionalN(v['BLNDL']);
      if (bl !== undefined) versicherter.bundesland = bl;
      const bsnr = optionalN(v['BSNR']);
      if (bsnr !== undefined) versicherter.belegnummer = Number(bsnr);
      const kat = optionalN(v['KAT']);
      if (kat !== undefined) versicherter.kategorie = kat;
      const zunuw = optional(v['ZUNUW']);
      if (zunuw !== undefined) versicherter.verordnerName = zunuw;
      const fachu = optionalN(v['FACHU']);
      if (fachu !== undefined) versicherter.fachgebiet = fachu;
      fall = {
        korrektur,
        versicherter,
        texte: [],
        ekvk: {},
        transport: {
          datum: '',
          beginn: '',
          ankunft: '',
          warteVon: '',
          warteBis: '',
          ende: '',
          von: '',
          nach: '',
          grund: '',
          art: '',
          fahrzeug: '',
          zeitkritisch: false,
          befoerderung: '',
        },
        rechnungsnummer: '',
        leistungen: [],
      };
      (korrektur ? bestand.korrekturen : bestand.faelle).push(fall);
      rang = 0;
    };

    if (sart === '01' && phase === 'faelle') return neuerFall(false);
    if (sart === '41' && rueckmeldung && (phase === 'summen' || phase === 'korrekturen')) {
      phase = 'korrekturen';
      return neuerFall(true);
    }

    const r = RANG[sart];
    if (r !== undefined && fall !== undefined && (phase === 'faelle' || phase === 'korrekturen')) {
      const erwartet = fall.korrektur
        ? ['11', '39', '42', '60', '62']
        : ['11', '39', '02', '06', '07', '20', leistungsSart];
      if (!erwartet.includes(sart))
        throw fehler(zeile, `SART ${sart} gehört nicht in diese Ebene (E.2.1/E.2.2).`);
      if (r < rang) throw fehler(zeile, `SART ${sart} steht nach einem Satz, der laut E.2.1/E.2.2 folgt.`);
      const einmal = ['11', '02', '42', '06', '20', '60'];
      if (r === rang && einmal.includes(sart))
        throw fehler(zeile, `SART ${sart} ist je Ebene höchstens einmal zulässig.`);
      rang = r;
      if (sart === '11') {
        const b = felder(DKT_BEZUG, text);
        const bezug: NonNullable<DktGelesenerFall['bezug']> = {};
        const vpnrl = optionalN(b['VPNRL']);
        if (vpnrl !== undefined) bezug.vpnrLeistungserbringer = vpnrl;
        const ajahr = optionalN(b['AJAHR']);
        if (ajahr !== undefined) bezug.abrechnungsjahr = ajahr;
        const abzr = optionalN(b['ABZR']);
        if (abzr !== undefined) bezug.abrechnungszeitraum = abzr;
        const rnr = optional(b['RNR']);
        if (rnr !== undefined) bezug.rechnungsnummer = rnr;
        const bsnr = optionalN(b['BSNR']);
        if (bsnr !== undefined) bezug.belegnummer = Number(bsnr);
        const abl = ablehnung(b['ABLG']);
        if (abl !== undefined) bezug.ablehnungsgrund = abl;
        fall.bezug = bezug;
      } else if (sart === '39') {
        fall.texte.push(felder(DKT_TEXT, text)['TXT']!.trimEnd());
      } else if (sart === '02' || sart === '42') {
        const a = felder(DKT_ANGEHOERIGER, text);
        fall.angehoeriger = {
          vsnr: a['VSNRA']!,
          familienname: a['AZUNA']!.trimEnd(),
          vorname: a['AVONA']!.trimEnd(),
        };
      } else if (sart === '06') {
        const a = felder(DKT_ADRESSE, text);
        fall.adresse = {
          staat: a['LKZ']!,
          plz: a['PLZL']!.trim(),
          strasse: a['STRA']!.trimEnd(),
          ort: a['ORT']!.trimEnd(),
        };
        const uvaz = optional(a['UVAZ']);
        if (uvaz !== undefined) fall.adresse.uvAktenzeichen = uvaz;
      } else if (sart === '07') {
        const blocktext = felder(DKT_EKVK, text)['BLOCK']!;
        const kz = blocktext[0];
        if (kz === 'P' && fall.ekvk.patient === undefined)
          fall.ekvk.patient = felder(DKT_EKVK_PATIENT, blocktext);
        else if (kz === 'E' && fall.ekvk.weitere === undefined)
          fall.ekvk.weitere = felder(DKT_EKVK_WEITERE, blocktext);
        else throw fehler(zeile, 'SART 07 trägt je einen Block „P" und „E" (E.2.1).');
      } else if (sart === '20' || sart === '60') {
        const t = felder(DKT_TRANSPORT, text);
        const transport: DktGelesenerFall['transport'] = {
          datum: t['LDAT']!,
          beginn: t['EBEG']!,
          ankunft: t['ANK']!,
          warteVon: t['WZV']!,
          warteBis: t['WZB']!,
          ende: t['END']!,
          von: t['PLZV']!.trimEnd(),
          nach: t['PLZN']!.trimEnd(),
          grund: t['GRU']!,
          art: t['TART']!,
          fahrzeug: t['FART']!,
          zeitkritisch: t['ZKR'] === '1',
          befoerderung: t['BEF']!,
        };
        setze(transport, 'nummer', optional(t['TNR']));
        setze(transport, 'kennzeichen', optional(t['KFZ']));
        setze(transport, 'vonOrt', optional(t['ORTV']));
        setze(transport, 'nachOrt', optional(t['ORTN']));
        setze(transport, 'vpnrLeistungserbringer', optionalN(t['VPNRL']));
        setze(transport, 'naca', optionalN(t['NACA']));
        fall.transport = transport;
      } else {
        // 21, 22, 62
        const l = felder(DKT_LEISTUNG, text);
        const rnr = l['RNR']!.trimEnd();
        if (fall.rechnungsnummer !== '' && fall.rechnungsnummer !== rnr) {
          throw fehler(zeile, 'Die Leistungssätze eines Transportes tragen dieselbe Rechnungsnummer (D.43).');
        }
        fall.rechnungsnummer = rnr;
        const bloecke = [l['BLO1']!, l['BLO2']!];
        if (bloecke.some((b) => b.length !== DKT_BLOCKLAENGE_LEISTUNG))
          throw fehler(zeile, 'Datenblock nicht 43 Zeichen.');
        leistungsbloecke(zeile, bloecke, fall, sart === '62' ? ['A', 'N'] : ['L']);
      }
      return;
    }

    if (sart === summenSart && (phase === 'faelle' || phase === 'summen')) {
      schliesseFall(zeile);
      if (bestand.faelle.length === 0) throw fehler(zeile, 'Summensatz ohne vorangehende Ebene 2 (E.2.1).');
      phase = 'summen';
      bestand.summen.push(summe(zeile, summenSart, felder(DKT_SUMME, text)));
      return;
    }
    if (rueckmeldung && sart === '64' && ['summen', 'korrekturen', 'korrekturSummen'].includes(phase)) {
      schliesseFall(zeile);
      phase = 'korrekturSummen';
      bestand.korrekturSummen.push(summe(zeile, '64', felder(DKT_SUMME, text)));
      return;
    }
    if (
      rueckmeldung &&
      sart === '85' &&
      ['summen', 'korrekturen', 'korrekturSummen', 'pauschalen'].includes(phase)
    ) {
      schliesseFall(zeile);
      phase = 'pauschalen';
      const p = felder(DKT_PAUSCHALE, text);
      bestand.pauschalen.push({
        vpnrLeistungserbringer: p['VPNRL']!,
        art: p['PART']!,
        nettoCent: zahl(p['PBETRN'], zeile, 'PBETRN'),
        ustCent: zahl(p['PUST'], zeile, 'PUST'),
        bruttoCent: zahl(p['PBETRB'], zeile, 'PBETRB'),
        begruendung: p['PBEGR']!.trimEnd(),
      });
      return;
    }
    if (
      sart === '39' &&
      ['summen', 'korrekturen', 'korrekturSummen', 'pauschalen', 'hinweise'].includes(phase)
    ) {
      schliesseFall(zeile);
      phase = 'hinweise';
      bestand.hinweise.push(felder(DKT_TEXT, text)['TXT']!.trimEnd());
      return;
    }
    if (sart === '99' && phase !== 'faelle' && phase !== 'ende') {
      schliesseFall(zeile);
      if (bestand.summen.length === 0)
        throw fehler(zeile, 'Kein Rechnungssummensatz (E.2.1: „>=1 x SART 23").');
      phase = 'ende';
      const d = felder(DKT_DATEIENDE, text);
      for (const f of DKT_DATEIENDE) {
        if (f.name.startsWith('ANZ') || f.name === 'ANDP')
          bestand.dateiende[f.name] = zahl(d[f.name], zeile, f.name);
      }
      return;
    }
    throw fehler(zeile, `SART ${sart} ist an dieser Stelle nicht zulässig (Abfolge E.2.1/E.2.2).`);
  });

  if (phase !== 'ende')
    throw fehler(zeilen.length - 1, 'Der vorletzte Satz ist nicht SART 99 Dateiende (E.2.1).');

  // D.8: Zähler im Dateiende gegen die tatsächlich gelesenen Sätze.
  const z = (...s: string[]): number => s.reduce((n, x) => n + (zaehler[x] ?? 0), 0);
  const soll: Record<string, number> = {
    ANZ01: z('01', '41'),
    ANZ02: z('02', '42'),
    ANZ20: z('20', '60'),
    ANZ21: z('21', '22', '62'),
    ANZ06: z('06'),
    ANZ23: z('23', '24', '64'),
    ANZ07: z('07'),
    ANZ11: z('11'),
    ANZ39: z('39'),
    ANZ85: z('85'),
  };
  for (const [feld, wert] of Object.entries(soll)) {
    if (bestand.dateiende[feld] !== wert) {
      throw fehler(
        zeilen.length - 1,
        `${feld} meldet ${bestand.dateiende[feld]}, gelesen wurden ${wert} (D.8).`,
      );
    }
  }
  // D.44: SANZ „Satzanzahl inklusive Vorlauf- und Schlusssatz".
  if (Number(schluss['SANZ']) !== zeilen.length) {
    throw fehler(
      zeilen.length,
      `SANZ meldet ${Number(schluss['SANZ'])}, die Datei hat ${zeilen.length} Sätze (D.44).`,
    );
  }
  return bestand;
}
