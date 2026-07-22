import { createPublicKey, verify, X509Certificate, type KeyObject } from 'node:crypto';
import { type Beleg, toStandardBase64 } from './decode';

export interface Pruefung {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_EXECUTED';
  detail?: string;
}

export interface Pruefergebnis {
  pruefungen: Pruefung[];
}

export interface PruefOptionen {
  zertifikat?: string | Buffer;
  schluessel?: KeyObject | string | Buffer;
}

const HEADER = 'eyJhbGciOiJFUzI1NiJ9';
const RKA = /^R[0-9]+-[A-Z0-9]+$/;
const DATUM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const BETRAG = /^-?\d+,\d{2}$/;

export function belegSigningInput(beleg: Beleg): string {
  const payload = '_' + beleg.segmente.slice(0, 12).join('_');
  return HEADER + '.' + Buffer.from(payload, 'utf8').toString('base64url');
}

function pruefe(name: string, ok: boolean, detail?: string): Pruefung {
  return { name, status: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) };
}

function verifyKey(opts: PruefOptionen | undefined): KeyObject | undefined {
  if (!opts) return undefined;
  if (opts.schluessel !== undefined) {
    return typeof opts.schluessel === 'object' && 'asymmetricKeyType' in opts.schluessel
      ? (opts.schluessel as KeyObject)
      : createPublicKey(opts.schluessel as string | Buffer);
  }
  if (opts.zertifikat !== undefined) {
    return new X509Certificate(opts.zertifikat).publicKey;
  }
  return undefined;
}

export function pruefeBelegCode(beleg: Beleg, opts?: PruefOptionen): Pruefergebnis {
  const pruefungen: Pruefung[] = [];

  pruefungen.push(pruefe('Algorithmuskennzeichen', RKA.test(beleg.rka.kennzeichen)));
  pruefungen.push(pruefe('Datum', DATUM.test(beleg.zeitpunkt)));
  const b = beleg.betraege;
  const betraegeOk = [b.normal, b.ermaessigt1, b.ermaessigt2, b.null, b.besonders].every((x) =>
    BETRAG.test(x),
  );
  pruefungen.push(pruefe('Betragsformate', betraegeOk));

  if (beleg.besonderheit === 'see-ausfall') {
    pruefungen.push({
      name: 'Signaturlaenge',
      status: 'NOT_EXECUTED',
      detail: 'Signatureinheit ausgefallen',
    });
    pruefungen.push({ name: 'Signatur', status: 'NOT_EXECUTED', detail: 'Signatureinheit ausgefallen' });
    return { pruefungen };
  }

  const sigBytes = Buffer.from(toStandardBase64(beleg.signatur), 'base64');
  pruefungen.push(pruefe('Signaturlaenge', sigBytes.length === 64, `${sigBytes.length} Byte`));

  const key = verifyKey(opts);
  if (!key) {
    pruefungen.push({
      name: 'Signatur',
      status: 'NOT_EXECUTED',
      detail: 'Kein Schlüssel/Zertifikat übergeben',
    });
    return { pruefungen };
  }
  if (sigBytes.length !== 64) {
    pruefungen.push({ name: 'Signatur', status: 'FAIL', detail: 'Signaturbytes ungültig' });
    return { pruefungen };
  }

  let ok = false;
  try {
    ok = verify(
      'sha256',
      Buffer.from(belegSigningInput(beleg), 'utf8'),
      { key, dsaEncoding: 'ieee-p1363' },
      sigBytes,
    );
  } catch (err) {
    pruefungen.push({ name: 'Signatur', status: 'FAIL', detail: (err as Error).message });
    return { pruefungen };
  }
  pruefungen.push(pruefe('Signatur', ok));
  return { pruefungen };
}
