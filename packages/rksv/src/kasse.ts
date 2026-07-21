import { type Rksv, type Einzel } from './client';
import { type Ergebnis } from './antwort';

export function makeKasse(einzel: Einzel): Rksv['kasse'] {
  return {
    registriere(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      benutzerschluessel: string;
      anmerkung?: string;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'registrierung_kasse',
        kassenidentifikationsnummer: args.kassenidentifikationsnummer,
        benutzerschluessel: args.benutzerschluessel,
        anmerkung: args.anmerkung,
      });
    },
    meldeAusfall(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 1 | 5 | 99;
      beginn: Date;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'ausfall_kasse',
        kassenidentifikationsnummer: args.kassenidentifikationsnummer,
        ausfall: { begruendung: args.begruendung, beginn: args.beginn },
      });
    },
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      ende: Date;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'wiederinbetriebnahme_kasse',
        kassenidentifikationsnummer: args.kassenidentifikationsnummer,
        ende: args.ende,
      });
    },
    nimmAusserBetrieb(args: {
      paketNr: number;
      kassenidentifikationsnummer: string;
      begruendung: 6 | 7;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'ausfall_kasse',
        kassenidentifikationsnummer: args.kassenidentifikationsnummer,
        ausserbetriebnahme: { begruendung: args.begruendung },
      });
    },
  };
}
