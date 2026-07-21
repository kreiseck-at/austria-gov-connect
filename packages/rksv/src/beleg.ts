import { type Rksv } from './client';
import { _einzel as einzel } from './kasse';
import { type Pruefung } from './antwort';

export const beleg = {
  async pruefe(rksv: Rksv, args: { paketNr: number; beleg: string }): Promise<Pruefung[]> {
    const erg = await einzel(rksv, args.paketNr, { art: 'belegpruefung', beleg: args.beleg });
    return erg.belegpruefung ?? [];
  },
};
