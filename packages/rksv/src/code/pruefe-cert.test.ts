import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';
import { decodeBelegCode } from './decode';
import { pruefeBelegCode } from './pruefe';

// Prüft den Zertifikats-Pfad von pruefeBelegCode ({ zertifikat } ->
// new X509Certificate(...).publicKey) gegen ein ECHTES X.509-Zertifikat.
// Node kann keine Zertifikate erzeugen, daher wird eines zur Laufzeit mit
// openssl generiert (selbstsigniert, Wegwerf) — nichts wird committet oder
// ausgeliefert. Ohne openssl wird der Test übersprungen.

function opensslVerfuegbar(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function signaturStatus(res: { pruefungen: { name: string; status: string }[] }): string | undefined {
  return res.pruefungen.find((p) => p.name === 'Signatur')?.status;
}

test(
  'pruefe: ES256 gegen echtes X.509-Zertifikat (openssl-generiert, PASS und FAIL)',
  { skip: opensslVerfuegbar() ? false : 'openssl nicht verfügbar' },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'rksv-cert-'));
    try {
      const keyPfad = join(dir, 'key.pem');
      const certPfad = join(dir, 'cert.pem');
      execFileSync('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', keyPfad], { stdio: 'ignore' });
      execFileSync('openssl', ['req', '-new', '-x509', '-key', keyPfad, '-out', certPfad, '-days', '1', '-subj', '/CN=rksv-test', '-sha256'], { stdio: 'ignore' });

      const privateKey = createPrivateKey(readFileSync(keyPfad, 'utf8'));
      const zertifikat = readFileSync(certPfad, 'utf8');

      // Beleg mit dem privaten Schlüssel signieren (Segmente 1..12 + Signatur).
      const seg = [
        'R1-AT1', 'KECK-CERT', '1', '2026-07-22T10:00:00',
        '0,00', '0,00', '0,00', '0,00', '0,00',
        Buffer.alloc(8, 2).toString('base64'), '1a2b3c', Buffer.alloc(8, 1).toString('base64'),
      ];
      const payload = '_' + seg.join('_');
      const signingInput = 'eyJhbGciOiJFUzI1NiJ9.' + Buffer.from(payload, 'utf8').toString('base64url');
      const signatur = sign('sha256', Buffer.from(signingInput, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
      const code = payload + '_' + signatur.toString('base64');

      const beleg = decodeBelegCode(code);

      // Gültige Signatur, Prüfung über das Zertifikat -> PASS
      assert.equal(signaturStatus(pruefeBelegCode(beleg, { zertifikat })), 'PASS');

      // Nachträglich manipuliert -> FAIL
      beleg.segmente[4] = '9,99';
      assert.equal(signaturStatus(pruefeBelegCode(beleg, { zertifikat })), 'FAIL');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
