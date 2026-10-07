import { EldaError } from './errors';
import { gueltigeVsnrStruktur } from './pruefung-e29';

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
 *   geprüft wie bei der Versichertenmeldung (`F7020`); die Prüfziffer nicht,
 *   ihr Verfahren steht in keiner Quelle.
 * - `F8041`: „ungültig oder WKFZ=A". Der Katalog weist `A` damit ohne Rücksicht
 *   auf den Träger ab; daneben steht `F8039` „WKFZ="A" und VSTR = ÖGK". Die
 *   Feldtabelle (Seite 344) sagt nur „Für Meldungen an die ÖGK: Nur
 *   ausländische Hauptwohnsitze, A = Österreich ist nicht zulässig", und
 *   Kapitel E.31.2.1 begründet es: Inländische Adressen kommen aus dem
 *   zentralen Melderegister. Ob ein anderer Träger `A` annimmt, ist damit
 *   widersprüchlich belegt; hier wird `A` wie in `F8041` immer abgewiesen.
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
        '(Kapitel D.6). Die Prüfziffer wird hier nicht nachgerechnet; ELDA prüft sie serverseitig.',
    );
  }

  const wkfz = normalisiert(werte.WKFZ);
  if (wkfz === 'A') {
    wirf(
      'F8041',
      'Das KFZ-Kennzeichen des Wohnorts (WKFZ) darf nicht A sein: Die Adressmeldung dient nur der ' +
        'Übermittlung eines ausländischen Hauptwohnsitzes; inländische Adressen kommen aus dem ' +
        'zentralen Melderegister (Kapitel E.31, E.31.2.1). Bei der ÖGK lautet der Code F8039.',
    );
  }
}
