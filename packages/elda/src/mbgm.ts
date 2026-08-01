import { EldaError } from './errors';
import type { RohSatz } from './bestand';
import {
  FELDER_PAKET,
  FELDER_MBGM,
  FELDER_TARIFBLOCK,
  FELDER_VERRECHNUNGSBASIS,
  FELDER_VERRECHNUNGSPOSITION,
  SATZLAENGE_PAKET,
  SATZLAENGE_MBGM,
  SATZLAENGE_TARIFBLOCK,
  SATZLAENGE_VERRECHNUNGSBASIS,
  SATZLAENGE_VERRECHNUNGSPOSITION,
} from './felder-e32';
import { VBTY_CODES, VPTY_CODES, type VbtyCode, type VptyCode } from './codes-e32';

/**
 * Zusammenbau der monatlichen Beitragsgrundlagenmeldung (Kapitel E.32).
 *
 * Die mBGM ist eine **Hierarchie aus Sätzen, deren Zugehörigkeit sich allein
 * aus der Reihenfolge ergibt** (Seite 337): „Alle nachfolgenden Satzarten bis
 * zur nächsten mBGM oder zum mBGM-Paket-Ende gehören zu diesem
 * Versicherten/dieser mBGM." Es gibt keine Verweis-IDs zwischen den Ebenen.
 * Deshalb erzeugt dieses Modul eine geordnete Satzfolge und nicht eine Menge.
 */

// --- Verfahren -------------------------------------------------------------

/**
 * Abrechnungsverfahren des Beitragskontos. Es bestimmt jede Satzart des Pakets
 * und ist **keine Eigenschaft der Meldung, sondern des Beitragskontos** — die
 * ÖGK legt es fest.
 *
 * Der Unterschied ist nicht kosmetisch: Beim Vorschreiber sind Prozentsatz und
 * Beitrag jeder Verrechnungsposition mit `Z4` gekennzeichnet — sie dürfen
 * mitgegeben werden, ihr Inhalt wird aber **nicht übernommen**. Dort rechnet
 * die ÖGK. Zusätzlich erwartet sie laut D.59 (Seite 141) den **unbegrenzten**
 * Beitragsgrundlagenbetrag, während die Selbstabrechnung den mit der
 * Höchstbeitragsgrundlage gedeckelten Wert verlangt. Derselbe Lohn führt also
 * je nach Verfahren zu einem anderen Betrag.
 */
export type Verfahren = 'selbstabrechnung' | 'vorschreibung';

// --- D.54 Verrechnungsgrundlage -------------------------------------------

/**
 * Verrechnungsgrundlage (`VERG`, D.54, Seite 134). **Keine Ja/Nein-Angabe**,
 * sondern eine Matrix: Sie sagt, ob es im Beitragszeitraum eine
 * Versicherungszeit gibt — und getrennt danach, ob sich Zeit und Verrechnung
 * auf die Sozialversicherung, die betriebliche Vorsorge oder beides beziehen.
 */
export const VERRECHNUNGSGRUNDLAGE = {
  /** SV-Verrechnung und BV-Verrechnung mit Zeit in der SV und BV. */
  SV_UND_BV_MIT_ZEIT: '1',
  /** SV-Verrechnung mit Zeit in der SV. */
  SV_MIT_ZEIT: '2',
  /** BV-Verrechnung mit Zeit in der BV. */
  BV_MIT_ZEIT: '3',
  /** SV-Verrechnung ohne Zeit in der SV. */
  SV_OHNE_ZEIT: '4',
  /** BV-Verrechnung ohne Zeit in der BV. */
  BV_OHNE_ZEIT: '5',
  /** SV-Verrechnung und BV-Verrechnung ohne Zeit in der SV und BV. */
  SV_UND_BV_OHNE_ZEIT: '6',
} as const;

/** Zulässige Werte der Verrechnungsgrundlage. */
export type Verrechnungsgrundlage = (typeof VERRECHNUNGSGRUNDLAGE)[keyof typeof VERRECHNUNGSGRUNDLAGE];

/** Verrechnungsgrundlagen, die eine Versicherungszeit ausweisen. */
const MIT_VERSICHERUNGSZEIT: ReadonlySet<string> = new Set(['1', '2', '3']);

// --- Eingabe ---------------------------------------------------------------

/** Eine einzelne Verrechnungsposition — die unterste Ebene der mBGM. */
export interface Verrechnungsposition {
  /** Positionstyp laut D.60, z. B. `'T01'` für die Standard-Tarifgruppenverrechnung. */
  typ: VptyCode;
  /**
   * Prozentsatz, kaufmännisch als Zahl — `12.75` für 12,75 %. Auf dem Draht
   * stehen drei Nachkommastellen ohne Trennzeichen (D.61), das übernimmt dieses
   * Modul. Ein negativer Wert setzt das Vorzeichenfeld `VPVZ` auf `'-'`.
   */
  prozentsatz: number;
  /**
   * Beitrag in **Cent**, ganzzahlig. Das Vorzeichen wird nach `RSVZ`
   * übernommen; übergeben wird also `-1234` und nicht ein getrenntes
   * Vorzeichen. Beim Vorschreiber wird der Wert von der Gegenstelle verworfen
   * (Pflichtstufe `Z4`) — er darf trotzdem mitgegeben werden.
   */
  betragCent: number;
}

/** Eine Verrechnungsbasis mit den ihr untergeordneten Positionen. */
export interface Verrechnungsbasis {
  /** Basistyp laut D.58, z. B. `'AB'` für die allgemeine Beitragsgrundlage. */
  typ: VbtyCode;
  /**
   * Betrag in **Cent**, ganzzahlig (D.59).
   *
   * Bei der Selbstabrechnung ist der mit der Höchstbeitragsgrundlage
   * **begrenzte**, beim Vorschreiber der **unbegrenzte** Wert einzusetzen. Für
   * die Beitragsgrundlage zur BV (`'BV'`) ist eine Begrenzung generell
   * unzulässig. Welcher Wert richtig ist, weiß nur der Aufrufer — dieses Modul
   * prüft ihn nicht gegen eine Höchstbeitragsgrundlage.
   */
  betragCent: number;
  /** Die dieser Basis untergeordneten Positionen, in der zu meldenden Reihenfolge. */
  positionen: readonly Verrechnungsposition[];
}

/** Ein Tarifblock mit den ihm untergeordneten Verrechnungsbasen. */
export interface Tarifblock {
  /**
   * Beschäftigtengruppe (`BSGR`, 4 Stellen) — zusammen mit den Ergänzungen die
   * Tarifgruppe. Zulässige Werte stehen **nicht** im Dokument, sondern im
   * Tarifsystem der Sozialversicherung; dieses Modul prüft nur die Form.
   */
  beschaeftigtengruppe: string;
  /** Bis zu fünf Ergänzungen zur Beschäftigtengruppe (`ERGB`, je 3 Stellen). */
  ergaenzungen?: readonly string[];
  /**
   * Beginn der Verrechnung (`VVON`) — der Tag im Beitragszeitraum, ab dem der
   * Tarifblock gilt. Bei einer mBGM **ohne** Versicherungszeit ist laut D.63
   * zwingend `1` einzusetzen; das erzwingt dieses Modul.
   */
  beginnDerVerrechnung: number;
  /**
   * Ob der Tarifblock (auch) eine Kündigungsentschädigung oder
   * Urlaubsersatzleistung enthält (`KEUE`, D.64). In einem Tarifblock ohne
   * Verrechnung ist das Feld gesperrt.
   */
  enthaeltKuendigungsentschaedigungOderUrlaubsersatz?: boolean;
  /** `true` erzeugt einen Tarifblock ohne Verrechnung (Satzart `T4` statt `T1`). */
  ohneVerrechnung?: boolean;
  /** Die diesem Tarifblock untergeordneten Verrechnungsbasen. */
  basen: readonly Verrechnungsbasis[];
}

/** Eine mBGM für einen Versicherten. */
export interface Beitragsgrundlagenmeldung {
  /** Eindeutige Identifikation dieser Meldung (`REFW`). */
  referenzwert: string;
  /**
   * Versicherungsnummer (`VSNR`, 10 Stellen). Entweder diese oder
   * {@link referenzVsnrAnforderung} muss angegeben sein — die Pflichtmatrix
   * druckt für beide Felder eine gemeinsame Zelle.
   */
  versicherungsnummer?: string;
  /** Referenzwert der VSNR-Anforderung (`REFV`), wenn die Nummer noch fehlt. */
  referenzVsnrAnforderung?: string;
  /** Familienname (`FANA`). */
  familienname: string;
  /** Vorname (`VONA`). */
  vorname: string;
  /** Verrechnungsgrundlage (`VERG`) — siehe {@link VERRECHNUNGSGRUNDLAGE}. */
  verrechnungsgrundlage: Verrechnungsgrundlage;
  /** Die Tarifblöcke dieses Versicherten, in der zu meldenden Reihenfolge. */
  tarifbloecke: readonly Tarifblock[];
  /** Freies Informationsfeld für den Dienstgeber (`INF1`, 12 Stellen). */
  info1?: string;
  /** Zweites freies Informationsfeld (`INF2`, 12 Stellen). */
  info2?: string;
}

/*
 * TODO — noch nicht über diese Schicht erreichbar, bewusst offengelassen:
 *
 * - **Storno** (`R1`/`R2`). Die Satzarten sind in `pflicht-e32.ts` vollständig
 *   erfasst; es fehlt der benannte Einstieg. Ein Storno trägt `REFU` (Verweis
 *   auf die ursprüngliche Meldung) und kommt ohne Tarifblock aus. Zusätzlich
 *   verlangt Seite 338: „muss aber auch jedenfalls der Beitragszeitraum und im
 *   Bereich der Selbstabrechnung die Gesamtsumme der Beiträge für das Storno
 *   mit jenem der zu stornierende mBGM übereinstimmen" — das ist ohne Kenntnis
 *   der ursprünglichen Meldung nicht prüfbar und braucht eine eigene Zusage.
 * - **Fallweise Beschäftigung** (`G3`/`G4`, Tarifblock `T2`/`T5`, Feld `FTAG`).
 * - **Kürzer als ein Monat vereinbarte Beschäftigung** (`G5`/`G6`, Tarifblock
 *   `T3`/`T6`, Felder `BTAB`/`BTBS`).
 * - **mBGM ohne Versicherten** (`G7`/`R7`) — abweichende Pflichtstufen, kein
 *   Tarifblock.
 *
 * Alle vier sind über die Satzschicht (`felder-e32.ts`, `pflicht-e32.ts`) und
 * `baueBestand` bereits heute baubar; es fehlt allein die bequeme Fassung.
 */

/** Angaben, die für das ganze Paket gelten. */
export interface PaketOptionen {
  /** Abrechnungsverfahren des Beitragskontos — siehe {@link Verfahren}. */
  verfahren: Verfahren;
  /** Eindeutige Identifikation des Pakets (`REFP`). */
  paketreferenzwert: string;
  /** Beitragskontonummer beim zuständigen Versicherungsträger (`BKNR`). */
  beitragskontonummer: string;
  /** Dienstgebername (`DGNA`). */
  dienstgebername: string;
  /** Beitragszeitraum als `MMJJJJ` (`BZRM`), z. B. `'072026'`. */
  beitragszeitraum: string;
  /**
   * Ob das Paket geringfügig Beschäftigte enthält, deren Beiträge **jährlich**
   * verrechnet werden (`JAGB`). Zwingende Angabe, auch wenn sie `false` ist.
   */
  jaehrlicheAbrechnungGeringfuegiger: boolean;
  /**
   * Paketkennung (`MPKE`) — die fachliche Kennung des Verarbeitungslaufs der
   * Lohnverrechnung. Sie wird laut D.50 bei der Beitragsbuchung mitgeführt und
   * im Beitragskonto (WEBEKU) den einzelnen Forderungsbuchungen zugeordnet.
   * Damit lässt sich später von einer Buchung auf den auslösenden Lauf
   * zurückschließen — dringend zu empfehlen, auch wenn das Feld optional ist.
   */
  paketkennung?: string;
  /** Telefonnummer des Dienstgebers (`DTEL`). */
  telefon?: string;
  /** Mailadresse des Dienstgebers (`MAIL`). */
  mail?: string;
}

// --- Formatierung ----------------------------------------------------------

function ganzzahl(wert: number, feld: string): number {
  if (!Number.isInteger(wert)) {
    throw new EldaError(
      `${feld}: ${wert} ist keine ganze Zahl. Beträge sind in Cent anzugeben — ` +
        'ein Bruchteil eines Cent kann nicht übermittelt werden.',
    );
  }
  return wert;
}

/** Zerlegt einen vorzeichenbehafteten Betrag in Vorzeichenfeld und Ziffernfolge. */
function betragMitVorzeichen(wert: number, feld: string): { vorzeichen: string; ziffern: string } {
  ganzzahl(wert, feld);
  return { vorzeichen: wert < 0 ? '-' : '+', ziffern: String(Math.abs(wert)) };
}

/**
 * Prozentsatz nach D.61: sechs Stellen, kein Dezimaltrennzeichen, drei
 * Nachkommastellen. 12,75 % wird also zu `012750`.
 *
 * Gerundet wird kaufmännisch auf drei Nachkommastellen. Ein Wert, der mehr
 * Stellen mitbringt, als das Feld tragen kann, wird NICHT stillschweigend
 * gekürzt, sondern abgelehnt.
 */
function prozentsatz(wert: number, feld: string): { vorzeichen: string; ziffern: string } {
  if (!Number.isFinite(wert)) {
    throw new EldaError(`${feld}: ${wert} ist kein gültiger Prozentsatz.`);
  }
  const tausendstel = Math.round(Math.abs(wert) * 1000);
  if (tausendstel > 999999) {
    throw new EldaError(
      `${feld}: ${wert} % passt nicht in sechs Stellen mit drei Nachkommastellen ` +
        '(höchstens 999,999 %).',
    );
  }
  return { vorzeichen: wert < 0 ? '-' : '+', ziffern: String(tausendstel) };
}

// --- Zusammenbau -----------------------------------------------------------

function pruefeMeldung(m: Beitragsgrundlagenmeldung, nr: number): void {
  const wo = `Meldung ${nr} (${m.referenzwert || 'ohne Referenzwert'})`;
  if (!m.referenzwert?.trim()) {
    throw new EldaError(`${wo}: Referenzwert (REFW) fehlt — er identifiziert die Meldung eindeutig.`);
  }
  const hatVsnr = !!m.versicherungsnummer?.trim();
  const hatRefv = !!m.referenzVsnrAnforderung?.trim();
  if (!hatVsnr && !hatRefv) {
    throw new EldaError(
      `${wo}: Weder Versicherungsnummer (VSNR) noch Referenzwert der VSNR-Anforderung (REFV) ` +
        'angegeben. Die Pflichtmatrix führt beide in einer gemeinsamen Zelle: „wenn keine ' +
        'Versicherungsnummer angegeben wird, muss ein Referenzwert auf eine VSNR Anforderung ' +
        'angegeben werden."',
    );
  }
  if (!m.tarifbloecke.length) {
    throw new EldaError(
      `${wo}: keine Tarifblöcke. Eine mBGM ohne Tarifblock ist nur als Satzart G7 ` +
        '(„ohne Versicherten") vorgesehen, die dieses Modul nicht über diesen Weg erzeugt.',
    );
  }
  const ohneZeit = !MIT_VERSICHERUNGSZEIT.has(m.verrechnungsgrundlage);
  m.tarifbloecke.forEach((t, i) => {
    if (ohneZeit && t.beginnDerVerrechnung !== 1) {
      throw new EldaError(
        `${wo}, Tarifblock ${i + 1}: Bei einer mBGM ohne Versicherungszeit ` +
          `(VERG=${m.verrechnungsgrundlage}) ist der Beginn der Verrechnung laut D.63 zwingend ` +
          `mit 01 zu belegen, angegeben wurde ${t.beginnDerVerrechnung}.`,
      );
    }
    if (t.ohneVerrechnung && t.enthaeltKuendigungsentschaedigungOderUrlaubsersatz) {
      throw new EldaError(
        `${wo}, Tarifblock ${i + 1}: In einem Tarifblock ohne Verrechnung (T4) ist KEUE ` +
          'gesperrt (Pflichtmatrix, Seite 347).',
      );
    }
    if ((t.ergaenzungen?.length ?? 0) > 5) {
      throw new EldaError(
        `${wo}, Tarifblock ${i + 1}: höchstens fünf Ergänzungen zur Beschäftigtengruppe ` +
          `(BLOCK FÜR 5 ERGÄNZUNGEN), angegeben wurden ${t.ergaenzungen?.length}.`,
      );
    }
    const gesehen = new Set<string>();
    for (const b of t.basen) {
      if (!(b.typ in VBTY_CODES)) {
        throw new EldaError(`${wo}, Tarifblock ${i + 1}: unbekannter Verrechnungsbasis-Typ '${b.typ}'.`);
      }
      if (gesehen.has(b.typ)) {
        throw new EldaError(
          `${wo}, Tarifblock ${i + 1}: Der Verrechnungsbasis-Typ '${b.typ}' kommt mehrfach vor. ` +
            'D.58: „Jeder Verrechnungsbasis-Typ darf für einen Tarifblock nur einmal verwendet werden."',
        );
      }
      gesehen.add(b.typ);
      for (const p of b.positionen) {
        if (!(p.typ in VPTY_CODES)) {
          throw new EldaError(`${wo}, Tarifblock ${i + 1}: unbekannter Verrechnungspositions-Typ '${p.typ}'.`);
        }
      }
    }
  });
}

/**
 * Baut die vollständige Satzfolge eines mBGM-Pakets: Paket-Beginn, je Meldung
 * die mBGM mit ihren Tarifblöcken, Verrechnungsbasen und -positionen, zum
 * Schluss der Paket-Ende-Satz.
 *
 * Die Reihenfolge ist bedeutungstragend und darf vom Aufrufer nicht verändert
 * werden — die Zugehörigkeit der Sätze ergibt sich allein aus ihr.
 *
 * `GSUM` (Gesamtsumme) und `ANZM` (Anzahl) werden aus den übergebenen Meldungen
 * berechnet, nicht vom Aufrufer entgegengenommen: Eine von Hand gesetzte Summe,
 * die nicht zur Satzfolge passt, ist einer der häufigsten Rückweisungsgründe
 * und lässt sich hier vollständig vermeiden.
 *
 * @returns geordnete Rohsätze, geeignet für `baueBestand`.
 */
export function erstelleMbgmPaket(
  meldungen: readonly Beitragsgrundlagenmeldung[],
  opt: PaketOptionen,
): RohSatz[] {
  if (!meldungen.length) {
    throw new EldaError('Ein mBGM-Paket ohne Meldungen ist nicht vorgesehen.');
  }
  if (!/^\d{6}$/.test(opt.beitragszeitraum)) {
    throw new EldaError(
      `Beitragszeitraum '${opt.beitragszeitraum}' muss genau sechs Ziffern im Format MMJJJJ haben ` +
        "— z. B. '072026' für Juli 2026.",
    );
  }
  meldungen.forEach((m, i) => pruefeMeldung(m, i + 1));

  const selbst = opt.verfahren === 'selbstabrechnung';
  const saetze: RohSatz[] = [];

  // Gesamtsumme über alle Meldungen — Summe aller VSUM, wie im Feldtext zu
  // GSUM beschrieben: „Summe aller im Paket enthaltenen Abrechnungspositionen
  // der Einzelmeldungen (Summe aller VSUM, Storno-Meldungen werden abgezogen)".
  let gesamtCent = 0;
  const meldungssaetze: RohSatz[] = [];

  for (const m of meldungen) {
    let summeCent = 0;
    const untersaetze: RohSatz[] = [];

    for (const t of m.tarifbloecke) {
      const ergb: Record<string, string | undefined> = {};
      (t.ergaenzungen ?? []).forEach((e, i) => {
        ergb[`ERGB${i + 1}`] = e;
      });
      untersaetze.push({
        satzart: t.ohneVerrechnung ? 'T4' : 'T1',
        felder: FELDER_TARIFBLOCK,
        satzlaenge: SATZLAENGE_TARIFBLOCK,
        werte: {
          BSGR: t.beschaeftigtengruppe,
          ...ergb,
          VVON: String(t.beginnDerVerrechnung),
          KEUE: t.ohneVerrechnung
            ? undefined
            : t.enthaeltKuendigungsentschaedigungOderUrlaubsersatz
              ? 'J'
              : undefined,
        },
      });

      for (const b of t.basen) {
        untersaetze.push({
          satzart: selbst ? 'BS' : 'BV',
          felder: FELDER_VERRECHNUNGSBASIS,
          satzlaenge: SATZLAENGE_VERRECHNUNGSBASIS,
          werte: { VBTY: b.typ, VBBT: String(ganzzahl(b.betragCent, `Verrechnungsbasis ${b.typ}`)) },
        });

        for (const p of b.positionen) {
          const pz = prozentsatz(p.prozentsatz, `Verrechnungsposition ${p.typ}`);
          const be = betragMitVorzeichen(p.betragCent, `Verrechnungsposition ${p.typ}`);
          summeCent += p.betragCent;
          untersaetze.push({
            satzart: selbst ? 'V1' : 'V2',
            felder: FELDER_VERRECHNUNGSPOSITION,
            satzlaenge: SATZLAENGE_VERRECHNUNGSPOSITION,
            werte: {
              VPTY: p.typ,
              VPVZ: pz.vorzeichen,
              VPTA: pz.ziffern,
              RSVZ: be.vorzeichen,
              RSUM: be.ziffern,
            },
          });
        }
      }
    }

    gesamtCent += summeCent;
    const vsum = betragMitVorzeichen(summeCent, `Meldung ${m.referenzwert}`);
    meldungssaetze.push({
      satzart: selbst ? 'G1' : 'G2',
      felder: FELDER_MBGM,
      satzlaenge: SATZLAENGE_MBGM,
      werte: {
        REFW: m.referenzwert,
        REFV: m.referenzVsnrAnforderung,
        VSNR: m.versicherungsnummer,
        FANA: m.familienname,
        VONA: m.vorname,
        // VSUM trägt kein eigenes Vorzeichenfeld; ein negativer Gesamtbetrag je
        // Versichertem ist über die Vorzeichen der Einzelpositionen abgebildet.
        VSUM: vsum.ziffern,
        VERG: m.verrechnungsgrundlage,
        INF1: m.info1,
        INF2: m.info2,
      },
    });
    meldungssaetze.push(...untersaetze);
    untersaetze.length = 0;
  }

  const gesamt = betragMitVorzeichen(gesamtCent, 'Gesamtsumme des Pakets');
  saetze.push({
    satzart: selbst ? 'PS' : 'PV',
    felder: FELDER_PAKET,
    satzlaenge: SATZLAENGE_PAKET,
    werte: {
      REFP: opt.paketreferenzwert,
      BKNR: opt.beitragskontonummer,
      DGNA: opt.dienstgebername,
      MPKE: opt.paketkennung,
      JAGB: opt.jaehrlicheAbrechnungGeringfuegiger ? 'J' : 'N',
      DTEL: opt.telefon,
      MAIL: opt.mail,
      BZRM: opt.beitragszeitraum,
      GSVZ: gesamt.vorzeichen,
      GSUM: gesamt.ziffern,
      ANZM: String(meldungen.length),
    },
  });
  saetze.push(...meldungssaetze);
  saetze.push({
    satzart: 'PE',
    felder: FELDER_PAKET,
    satzlaenge: SATZLAENGE_PAKET,
    werte: { REFP: opt.paketreferenzwert, ANZM: String(meldungen.length) },
  });

  return saetze;
}
