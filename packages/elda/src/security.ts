import { createHash, randomUUID } from 'node:crypto';

/** Gehashte Security-Felder, wie sie in den SOAP-Request gehen. */
export interface SecurityFelder {
  apiKey: string;
  created: string;
  kundenpasswort: string; // SHA-512 hex lowercase
  nonce: string;
  seriennummer: string;
}

/** Rohe Zugangsdaten (Kundenpasswort im Klartext). */
export interface SecurityQuelle {
  seriennummer: string;
  kundenpasswort: string;
  apiKey: string;
}

/**
 * Baut die `securityParameters` für einen Request. `kundenpasswort` wird zu
 * SHA-512 hex lowercase gehasht (ELDA-Vorgabe). `nonce` (Replay-Schutz) ist per
 * Default ein `randomUUID()`, `created` ein ISO-Zeitstempel (Request ~60 s gültig).
 * `opts` erlaubt deterministische Werte für Tests.
 */
export function baueSecurity(
  q: SecurityQuelle,
  opts: { nonce?: string; created?: string } = {},
): SecurityFelder {
  return {
    apiKey: q.apiKey,
    created: opts.created ?? new Date().toISOString(),
    kundenpasswort: createHash('sha512').update(q.kundenpasswort, 'utf8').digest('hex'),
    nonce: opts.nonce ?? randomUUID(),
    seriennummer: q.seriennummer,
  };
}
