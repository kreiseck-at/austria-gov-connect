/**
 * Prüfziffern von Versicherungsnummer und Steuernummer. Beide Verfahren stehen
 * nicht im DM-Org; die Quellen nennen die Funktionen selbst.
 */

/**
 * Prüfziffer der Versicherungsnummer `LLLPTTMMJJ` nach der Anfragebeantwortung
 * 4690/AB XXIII. GP (BM für Gesundheit, Familie und Jugend, 01.09.2008, mit der
 * Stellungnahme des Hauptverbands): Faktoren 3, 7, 9 für die Laufnummer und
 * 5, 8, 4, 2, 1, 6 für das Geburtsdatum, Prüfziffer = Summe der Produkte mod 11.
 * „Ergibt sich ein Divisionsrest von 10, so wird die nächsthöhere Laufnummer
 * verwendet" — ein Rest von 10 ist also nie gültig.
 *
 * ELDA setzt das durch: Eine Anmeldung mit falscher Prüfziffer kam auf der
 * SIT-Plattform am 12.10.2026 als `nicht_uebernommen` mit `F7020` zurück.
 */
export function vsnrPruefzifferGueltig(vsnr: string): boolean {
  if (!/^\d{10}$/.test(vsnr)) return false;
  const z = [...vsnr].map(Number);
  const faktoren = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6];
  const rest = faktoren.reduce((summe, f, i) => summe + f * z[i]!, 0) % 11;
  return rest !== 10 && rest === z[3];
}

/**
 * Prüfziffer der neunstelligen Steuernummer (Finanzamtsnummer und Steuernummer
 * samt Prüfziffer) nach STUZZA „Finanzamtszahlung in MBS", Version 7.0.07
 * vom 12.12.2016, Seite 8.
 */
export function steuernummerPruefzifferGueltig(steuernummer: string): boolean {
  if (!/^\d{9}$/.test(steuernummer)) return false;
  const z = [...steuernummer].map(Number);
  let summe = 0;
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 1) {
      const doppelt = 2 * z[i]!;
      summe += Math.floor(doppelt / 10) + (doppelt % 10);
    } else {
      summe += z[i]!;
    }
  }
  return (10 - (summe % 10)) % 10 === z[8];
}
