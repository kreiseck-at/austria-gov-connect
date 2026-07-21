import { type Rksv, type Einzel } from './client';
import { type Pruefung } from './antwort';

export function makeBeleg(einzel: Einzel): Rksv['beleg'] {
  return {
    async pruefe(args: { paketNr: number; beleg: string }): Promise<Pruefung[]> {
      const erg = await einzel(args.paketNr, { art: 'belegpruefung', beleg: args.beleg });
      return erg.belegpruefung ?? [];
    },
  };
}
