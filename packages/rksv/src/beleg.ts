import { type Rksv, type Einzel } from './client';
import { type Ergebnis } from './antwort';

export function makeBeleg(einzel: Einzel): Rksv['beleg'] {
  return {
    pruefe(args: { paketNr: number; beleg: string; kundeninfo?: string }): Promise<Ergebnis> {
      return einzel(args.paketNr, { art: 'belegpruefung', beleg: args.beleg, kundeninfo: args.kundeninfo });
    },
  };
}
