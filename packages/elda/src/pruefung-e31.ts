import { EldaError } from './errors';
import { gueltigeVsnrStruktur } from './pruefung-e29';
import { vsnrPruefzifferGueltig } from './pruefziffer';

type Werte = Readonly<Record<string, string | undefined>>;

function wirf(code: string, text: string): never {
  throw new EldaError(`${code}: ${text}`);
}

function normalisiert(wert: string | undefined): string | undefined {
  if (wert === undefined) return undefined;
  const getrimmt = wert.trim().normalize('NFC');
  return getrimmt === '' ? undefined : getrimmt;
}

/**
 * Prüft den Satzinhalt der Adressmeldung Versicherter gegen die Regeln des
 * Prüfkatalogs 43.1.0.0, Blatt `AV`, die sich aus den Feldwerten allein
 * entscheiden lassen und ELDA mit Status `N` führt. Leere Pflichtfelder hat zuvor
 * schon `pruefePflichtstufen` abgewiesen.
 *
 * - `F8031`: Die Versicherungsnummer wird auf die Stellenfolge `LLLPTTMMJJ`
 *   geprüft wie bei der Versichertenmeldung (`F7020`) und auf die Prüfziffer
 *   (`vsnrPruefzifferGueltig`). Auf der SIT-Plattform (Fall S22, 13.10.2026)
 *   wies ELDA eine Adressmeldung mit verfälschter Prüfziffer mit `F8031`
 *   „Ungueltige Angabe im Feld VERSICHERUNGSNUMMER" ab.
 * - `F8039`: „WKFZ = A und VSTR = ÖGK". Der Katalog führt daneben `F8041`
 *   „ungültig oder WKFZ=A". Auf der SIT-Plattform (Fall S21, 13.10.2026) kam
 *   für `A` an die ÖGK `F8039` – `F8041` kam nicht. Der Satz selbst kennt den
 *   Träger nicht (VSTR steht im Bestand); `A` wird deshalb immer abgewiesen,
 *   mit dem beobachteten Code. Ob ein anderer Träger `A` annimmt, ist unbelegt
 *   (die Feldtabelle, Seite 344, schränkt nur die ÖGK ein).
 *
 * Nicht geprüft werden `F8011` (ungültige BKNR) und `F8051` (ungültige
 * Postleitzahl), weil der Katalog nicht sagt, woran er „ungültig" festmacht,
 * `F8061`/`F8071` (Groß- und Kleinschreibung von Ort und Straße, ohne Regel in
 * den Quellen), ein KFZ-Kennzeichen außerhalb der öffentlichen Staatencode-
 * Tabelle (sie ist dafür nicht abschließend, siehe `staaten.ts`) sowie die
 * Warnungen zur Länge der BKNR und zur Zuordnung zur Seriennummer.
 */
export function pruefeAdressmeldungInhalt(werte: Werte): void {
  const vsnr = normalisiert(werte.VSNR);
  if (vsnr !== undefined && !gueltigeVsnrStruktur(vsnr)) {
    wirf(
      'F8031',
      'Die Versicherungsnummer (VSNR) ist ungültig. Erwartet: zehn Ziffern in der Form LLLPTTMMJJ ' +
        '(Kapitel D.6).',
    );
  }
  if (vsnr !== undefined && !vsnrPruefzifferGueltig(vsnr)) {
    wirf(
      'F8031',
      'Die Versicherungsnummer (VSNR) ist ungültig: Die Prüfziffer (vierte Stelle) stimmt nicht.',
    );
  }

  const wkfz = normalisiert(werte.WKFZ);
  if (wkfz === 'A') {
    wirf(
      'F8039',
      'Das KFZ-Kennzeichen des Wohnorts (WKFZ) darf nicht A sein: Die Adressmeldung dient nur der ' +
        'Übermittlung eines ausländischen Hauptwohnsitzes; inländische Adressen kommen aus dem ' +
        'zentralen Melderegister (Kapitel E.31, E.31.2.1).',
    );
  }
}
