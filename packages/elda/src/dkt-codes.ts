/**
 * Codetabellen der Krankentransport-Abrechnung, DKT 2.2 Kapitel D. Kapitel B.2
 * Punkt 4: „Dazugehörige Codetabellen (Schlüssel) sind ebenfalls im Kapitel D im
 * jeweiligen Unterkapitel angeführt." Wo Kapitel F einen Code anders schreibt,
 * gilt deshalb Kapitel D (siehe {@link EFORM}).
 *
 * Seitenangaben beziehen sich auf die Fassung vom 20.06.2025 (74 Seiten).
 */

/** Projektcode PROJ (D.39, Seite 33; C.1, Seite 13). */
export const PROJ_DKT = 'TK';

/**
 * Sub-Projektcode BEST (D.39, Seite 33; C.1, Seite 13): „TK" Echtdaten,
 * „T1" Testdaten, „TR" Rückmeldungen.
 */
export const BEST_DKT = { echt: 'TK', test: 'T1', rueckmeldung: 'TR' } as const;

/**
 * Datenübernehmender Versicherungsträger VSTRU bei der Übermittlung über ELDA.
 * Auskunft des ELDA Service Support vom 11.11.2026: „Im Feld VSTRU tragen Sie
 * bitte immer den Wert 14 ein." Das Muster E.3 trägt denselben Wert (ÖGK-O; ELDA
 * ist das Datensammelsystem der ÖGK Oberösterreich, C.3).
 */
export const VSTRU_ELDA = '14';

/** Fachgebiet FACHL, „65" fix (D.25, Seite 29; E.1, Seite 48). */
export const FACHGEBIET_DKT = '65';

/**
 * Version des Datensatzes VERSD (D.60, Seite 40): „16 — Version 2.2 gültig ab
 * Abrechnungszeitraum 10/2018 bzw. 01/2020 bzw. 01/2022 bzw. 07/2022 bzw.
 * 08/2023 bzw. 07/2025". VERS im Vorlaufsatz ist gleich zu belegen (D.59).
 */
export const VERSION_DKT = '16';

/** Abrechnungsart ABRA (D.2, Seite 20). */
export const ABRA = { '1': 'normale Abrechnung', '2': 'Nachverrechnung' } as const;

/** Abrechnungsstatus ABST (D.3, Seite 20). */
export const ABST = {
  '00': 'Abrechnung in Ordnung je Summensatz',
  '01': 'Abrechnung korrigiert je Summensatz',
} as const;

/**
 * Abrechnungszeitraum ABZR (D.4, Seiten 20–21). „Bei den Codes 41 – 93 handelt
 * es sich jeweils um eine Kalenderwoche": 41 = 1. Woche bis 93 = 53. Woche.
 */
export const ABZR: Readonly<Record<string, string>> = {
  '01': 'Jänner',
  '02': 'Februar',
  '03': 'März',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Dezember',
  '21': '1. Quartal',
  '22': '2. Quartal',
  '23': '3. Quartal',
  '24': '4. Quartal',
  '25': '1. Halbjahr',
  '26': '2. Halbjahr',
  '27': 'gesamtes Jahr',
  ...Object.fromEntries(Array.from({ length: 53 }, (_, i) => [String(41 + i), `${i + 1}. Woche`])),
};

/** Art der Beförderung BEF (D.10, Seite 23). */
export const BEF = { '1': 'sitzend', '2': 'liegend oder Tragsessel', '3': 'Rollstuhl' } as const;

/** Blockkennzeichen BLOKZ (D.13, Seite 23). */
export const BLOKZ = {
  P: 'Patient bzw. Karteninhaber',
  E: 'Weitere EKVK-Datenmeldungen',
  L: 'Leistung',
  D: 'Diagnose',
  B: 'Begründung',
  A: 'Abzug durch SV-Träger',
  N: 'Nachverrechnung durch SV-Träger',
} as const;

/** Bundesland BLLE, BLNDA, BLNDL (D.15, Seite 24). */
export const BUNDESLAND = {
  '1': 'Wien',
  '2': 'Niederösterreich',
  '3': 'Burgenland',
  '4': 'Oberösterreich',
  '5': 'Steiermark',
  '6': 'Kärnten',
  '7': 'Salzburg',
  '8': 'Tirol',
  '9': 'Vorarlberg',
} as const;

/** Bundesland-Code nach D.15. */
export type Bundesland = keyof typeof BUNDESLAND;

/** Diagnosekennzeichen DIAKZ (D.18, Seite 26). */
export const DIAKZ = {
  '2': 'Im Feld DIAGN befindet sich ein Text.',
  '3': 'Im Feld DIAGN befindet sich der ICD-10 Diagnosecode',
} as const;

/** Geschlecht EGESL im EKVK-Block „E" (D.22, Seite 27). */
export const EGESL = {
  D: 'divers',
  M: 'männlich',
  O: 'offen',
  U: 'unspezifisch',
  W: 'weiblich',
  I: 'inter',
  K: 'keine Angabe',
} as const;

/**
 * Art der Anspruchsbescheinigung EFORM (D.22, Seite 27). F.7.2 (Seite 62)
 * schreibt „111b" für das Formular E-111; maßgeblich ist laut B.2 die
 * Codetabelle in Kapitel D.
 */
export const EFORM = {
  EKVK: 'bei Karte oder Ersatzformular',
  '111': 'Formular E-111 bzw. E-111 Nachfolgeformular',
  '111B': 'Formular E-111B — Anspruch ausschließlich auf Behandlungen in einem Krankenhaus (nur für Belgien)',
} as const;

/** Fahrzeugart FART (D.26, Seite 29). */
export const FART = {
  '01': 'Rettungstransportwagen',
  '02': 'Notarztwagen',
  '03': 'Behindertenfahrzeug',
  '04': 'Fahrtendienst',
  '05': 'Taxi',
  '06': 'Flugzeug',
  '11': 'Behelfskrankentransportwagen',
  '12': 'Krankentransportwagen',
  '15': 'Notarzteinsatzfahrzeug',
  '16': 'Notarzthubschrauber',
  '18': 'Krankenbeförderungsdienst',
} as const;

/**
 * Transportgrund GRU (D.27, Seite 29). Die Fassung 2.2 vom 20.06.2025 hat die
 * Liste gegenüber der Fassung vom 15.11.2023 gekürzt und um 40 und 41 ergänzt
 * (Änderungsprotokoll: „Ergänzung neuer Transportgründe, Korrektur
 * Bezeichnungen"). Codes wie 02 „Berufskrankheit" oder 27 „Rehabilitation"
 * gibt es nicht mehr.
 *
 * Für den Kostenanteil der ÖGK (ab 01.07.2025) zählen 26 und 30: ÖGK-Schreiben
 * „Kostenanteile bei Krankenbeförderungen" vom 23.05.2025: „GRU: „26" für
 * Dialyse, „30" Strahlen-/Chemotherapie – D.27 DKT".
 */
export const GRU = {
  '01': 'Erkrankung',
  '03': 'Entbindung',
  '05': 'Alkoholmissbrauch',
  '06': 'Suchtgiftmissbrauch',
  '07': 'Unfall - Verkehr',
  '08': 'Unfall - Arbeit',
  '10': 'Unfall - Freizeit',
  '12': 'Unfall - Schüler',
  '16': 'Tot angetroffen',
  '18': 'Tierverletzung',
  '20': 'Raufhandel',
  '21': 'Verbrechen',
  '23': 'Therapie (ausgenommen Immuntherapie)',
  '24': 'Kur / Rehabilitation',
  '25': 'Körpergerechte Anpassung von Heilbehelfen und Hilfsmittel',
  '26': 'Dialyse/Apherese',
  '28': 'Kontrolluntersuchung KH, Arzt (ausgenommen Organtransplantation)',
  '30': 'Strahlentherapie und Chemotherapie',
  '36': 'Organtransport',
  '39': 'Organtransplantation',
  '40': 'Immuntherapie (nach Krebserkrankungen oder Transplantationen)',
  '41': 'Palliativ',
} as const;

/** Kostenbeteiligungssatz KBS (D.29, Seite 30). */
export const KBS = { '01': 'Prozentsatz', '02': 'Pauschale', '03': 'Kilometerverrechnung' } as const;

/** NACA-Code (D.32, Seiten 30–32), Kurzbezeichnungen. */
export const NACA = {
  '1': 'geringfügige Störung',
  '2': 'ambulante Abklärung',
  '3': 'stationäre Behandlung',
  '4': 'akute Lebensgefahr nicht auszuschließen',
  '5': 'akute Lebensgefahr',
  '6': 'Reanimation',
  '7': 'Tod',
} as const;

/** Art der Pauschale PART im Pauschalsatz (D.35, Seite 32). */
export const PART = { A: 'Abzug', Z: 'Zahlung' } as const;

/** Transportart TART (D.52, Seite 37). */
export const TART = {
  '01': 'Hintransport stat. Behandlung',
  '02': 'Rück-, Heimtransport stat. Behandlung',
  '03': 'Hintransport amb. Behandlung',
  '04': 'Rück-, Heimtransport amb. Behandlung',
  '05': 'Kombination 01/02',
  '06': 'Kombination 03/04',
  '07': 'Verlegung',
  '08': 'Zwischentransport',
  '09': 'Anschlusstransport',
  '10': 'Übergabe Rettungshubschrauber',
  '11': 'Übergabe Notarztwagen',
  '12': 'Mitfahrt verweigert',
  '13': 'Leerfahrt',
  '14': 'Übergabe Rettungswagen',
  '15': 'Belassung',
  '16': 'Erste-Hilfe Einsatz',
  '99': 'sonstiger Transport (Begründungsblock notwendig)',
} as const;

/**
 * Fachgebiete für FACHU, das „Fachgebiet des anordnenden Arztes/Stelle" (D.25).
 *
 * Die DKT nennt für FACHU nur „2 Stellen numerisch" und führt selbst keine
 * Codeliste. Der Katalog stammt aus der Organisationsbeschreibung DVP
 * (Datenaustausch mit Vertragspartner) des Dachverbands, Version 3.9, Stand
 * 06/2026, Kapitel D.33 „FACHL, FACHU, FACHV – Fachgebiet", Seiten 46–48 — dort
 * ist FACHU das „Fachgebiet des überweisenden Vertragspartners". Das Muster E.3
 * der DKT trägt beim Verordner den Code `85`, der in dieser Liste steht. Weil
 * die DKT nicht ausdrücklich auf die Liste verweist, prüft der Satzbau FACHU
 * weiterhin nur auf zwei Ziffern; der Katalog ist für Auswahllisten gedacht.
 *
 * Fußnote der Quelle zu 81, 88 und 89: „ab 1. Jänner 2018 flächendeckend gültig".
 */
export const FACHGEBIET = {
  '01': 'Allgemein-/Allgemein- und Familienmedizin',
  '02': 'Anästhesiologie und Intensivmedizin',
  '03': 'Augenheilkunde und Optometrie',
  '04': 'Chirurgie',
  '05': 'Haut- und Geschlechtskrankheiten',
  '06': 'Frauenheilkunde und Geburtshilfe',
  '07': 'Innere Medizin',
  '08': 'Kinder- und Jugendheilkunde',
  '09': 'Hals-, Nasen- und Ohrenheilkunde',
  '10': 'Lungenkrankheiten',
  '11': 'Neurologie und Psychiatrie/Psychiatrie und Neurologie',
  '12': 'Orthopädie und orthopädische Chirurgie',
  '13': 'Physikalische Medizin',
  '14': 'Radiologie',
  '15': 'Unfallchirurgie',
  '16': 'Urologie',
  '17': 'Zahn-, Mund- und Kieferheilkunde',
  '18': 'Neurochirurgie',
  '19': 'Neurologie',
  '20': 'Psychiatrie',
  '21': 'Plastische Chirurgie',
  '22': 'Kinder- und Jugendchirurgie',
  '23': 'Mund-, Kiefer- und Gesichtschirurgie',
  '24': 'Nuklearmedizin',
  '26': 'Strahlentherapie – Radioonkologie',
  '27': 'Zahnmedizin',
  '28': 'Blutgruppenserologie und Transfusionsmedizin',
  '29': 'Immunologie',
  '30': 'Kieferorthopädie',
  '31': 'Innere Medizin und Kardiologie',
  '32': 'Kinder- und Jugendpsychiatrie',
  '33': 'Histologie und Embryologie',
  '34': 'Medizinische Biologie',
  '35': 'Virologie',
  '36': 'Gruppenpraxis',
  '37': 'Arbeits- und Betriebsmedizin',
  '38': 'Pharmakologie und Toxikologie',
  '39': 'Medizinische Genetik',
  '44': 'Innere Medizin und Pneumologie',
  '45': 'Orthopädie und Traumatologie',
  '49':
    'Sonstige, nicht kurative Leistungserbringung: Anatomie, Medizinische Biophysik, Medizinische ' +
    'Leistungsphysiologie, Neurobiologie, Neuropathologie, Physiologie und Pathophysiologie, Sozialmedizin, ' +
    'Spezifische Prophylaxe und Tropenhygiene, Tumorbiologie, für Begutachtungen',
  '50': 'Medizinische und Chemische Labordiagnostik',
  '51': 'Labor, EEG',
  '52': 'Labor, zytodiagnostisch',
  '53': 'Pathologie und Histologie',
  '55': 'Hygiene und Mikrobiologie bzw. Mikrobiologisch-serologische Labordiagnostik',
  '56': 'Diplomierte Kindergesundheits- und Krankenpflege',
  '59': 'Hausapotheke',
  '62': 'Dentist: innen',
  '63': 'Physiotherapie',
  '64': 'Heilmassage',
  '66': 'Logopädie',
  '70': 'Hebamme',
  '71': 'Diplomiere Gesundheits- und Krankenpflege',
  '72': 'Psychotherapie',
  '73': 'Klinische Psychologie',
  '75': 'Ergotherapie',
  '80': 'Bettenführende Krankenanstalten (ausgenommen stationäre Rehabilitation)',
  '81': 'Ambulanzen bettenführender Krankenanstalten',
  '84':
    'CT, MR und sonstige bildgebende technische Leistungen (z.B. Radiologie, Knochendichte und ' +
    'nuklearmedizinische Leistungen)',
  '85': 'Selbständige Ambulatorien (soweit sie nicht den Fachgebieten 84, 86, 89, 91 und 96 zuzuordnen sind)',
  '86': 'Selbständiges Ambulatorium für Zahn-, Mund- und Kieferheilkunde',
  '87': 'Pflegeheim, Pensionistenheim',
  '88': 'Stationäre Rehabilitationseinrichtungen',
  '89': 'Ambulante Rehabilitationseinrichtungen',
  '91': 'Selbständiges Ambulatorium für physikalische Medizin',
  '92': 'Hauskrankenpflegeorganisation',
  '96': 'Selbständiges Ambulatorium für Kieferorthopädie',
  '99':
    'Sonstige Leistungserbringung, soweit sie nicht den Fachgebieten 40-43, 50-91 zuzuordnen sind, z.B.: ' +
    'Universitätsinstitut (sofern nicht als Teil einer Krankenanstalt), Bundesstaatliche Untersuchungsanstalt, ' +
    'Sonstige Unternehmen (Handelsunternehmen, Frisöre und Perückenherstellung, etc.)',
} as const;

/** Unterteilung Fachgebiet UFACHL (D.55, Seite 38). */
export const UFACHL = {
  '49': 'Gemeinde Wien',
  '50': 'Rotes Kreuz',
  '51': 'Grünes Kreuz',
  '52': 'Sonstige Transportunternehmen',
  '53': 'Notarzteinsatzfahrzeug (NEF)',
  '54': 'Notarzthubschrauber',
  '55': 'Arbeitersamariterbund',
  '56': 'Fahrtendienst mit Rollstuhl',
  '57': 'Fahrtendienst ohne Rollstuhl (Taxi)',
  '58': 'Notarztwagen (NAW)',
  '59': 'Flugrettung Sonstige (z.B. Ambulanzjet)',
  '60': 'Johanniter',
  '61': 'Malteser',
  '62': 'Taxi Dialyse',
  '63': 'Rotes Kreuz Fremdkassen ÖGK-B, ÖGK-S',
} as const;

/** Vorzeichen VORZ, VZS, VZK, VZZS, VZR (D.65, Seite 45). */
export const VORZEICHEN = { '0': 'Werte sind positiv', '1': 'Werte sind negativ' } as const;

/** Zeitkritisch ZKR (D.69, Seite 46). */
export const ZKR = { '0': 'nicht zeitkritisch', '1': 'zeitkritisch' } as const;

/**
 * Versicherungsträger VSTR, VSTRA, VSTRL, VSTRU (D.62, Seiten 41–43).
 *
 * Fußnote zu 05: „Ab 01.03.2022 ist der Code 05 aufgrund der gemeinsamen
 * Abrechnung an die BVAEB (Code 07) nur noch im Feld VSTRL zulässig."
 */
export const VERSICHERUNGSTRAEGER: Readonly<Record<string, string>> = {
  '02': 'Pensionsversicherung',
  '08': 'Allgemeine Unfallversicherung',
  '11': 'Österreichische Gesundheitskasse (ÖGK-W)',
  '12': 'Österreichische Gesundheitskasse (ÖGK-N)',
  '13': 'Österreichische Gesundheitskasse (ÖGK-B)',
  '14': 'Österreichische Gesundheitskasse (ÖGK-O)',
  '15': 'Österreichische Gesundheitskasse (ÖGK-ST)',
  '16': 'Österreichische Gesundheitskasse (ÖGK-K)',
  '17': 'Österreichische Gesundheitskasse (ÖGK-S)',
  '18': 'Österreichische Gesundheitskasse (ÖGK-T)',
  '19': 'Österreichische Gesundheitskasse (ÖGK-V)',
  '05': 'Versicherungsanstalt öffentlich Bediensteter, Eisenbahnen und Bergbau – Eisenbahn Bergbau (BVAEB-EB)',
  '07': 'Versicherungsanstalt öffentlich Bediensteter, Eisenbahnen und Bergbau – Öffentlich Bedienstete (BVAEB-OEB)',
  '40': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft',
  '41': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Wien',
  '42': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Niederösterreich',
  '43': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Burgenland',
  '44': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Oberösterreich',
  '45': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Steiermark',
  '46': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Kärnten',
  '47': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Salzburg',
  '48': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Tirol',
  '49': 'Sozialversicherungsanstalt der Selbständigen - gewerblichen Wirtschaft, Landesstelle Vorarlberg',
  '50': 'Sozialversicherungsanstalt der Selbständigen - Landwirtschaft',
  '1A': 'Krankenfürsorgeanstalt der Bediensteten der Stadt Wien',
  '2A': 'Krankenfürsorgeanstalt der Beamten der Stadtgemeinde Baden',
  '4A': 'Krankenfürsorge für die Beamten der Landeshauptstadt Linz',
  '4B': 'Kranken- und Unfallfürsorge für oberösterreichische Gemeindebeamte',
  '4C': 'Krankenfürsorgeanstalt für oberösterreichische Landesbeamte',
  '4D': 'Oberösterreichische Lehrer-Kranken- und Unfallfürsorge',
  '4E': 'Krankenfürsorge für die Beamten des Magistrates Steyr',
  '4F': 'Krankenfürsorge für oberösterreichische Beamten der Stadt Wels',
  '5A': 'Krankenfürsorgeanstalt für die Beamten der Landeshauptstadt Graz',
  '6A': 'Krankenfürsorgeanstalt für die Beamten der Stadt Villach',
  '7A': 'Krankenfürsorgeanstalt der Magistratsbeamten der Landeshauptstadt Salzburg',
  '7C': 'Krankenfürsorgeeinrichtung der Beamten der Stadtgemeinde Hallein',
  '8B': 'Kranken- und Unfallfürsorge der Tiroler Gemeindebeamten',
  '8C': 'Kranken- und Unfallfürsorge der Tiroler Landesbeamten',
  '8D': 'Kranken- und Unfallfürsorge der Tiroler Landeslehrer',
};

/** Codes der Österreichischen Gesundheitskasse, je Landesstelle (D.62, Seite 42). */
export const OEGK_CODES: readonly string[] = ['11', '12', '13', '14', '15', '16', '17', '18', '19'];

/** Code der Allgemeinen Unfallversicherungsanstalt (D.62, Seite 42). */
export const AUVA_CODE = '08';

/** Nur noch als VSTRL zulässiger Code (D.62, Fußnote Seite 42). */
export const NUR_LEISTUNGSZUSTAENDIG: readonly string[] = ['05'];

/**
 * UID des verrechnungszuständigen Trägers UIDV (D.56, Seiten 38–39), je Code.
 *
 * Für die ÖGK steht die Nummer in der Tabelle nur einmal, mittig neben den neun
 * Landesstellen 11–19 (zusammengefasste Zelle; ebenso bei der SVS neben 40–49).
 * Die ÖGK ist ein Rechtsträger; ihre Schreiben führen dieselbe Nummer im Kopf
 * („UID-Nr. ATU74552637", ÖGK an den Fachverband, 16.12.2024 und 23.05.2025).
 *
 * 8B: Die Fassung 2.2 ersetzt „keine UID-Nr. v. FA" durch ATU80174712
 * (Änderungsprotokoll: „D.56 Ergänzung UID-Nummer 8B").
 */
export const UIDV: Readonly<Record<string, string>> = {
  '02': 'ATU56427726',
  '08': 'ATU16211702',
  '1A': 'ATU16250704',
  '2A': 'ATU16215904',
  '4A': 'ATU36918706',
  '4B': 'ATU23159506',
  '4C': 'ATU62098937',
  '4D': 'ATU22981209',
  '4E': 'ATU39244108',
  '4F': 'ATU62623245',
  '5A': 'ATU28608307',
  '6A': 'ATU37185906',
  '7A': 'ATU36768002',
  '7C': 'ATU36805105',
  '8B': 'ATU80174712',
  '8C': 'ATU36970505',
  '8D': 'ATU36970505',
  ...Object.fromEntries(OEGK_CODES.map((c) => [c, 'ATU74552637'])),
  '07': 'ATU74709924',
  ...Object.fromEntries(
    ['40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50'].map((c) => [c, 'ATU74620109']),
  ),
};

/**
 * Sammelnummern für VPNUW, „Tritt der Sonderfall auf, dass die
 * Vertragspartnernummer nicht bekannt ist" (D.63, Seiten 43–44).
 */
export const SAMMELNUMMERN = {
  '401988': 'Sammelnummer für alle Wahlärzte und Wahlinstitute',
  '401993': 'Sammelnummer Chefärzte, Kassenärzte und ÖGK-Ambulatorien',
  '402000': 'Sammelnummer, Ärzte deren Namen nicht feststellbar sind',
  '402016': 'KH-Aufnahme oder ambulante Behandlung ohne ärztliche Einweisung (Erste Hilfe)',
} as const;

/**
 * Versichertenkategorie KAT bei zwischenstaatlichen Betreuungsfällen
 * (D.48, Seiten 35–36), Code → Land.
 */
export const KAT: Readonly<Record<string, string>> = {
  '028': 'Fremdstaat nicht bekannt',
  '029': 'Fremdstaaten (defacto Versicherte)',
  '082': 'Belgien',
  '057': 'Bosnien-Herzegowina',
  '063': 'Bulgarien',
  '091': 'Dänemark',
  '070': 'Deutschland',
  '066': 'Estland',
  '086': 'Finnland',
  '075': 'Frankreich',
  '084': 'Griechenland',
  '083': 'Großbritannien (inkl. Nordirland)',
  '092': 'Irland',
  '093': 'Island',
  '041': 'Israel',
  '071': 'Italien',
  '049': 'Kroatien',
  '067': 'Lettland',
  '077': 'Liechtenstein',
  '068': 'Litauen',
  '079': 'Luxemburg',
  '069': 'Malta',
  '056': 'Mazedonien',
  '033': 'Montenegro',
  '080': 'Niederlande',
  '090': 'Norwegen',
  '094': 'Polen',
  '085': 'Portugal',
  '064': 'Rumänien',
  '076': 'Schweden',
  '078': 'Schweiz',
  '032': 'Serbien',
  '065': 'Slowakei',
  '088': 'Slowenien',
  '073': 'Spanien',
  '098': 'Tschechien',
  '047': 'Tunesien',
  '034': 'Türkei',
  '095': 'Ungarn',
  '099': 'Zypern',
};

/** Gruppe eines Ablehnungsgrundes, wie D.1 die Tabelle gliedert. */
export type AblehnungsGruppe =
  | 'Leistungszuständigkeit'
  | 'Formale Gründe'
  | 'Transport'
  | 'Verrechnung'
  | 'Allgemeines'
  | 'Einschränkungsgrund';

/**
 * Ablehnungsgründe ABLG (D.1, Seiten 18–20). In SART 21/22/62 zweistellig, in
 * SART 11 dreistellig; „Der Ablehnungsgrund muss nur bei einer Rückantwort
 * angegeben werden."
 */
export const ABLG: Readonly<Record<string, { readonly gruppe: AblehnungsGruppe; readonly text: string }>> = {
  ...gruppe('Leistungszuständigkeit', {
    '01': 'Keine Anspruchsberechtigung aus Familienversicherung',
    '02': 'Keine Vorbewilligung',
    '03': 'Keine Versicherung feststellbar',
    '04': 'Die Kasse ist für diesen Transport nicht leistungszuständig',
    '05': 'Leistungszuständig Pensionsversicherungsanstalt',
    '08': 'Leistungszuständig Sozialversicherungsanstalt der Selbständigen – gewerbliche Wirtschaft',
    '09': 'Leistungszuständig Allgemeine Unfallversicherungsanstalt',
    '10': 'Manuell zu klärender Fremdkassenfall',
    '11': 'Mehrere Versicherte mit gleichen Zu-, Vornamen und Geb. Datum (Auswahl durch Sachbearbeiter)',
    '12': 'Leistungszuständig Sozialversicherungsanstalt der Selbständigen – Landwirtschaft',
    '13': 'Leistungen chefärztlich abgelehnt',
  }),
  ...gruppe('Formale Gründe', {
    '14': 'Überstellungsgrund fehlt',
    '15': 'Ärztlicher Transportauftrag fehlt',
    '16': 'Die Behandlungsbestätigungen fehlen',
    '17':
      'Erhebungen wurden notwendig. Nach Abschluss der Erhebungen werden wir unaufgefordert Ihre offene ' +
      'Rechnung einer Erledigung zuführen (Schwebefall)',
    '18': 'nur Rückersatz möglich',
    '19': 'Transportauftrag nicht korrekt ausgefertigt',
    '20': 'Medizinische Begründung bzw. Diagnose für Transport fehlt bzw. nicht ausreichend',
    '21': 'Transportdatum falsch',
    '22': 'Versichertendaten fehlen/falsch',
    '23': 'Verursacherdaten fehlen/falsch',
    '24': 'Angehörigendaten fehlen/falsch',
    '25': 'Keine Krankenbehandlung',
    '26': 'Diagnose fehlt',
    '27': 'Transportgrund fehlt/falsch',
    '28': 'Transportart falsch',
    '29': 'Art der Beförderung falsch/sitzend - liegend',
    '30': 'Tarif-Positionsnummer falsch',
    '31': 'KM bzw. Anzahl der Pauschalen fehlt',
    '32': 'Betrag falsch',
    '33': 'USt. falsch',
    '34': 'Kostenbeteiligung falsch',
    '35': 'Kostenbeteiligungssatz falsch',
    '36':
      'Ohne Angabe der vollständigen Personaldaten (VSNR und Geburtsdatum) ist eine EDV-mäßige Bearbeitung ' +
      'nicht möglich. Wir ersuchen um Ergänzung und Wiedervorlage',
    '37': 'Verordnungsdatum fehlt',
  }),
  ...gruppe('Transport', {
    '38': 'Liegendtransport medizinisch nicht begründet',
    '39': 'Transport nur bis zur nächsten geeigneten Behandlungsstelle',
    '40': 'Transport nur ab dem Tal bei Sport und Touristik',
    '41': 'Festgestellter Mehrfachtransport - jedoch nicht als solcher gekennzeichnet',
    '42': 'Transportdatum ist größer als Tagesdatum',
    '43': 'Transport während der Anstaltspflege /z.B.: CT usw.)',
    '44':
      'Nach gesetzlichen Bestimmungen können bei Wohnsitzwechsel keine Transportkosten übernommen werden ' +
      'Privattransport (Wohnsitzwechsel, ins Pflegeheim, ...)',
    '45':
      'Für diesen Überstellungstransport liegt nach Ansicht unseres ärztlichen Beraters keine medizinische ' +
      'Notwendigkeit vor',
    '46': 'Bodentransport wäre ausreichend und zweckmäßig gewesen',
    '47': 'Ambulanter Zwischentransport',
    '48':
      'Die Transportkosten können laut unseren satzungsmäßigen Bestimmungen nur in die bzw. von der ' +
      'nächstgelegenen geeigneten Vertrags-, Wahleinrichtung übernommen werden',
    '49':
      'Die Transportkosten können laut unseren satzungsmäßigen Bestimmungen nur in das nächstgelegene ' +
      'geeignete Krankenhaus übernommen werden',
    '50':
      'Die Transportkosten können laut unseren satzungsmäßigen Bestimmungen nur vom nächstgelegenen ' +
      'geeigneten Krankenhaus übernommen werden',
    '51':
      'Die Transportkosten können laut unseren satzungsmäßigen Bestimmungen nur zu dem nächstgelegenen ' +
      'geeigneten Vertrags(fach)arzt übernommen werden',
    '52':
      'Die Transportkosten können laut unseren satzungsmäßigen Bestimmungen nur von dem nächstgelegenen ' +
      'geeigneten Vertrags(fach)arzt übernommen werden',
    '53': '§14/8 KAG - Überstellung in anderwärtiges KH aus organisatorischen Gründen',
    '54': 'Transport in ein Pflegeheim',
    '55': 'Heimtransportkosten sind nur in Relation Hauptwohnsitz - nächstgelegene Behandlungsstelle verrechenbar.',
    '56': 'Ablehnung - Transport von einem öffentlichen Krankenhaus in eine private Krankenanstalt',
    '57':
      'Keine Leistung mangels Rechtsgrundlage (Transport eines Verstorbenen, Transport von Blutkonserven, ' +
      'Abholen von Heilmitteln und Hilfsmitteln).',
    '58': 'Krankentransport von einer höherwertigen in eine niederwertige Krankenanstalt',
    '59': 'Schein unvollständig ausgefüllt',
  }),
  ...gruppe('Verrechnung', {
    '60': 'Doppelverrechnung',
    '61': 'Kilometeranzahl erscheint zu hoch; wir ersuchen um Überprüfung bzw. Bekanntgabe der genauen Strecke',
    '62': 'Eine Verrechnung ist nur nach Kilometertarif möglich',
    '63': 'Die Verrechnung einer Wartezeit ist in diesem Fall nicht möglich',
    '64': 'Übernommen werden nur jene Kosten, die beim Einsatz des nächstgelegenen geeigneten Transportmittels entstanden wäre',
    '65':
      'Vom auftraggebenden Arzt/Stelle ist ein Transport ohne Sanitäter angeordnet. Wir ersuchen um ' +
      'Richtigstellung der Verrechnung',
    '66': 'Leistung entspricht nicht der Anweisung',
    '67': 'andere Bewilligung durch chefärztlichen Dienst',
    '68': 'Behindertentransport',
  }),
  ...gruppe('Allgemeines', {
    '69':
      'Erfassungsfehler vom Sachbearbeiter - entspricht einer Stornierung und wird bei keiner weiteren ' +
      'Verarbeitung berücksichtigt (beim Entladen werden diese Fälle ausgeschieden)',
    '70': 'Sonstige vom Sachbearbeiter festgestellte Ablehnung',
    '71': 'Formalfehler im Datenträger',
    '72': 'Abrechnung storniert (wenn bereits abgerechnet und diese rückverrechnet werden soll)',
    '73': 'Sonstige Ablehnung',
    '74': 'fehlende UIDV',
    '75': 'Daten der EKVK nicht vorhanden',
  }),
  ...gruppe('Einschränkungsgrund', {
    '76': 'Kilometereinschränkung bzw. Erweiterung',
    '77': 'Nicht nächstgelegene Behandlungsstelle',
    '78': 'Nicht nächstgelegene Rettungsstelle',
    '79': 'Tarifänderung (liegend/sitzend/Pauschale)',
    '80': 'Rechenfehler des Vertragspartners',
    '81': 'Sachlicher Fehler des Vertragspartners',
    '82': 'Einschränkung von/zur Wohnung',
    '83': 'Einschränkung bereits durch Vertragspartner',
    '84': 'Nachverrechnung',
    '85': 'Kein Arbeitsunfall',
    '86': 'Keine Berufskrankheit',
    '87': 'Kein Unfall gemeldet',
    '88': 'Transport nicht Folge von AU/BK',
    '89': 'Transport erfolgte nicht in eigener Einrichtung',
    '90': 'AUVA nicht leistungszuständig',
    '91': 'Auslandsfall – elektronische Rechnung nicht möglich',
    '92': 'KV-Träger zuständig',
    '93': 'Gültigkeit der EKVK abgelaufen',
    '94': 'Leistungszuständigkeit anderer SV-Träger',
    '99': 'Sonstige Einschränkung',
  }),
};

function gruppe(
  name: AblehnungsGruppe,
  texte: Readonly<Record<string, string>>,
): Record<string, { gruppe: AblehnungsGruppe; text: string }> {
  return Object.fromEntries(Object.entries(texte).map(([code, text]) => [code, { gruppe: name, text }]));
}
