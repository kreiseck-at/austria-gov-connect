import { createHash, randomUUID } from 'node:crypto';
import { EldaError } from './errors';

/** Gehashte Security-Felder, wie sie in den SOAP-Request gehen. */
export interface SecurityFelder {
  apiKey: string;
  created: string;
  kundenpasswort: string; // SHA-512 hex lowercase
  nonce: string;
  seriennummer: string;
}

/** Zugangsdaten ohne den Passwortanteil. */
interface SecurityBasis {
  seriennummer: string;
  apiKey: string;
}

/**
 * Der Passwortanteil der Zugangsdaten — entweder das Kundenpasswort im Klartext
 * ODER sein fertiger SHA-512-Hash, nie beides. Die Ausschließlichkeit steht im
 * Typ (`?: never`), damit sie beim Übersetzen auffällt; erzwungen wird sie
 * zusätzlich zur Laufzeit in {@link loeseKundenpasswortHash}, weil Aufrufer aus
 * reinem JavaScript keinen Compiler haben.
 */
export type KundenpasswortQuelle =
  | {
      /**
       * Kundenpasswort im Klartext; wird intern zu SHA-512 hex lowercase gehasht.
       *
       * Wer die Zugangsdaten dauerhaft ablegt, nimmt statt dessen besser
       * `kundenpasswortHash`: Auf die Leitung geht ohnehin nur der Hash, das
       * Klartextpasswort wird nach der Eingabe also nie wieder gebraucht.
       */
      kundenpasswort: string;
      kundenpasswortHash?: never;
    }
  | {
      kundenpasswort?: never;
      /**
       * Bereits gebildeter SHA-512-Hash des Kundenpassworts, 128 Hexziffern in
       * Kleinschreibung — genau der Wert, der aus `kundenpasswort` auch intern
       * entstünde (siehe {@link hashKundenpasswort}).
       *
       * **Für gespeicherte Zugangsdaten die bessere Wahl:** Übertragen wird nur
       * dieser Hash, das Klartextpasswort braucht nach der Eingabe niemand mehr.
       * Wer nur den Hash ablegt, gibt bei einem Einbruch in den Datenbestand
       * zwar ein ELDA-gleichwertiges Token preis, aber nicht das Passwort des
       * Kunden selbst — und das ist erfahrungsgemäß anderswo wiederverwendet.
       */
      kundenpasswortHash: string;
    };

/** Rohe Zugangsdaten (Kundenpasswort im Klartext oder als fertiger Hash). */
export type SecurityQuelle = SecurityBasis & KundenpasswortQuelle;

/** Form eines SHA-512-Hex-Digests, so wie ELDA ihn erwartet. */
const HASH_FORM = /^[0-9a-f]{128}$/;

/**
 * Bildet den SHA-512-Hash (hex, lowercase) eines Kundenpassworts — genau die
 * Form, die ELDA im Feld `kundenpasswort` der `securityParameters` erwartet.
 *
 * Gedacht für den Zeitpunkt der Eingabe: Auf die Leitung geht ausschließlich
 * dieser Hash, das Klartextpasswort wird danach nie wieder gebraucht. Wer
 * Zugangsdaten dauerhaft ablegt, legt deshalb besser nur das Ergebnis dieser
 * Funktion ab und übergibt es als `kundenpasswortHash` — bei einem Einbruch in
 * den Datenbestand ist dann zwar der ELDA-Zugang kompromittiert, nicht aber das
 * Passwort des Kunden, das anderswo wiederverwendet sein dürfte.
 */
export function hashKundenpasswort(klartext: string): string {
  if (typeof klartext !== 'string' || klartext.trim() === '') {
    throw new EldaError(
      "'kundenpasswort' fehlt oder ist leer. Ein Hash über ein leeres Passwort wäre ein gültig " +
        'aussehender, aber wertloser Wert — ELDA beantwortete damit jeden Aufruf mit Status 558.',
    );
  }
  return createHash('sha512').update(klartext, 'utf8').digest('hex');
}

/**
 * Liefert den SHA-512-Hex-Hash des Kundenpassworts aus einer der beiden
 * zulässigen Formen und erzwingt dabei, dass genau eine davon gesetzt ist.
 *
 * Die Prüfung läuft zur Laufzeit, weil Aufrufer aus reinem JavaScript keinen
 * Compiler haben. Ein fertiger Hash wird auf seine Form geprüft, statt ihn
 * unbesehen durchzureichen: Ein abgeschnittener oder in Großbuchstaben
 * abgelegter Digest käme sonst erst als ELDA-Status `558` zurück — dann aber
 * ununterscheidbar von tatsächlich falschen Zugangsdaten und erst nach einem
 * Netzaufruf.
 */
export function loeseKundenpasswortHash(q: SecurityQuelle): string {
  const { kundenpasswort, kundenpasswortHash } = q as {
    kundenpasswort?: unknown;
    kundenpasswortHash?: unknown;
  };
  const klartextGesetzt = kundenpasswort !== undefined && kundenpasswort !== null;
  const hashGesetzt = kundenpasswortHash !== undefined && kundenpasswortHash !== null;

  if (klartextGesetzt && hashGesetzt) {
    throw new EldaError(
      "'kundenpasswort' und 'kundenpasswortHash' sind beide gesetzt. Genau eines von beiden " +
        'gehört in die Konfiguration — welches gemeint ist, lässt sich sonst nicht entscheiden, ' +
        'und stillschweigend eines zu bevorzugen verdeckte einen Konfigurationsfehler.',
    );
  }
  if (!klartextGesetzt && !hashGesetzt) {
    throw new EldaError(
      "Weder 'kundenpasswort' (Klartext) noch 'kundenpasswortHash' (SHA-512 hex, 128 Zeichen) " +
        'ist gesetzt. Genau eines von beiden ist Pflicht — ohne Kundenpasswort beantwortet ELDA ' +
        'jeden Aufruf mit Status 558.',
    );
  }

  if (hashGesetzt) {
    if (typeof kundenpasswortHash !== 'string' || !HASH_FORM.test(kundenpasswortHash)) {
      throw new EldaError(
        "'kundenpasswortHash' ist kein SHA-512-Hex-Digest. Erwartet werden genau 128 Hexziffern " +
          'in Kleinschreibung — `hashKundenpasswort` liefert sie so. Ein abgeschnittener oder in ' +
          'Großbuchstaben abgelegter Digest käme sonst erst als ELDA-Status 558 zurück, ' +
          'ununterscheidbar von einem echten Passwortfehler.',
      );
    }
    return kundenpasswortHash;
  }

  return hashKundenpasswort(kundenpasswort as string);
}

/**
 * Baut die `securityParameters` für einen Request. Das Kundenpasswort geht als
 * SHA-512 hex lowercase auf die Leitung (ELDA-Vorgabe) — entweder aus dem
 * Klartext gebildet oder als fertiger `kundenpasswortHash` übernommen, siehe
 * {@link loeseKundenpasswortHash}. `nonce` (Replay-Schutz) ist per Default ein
 * `randomUUID()`, `created` ein ISO-Zeitstempel (Request ~60 s gültig).
 * `opts` erlaubt deterministische Werte für Tests.
 */
export function baueSecurity(
  q: SecurityQuelle,
  opts: { nonce?: string; created?: string } = {},
): SecurityFelder {
  return {
    apiKey: q.apiKey,
    created: opts.created ?? new Date().toISOString(),
    kundenpasswort: loeseKundenpasswortHash(q),
    nonce: opts.nonce ?? randomUUID(),
    seriennummer: q.seriennummer,
  };
}
