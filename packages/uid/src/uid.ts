import type { Session, TransportOptions } from '@kreiseck/finanzonline-core';
import { viesPruefe, viesBestaetige, viesStatus, type ViesConfig } from './vies';
import { fonUidAbfrage } from './fon';
import { normalisiereUid } from './normalisieren';

export interface UidConfig {
  antragsteller: string;
  session?: Session;
  transport?: TransportOptions;
  viesBasis?: string;
}

export function createUid(config: UidConfig) {
  const vcfg: ViesConfig = { basis: config.viesBasis, fetchImpl: config.transport?.fetchImpl };
  return {
    pruefe: (uid: string) => viesPruefe(uid, vcfg),
    bestaetige: (args: { uid: string; name?: string; strasse?: string; plz?: string; ort?: string }) =>
      viesBestaetige({ ...args, antragsteller: config.antragsteller }, vcfg),
    viesStatus: () => viesStatus(vcfg),
    fon: {
      abfrage: async (args: { uid: string; stufe: 1 | 2 }) => {
        if (!config.session) throw new Error('fon.abfrage erfordert eine Session in UidConfig');
        return await fonUidAbfrage({
          session: config.session,
          antragsteller: config.antragsteller,
          uid: args.uid,
          stufe: args.stufe,
          transport: config.transport,
        });
      },
    },
    cacheKey: (uid: string) => normalisiereUid(uid).voll,
  };
}
export type Uid = ReturnType<typeof createUid>;
