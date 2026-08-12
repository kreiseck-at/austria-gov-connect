// § 7 Abs 2 Arbeitsruhegesetz zählt die gesetzlichen Feiertage abschließend auf. Das ist
// eine andere Menge als die fristenhemmenden Tage nach BAO/AVG (siehe fristen.ts) — deshalb
// tragen die Funktionen hier "NachArg" im Namen, statt ein unspezifisches "istFeiertag" zu
// sein, unter dem sich beide Rechtsfragen unbemerkt vermischen ließen.

import { parseIsoDatum } from './datum';
import { ostermontag, christiHimmelfahrt, pfingstmontag, fronleichnam } from './ostern';

export interface Feiertag {
  datum: string;
  name: string;
}

export function gesetzlicheFeiertageNachArg(jahr: number): Feiertag[] {
  const feiertage: Feiertag[] = [
    { datum: `${jahr}-01-01`, name: 'Neujahr' },
    { datum: `${jahr}-01-06`, name: 'Heilige Drei Könige' },
    { datum: ostermontag(jahr), name: 'Ostermontag' },
    { datum: `${jahr}-05-01`, name: 'Staatsfeiertag' },
    { datum: christiHimmelfahrt(jahr), name: 'Christi Himmelfahrt' },
    { datum: pfingstmontag(jahr), name: 'Pfingstmontag' },
    { datum: fronleichnam(jahr), name: 'Fronleichnam' },
    { datum: `${jahr}-08-15`, name: 'Mariä Himmelfahrt' },
    { datum: `${jahr}-10-26`, name: 'Nationalfeiertag' },
    { datum: `${jahr}-11-01`, name: 'Allerheiligen' },
    { datum: `${jahr}-12-08`, name: 'Mariä Empfängnis' },
    { datum: `${jahr}-12-25`, name: 'Weihnachten' },
    { datum: `${jahr}-12-26`, name: 'Stephanstag' },
  ];
  // ostermontag() prüft das Jahr bereits; die Sortierung macht die Liste als Kalenderjahr lesbar.
  return feiertage.sort((links, rechts) => (links.datum < rechts.datum ? -1 : 1));
}

// Beantwortet ausschließlich die Feiertagsruhe-Frage nach § 7 Abs 2 ARG. Für die Frage,
// ob ein Datum eine Frist verschiebt, gilt eine andere, größere Menge — siehe fristen.ts.
export function istGesetzlicherFeiertagNachArg(datum: string): boolean {
  const { jahr } = parseIsoDatum(datum);
  return gesetzlicheFeiertageNachArg(jahr).some((feiertag) => feiertag.datum === datum);
}
