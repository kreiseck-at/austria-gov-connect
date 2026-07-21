import { type Rksv } from './client';
import { type Ergebnis } from './antwort';
import { RksvError, type Vorgang } from './vorgaenge';

async function einzel(rksv: Rksv, paketNr: number, vorgang: Vorgang): Promise<Ergebnis> {
  const q = await rksv.uebermittlePaket({ paketNr, vorgaenge: [vorgang] });
  if (q.verarbeitung !== 'synchron' || q.ergebnisse.length === 0) {
    throw new RksvError('Erwartetes synchrones Ergebnis blieb aus');
  }
  return q.ergebnisse[0]!;
}

export const kasse = {
  registriere(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; benutzerschluessel: string; anmerkung?: string },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'registrierung_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      benutzerschluessel: args.benutzerschluessel,
      anmerkung: args.anmerkung,
    });
  },
  meldeAusfall(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; begruendung: 1 | 5 | 99; beginn: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ausfall: { begruendung: args.begruendung, beginn: args.beginn },
    });
  },
  meldeWiederinbetriebnahme(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; ende: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'wiederinbetriebnahme_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ende: args.ende,
    });
  },
  nimmAusserBetrieb(
    rksv: Rksv,
    args: { paketNr: number; kassenidentifikationsnummer: string; begruendung: 6 | 7 },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_kasse',
      kassenidentifikationsnummer: args.kassenidentifikationsnummer,
      ausserbetriebnahme: { begruendung: args.begruendung },
    });
  },
};

export { einzel as _einzel };
