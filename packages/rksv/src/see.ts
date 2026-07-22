import { type Rksv, type Einzel } from './client';
import { type Ergebnis } from './antwort';
import { type ArtSe } from './vorgaenge';

export function makeSee(einzel: Einzel): Rksv['see'] {
  return {
    registriere(args: {
      paketNr: number;
      artSe: ArtSe;
      vdaId: string;
      zertifikatsseriennummer?: string;
      zertifikat?: string;
      kundeninfo?: string;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'registrierung_se',
        artSe: args.artSe,
        vdaId: args.vdaId,
        zertifikatsseriennummer: args.zertifikatsseriennummer,
        zertifikat: args.zertifikat,
        kundeninfo: args.kundeninfo,
      });
    },
    meldeAusfall(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 1 | 2 | 99;
      beginn: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'ausfall_se',
        zertifikatsseriennummer: args.zertifikatsseriennummer,
        ausfall: { begruendung: args.begruendung, beginn: args.beginn },
        kundeninfo: args.kundeninfo,
      });
    },
    meldeWiederinbetriebnahme(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      ende: Date;
      kundeninfo?: string;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'wiederinbetriebnahme_se',
        zertifikatsseriennummer: args.zertifikatsseriennummer,
        ende: args.ende,
        kundeninfo: args.kundeninfo,
      });
    },
    nimmAusserBetrieb(args: {
      paketNr: number;
      zertifikatsseriennummer: string;
      begruendung: 6 | 7;
      kundeninfo?: string;
    }): Promise<Ergebnis> {
      return einzel(args.paketNr, {
        art: 'ausfall_se',
        zertifikatsseriennummer: args.zertifikatsseriennummer,
        ausserbetriebnahme: { begruendung: args.begruendung },
        kundeninfo: args.kundeninfo,
      });
    },
  };
}
