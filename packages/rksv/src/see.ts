import { type Rksv } from './client';
import { type Ergebnis } from './antwort';
import { _einzel as einzel } from './kasse';
import { type ArtSe } from './vorgaenge';

export const see = {
  registriere(
    rksv: Rksv,
    args: { paketNr: number; artSe: ArtSe; vdaId: string; zertifikatsseriennummer?: string; zertifikat?: string },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'registrierung_se',
      artSe: args.artSe,
      vdaId: args.vdaId,
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      zertifikat: args.zertifikat,
    });
  },
  meldeAusfall(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; begruendung: 1 | 2 | 99; beginn: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ausfall: { begruendung: args.begruendung, beginn: args.beginn },
    });
  },
  meldeWiederinbetriebnahme(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; ende: Date },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'wiederinbetriebnahme_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ende: args.ende,
    });
  },
  nimmAusserBetrieb(
    rksv: Rksv,
    args: { paketNr: number; zertifikatsseriennummer: string; begruendung: 6 | 7 },
  ): Promise<Ergebnis> {
    return einzel(rksv, args.paketNr, {
      art: 'ausfall_se',
      zertifikatsseriennummer: args.zertifikatsseriennummer,
      ausserbetriebnahme: { begruendung: args.begruendung },
    });
  },
};
