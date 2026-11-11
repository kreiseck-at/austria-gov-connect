import { EldaError, EldaProtocolError } from './errors';

/**
 * Client für den Distanzanzeiger der österreichischen Sozialversicherung —
 * „Schnittstellendokumentation Distanzanzeiger", Version 1.32.710, Stand April
 * 2026 (hängt als PDF am Testclient der Schnittstelle). Vertragspartner und
 * ihre Abrechnungsfirmen fragen damit die Entfernung zwischen Abhol- und
 * Bestimmungsort ab; der Gesamtvertrag macht sie zur Grundlage der
 * Transportkilometer (§ 9 Abs. 5, siehe {@link ganzeKilometer}).
 *
 * Die Schnittstelle ist ein einzelner POST: ein JSON-Array von mindestens zwei
 * Standorten, Antwort als JSON; der Zugriff läuft über einen API-Key im
 * Header `Authorization: Bearer <api_key>` (Seite 3).
 *
 * Der Client fragt bewusst sparsam: ein Aufruf ist eine Anfrage, Anfragen
 * laufen nacheinander mit Mindestabstand, und nichts wird von selbst
 * wiederholt. Ein Key gilt für die ganze Software — wird er wegen
 * Massenabfragen gesperrt, fällt die Kilometerermittlung für alle Betriebe aus.
 */

/** Ein Standort der Anfrage (Seite 4). Mindestens eines der Felder muss belegt sein. */
export interface DistanzOrt {
  /** Postleitzahl. */
  plz?: string | number;
  /** Ort, auch Einrichtungen wie „kh stockerau". */
  ort?: string;
  /**
   * Ortskennzahl oder Rasterzellen-ID (Seite 4): fünfstellig die OKZ der
   * Statistik Austria, siebenstellig Sonder-OKZ (Krankenhäuser etc.),
   * zehnstellig die Rasterzellen-ID `N####E####`.
   */
  okz?: string;
  /** Straße. */
  str?: string;
  /** Hausnummer. */
  hnr?: string;
}

/** Ein Ort der Antwort bei eindeutiger Zuordnung (Seite 8). */
export interface DistanzStation {
  okz: string;
  plz: string;
  ort: string;
  str: string;
  hnr: string;
  /** Rasterzellen-ID. */
  id: string;
  /**
   * Teilstrecke in Metern bis zu diesem Ort. Im Beispiel der Dokumentation
   * (Seiten 5–6) ergeben die Werte der Orte zusammen die Gesamtdistanz
   * (28,7 + 93,4 + 68,1 = 190,2 km) — es ist also die Strecke ab dem
   * vorangehenden Ort; der erste Ort trägt 0.
   */
  meter: number;
  /** Auslandsanteil der Teilstrecke in Metern. */
  meterAusland: number;
}

/** Ein Treffer der Adresssuche bei mehrdeutiger Zuordnung (Seiten 8–9). */
export interface DistanzTreffer {
  plz: string;
  gemeinde: string;
  bezirk: string;
  bundesland: string;
  ort?: string;
  okz: string;
  /** Rasterzellen-ID, sofern geliefert. */
  id?: string;
  str: string;
  hnr: string;
  /** Übereinstimmung mit der Suche; 100 = 1:1 ident. */
  score: number;
}

/** Ergebnis der Adresssuche zu einem angefragten Ort. */
export interface DistanzSuche {
  /** Die ursprüngliche Abfrage, wie der Server sie zurückgibt. */
  abfrage: Readonly<Record<string, string>>;
  anzahl: number;
  /** `geo_state`, Status der Geocodierung. */
  status: number;
  /** Verortungsnachricht, z. B. „Verortung:Hausnummern genau". */
  meldung: string;
  treffer: DistanzTreffer[];
}

interface ErgebnisBasis {
  /** `notes`: Hinweis des Betreibers, etwa zur Wartung; leer = kein Hinweis. */
  hinweis: string;
  /** `version`: Applikation und Datenstand. */
  version: string;
}

/** Antwort des Distanzanzeigers. Über `art` verengbar. */
export type DistanzErgebnis =
  | (ErgebnisBasis & {
      /** Alle Orte waren eindeutig — die Distanz liegt vor. */
      art: 'distanz';
      stationen: DistanzStation[];
      /** `total`: Gesamtdistanz von Start bis Ziel in Metern. */
      meter: number;
      /** Gesamtdistanz in ganzen Kilometern nach § 9 Abs. 5 Gesamtvertrag. */
      kilometer: number;
    })
  | (ErgebnisBasis & {
      /**
       * Mindestens ein Ort war nicht eindeutig; es gibt keine Distanz. Je
       * angefragtem Ort stehen die gefundenen Adressen zur Auswahl. Eine neue
       * Anfrage mit der gewählten Adresse (am sichersten über `okz`) ist Sache
       * des Aufrufers — der Client wählt nicht selbst.
       */
      art: 'mehrdeutig';
      suchen: DistanzSuche[];
    });

/** Konfiguration des Clients. */
export interface DistanzanzeigerConfig {
  /**
   * Adresse der Schnittstelle. Die Dokumentation nennt keinen Test-Endpunkt
   * und für den Echtbetrieb eine andere Adresse als die Zugangsmitteilung der
   * ÖGK; deshalb gibt es keine Voreinstellung, sondern
   * {@link DISTANZANZEIGER_ENDPUNKTE}.
   */
  endpunkt: string;
  /** API-Key. Erscheint in keiner Fehlermeldung. */
  apiKey: string;
  /**
   * Mindestabstand zwischen zwei Anfragen in Millisekunden, Voreinstellung
   * {@link MINDESTABSTAND_MS}. Die Dokumentation nennt kein Limit; der Wert ist
   * eine Vorsichtsmaßnahme dieses Clients.
   */
  mindestabstandMs?: number;
  /** Zeitlimit je Anfrage in Millisekunden, Voreinstellung 20000. */
  zeitlimitMs?: number;
  /** Ersatz für das globale `fetch`, für Tests. */
  fetch?: typeof fetch;
}

/** Der Client. */
export interface Distanzanzeiger {
  /**
   * Fragt die Distanz über mindestens zwei Standorte ab („Mindestens zwei
   * Standorte sind notwendig, dazwischen können beliebig viele Zwischenstopps
   * mitgegeben werden", Seite 3). Genau eine Anfrage an den Server; bei einem
   * Fehler wird nicht wiederholt.
   *
   * @throws EldaError bei ungültiger Eingabe, verweigertem Zugriff, Zeitlimit
   * oder Netzwerkfehler.
   * @throws EldaProtocolError wenn die Antwort nicht der Dokumentation entspricht.
   */
  abfragen(orte: readonly DistanzOrt[]): Promise<DistanzErgebnis>;
}

/**
 * Adressen der Schnittstelle. Echtbetrieb und Test laut Zugangsmitteilung der
 * ÖGK; der Test-Endpunkt antwortet ohne Key mit `{"success":false,"message":"no
 * access"}` (geprüft am 11.11.2026). Die Dokumentation (Seite 3) druckt für den
 * Echtbetrieb `https://distanzanzeiger.gesundheitskasse.at/api/v1`.
 */
export const DISTANZANZEIGER_ENDPUNKTE = {
  produktion: 'https://distanzanzeiger.sozialversicherung.at/api/v1/index.php',
  test: 'https://test.distanzanzeiger.sozialversicherung.at/api/v1/index.php',
} as const;

/** Voreingestellter Mindestabstand zwischen zwei Anfragen. */
export const MINDESTABSTAND_MS = 1000;

const ZEITLIMIT_MS = 20_000;

/**
 * Entfernung in ganzen Kilometern nach dem Gesamtvertrag über die
 * Krankenbeförderung mit Taxis, § 9 Abs. 5: „Sie ist in ganzen Kilometern zu
 * berechnen, wobei bis 499 m abzurunden und darüber aufzurunden ist. Als
 * Grundlage für die Ermittlung der Transportkilometer sind die
 * Kilometrierungspunkte nach dem Distanzanzeiger der österreichischen
 * Sozialversicherung … heranzuziehen."
 */
export function ganzeKilometer(meter: number): number {
  if (!Number.isSafeInteger(meter) || meter < 0) {
    throw new EldaError('Distanzanzeiger: Meter müssen eine nicht negative ganze Zahl sein.');
  }
  return Math.floor((meter + 500) / 1000);
}

/** Kilometerwert der Antwort (Typ „double", Seite 8) in ganze Meter. */
function inMeter(wert: unknown, feld: string, roh: unknown): number {
  if (typeof wert !== 'number' || !Number.isFinite(wert) || wert < 0) {
    throw new EldaProtocolError(`Distanzanzeiger: ${feld} ist keine nicht negative Zahl.`, roh);
  }
  return Math.round(wert * 1000);
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert : typeof wert === 'number' ? String(wert) : '';
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

/** Anfragekörper: je Ort alle fünf Felder, leere als `""` — wie im Beispiel der Dokumentation (Seite 3). */
function anfrage(orte: readonly DistanzOrt[]): Record<string, string>[] {
  if (orte.length < 2) {
    throw new EldaError('Distanzanzeiger: Mindestens zwei Standorte sind notwendig.');
  }
  return orte.map((o, i) => {
    const zeile = {
      plz: text(o.plz).trim(),
      ort: (o.ort ?? '').trim(),
      okz: (o.okz ?? '').trim(),
      str: (o.str ?? '').trim(),
      hnr: (o.hnr ?? '').trim(),
    };
    if (zeile.plz === '' && zeile.ort === '' && zeile.okz === '') {
      throw new EldaError(`Distanzanzeiger: Standort ${i + 1} braucht Postleitzahl, Ort oder Ortskennzahl.`);
    }
    return zeile;
  });
}

function liesAntwort(roh: unknown): DistanzErgebnis {
  if (!istObjekt(roh)) throw new EldaProtocolError('Distanzanzeiger: Antwort ist kein JSON-Objekt.', roh);
  if (roh['success'] !== true) {
    // Seite 6: ohne gültigen Key `{"success":false,"message":"no access"}`.
    const meldung = text(roh['message']);
    throw new EldaError(
      meldung === 'no access'
        ? 'Distanzanzeiger: Zugriff verweigert („no access") — API-Key fehlt, ist falsch oder gesperrt.'
        : `Distanzanzeiger: Anfrage nicht erfolgreich${meldung === '' ? '' : ` („${meldung}")`}.`,
    );
  }
  const basis = { hinweis: text(roh['notes']), version: text(roh['version']) };
  const data = roh['data'];
  if (!istObjekt(data)) throw new EldaProtocolError('Distanzanzeiger: Antwort ohne `data`.', roh);

  const distance = data['distance'];
  if (istObjekt(distance)) {
    const orte = distance['ort'];
    if (!Array.isArray(orte) || orte.length < 2) {
      throw new EldaProtocolError(
        'Distanzanzeiger: `data.distance.ort` fehlt oder hat weniger als zwei Orte.',
        roh,
      );
    }
    const stationen = orte.map((o, i): DistanzStation => {
      if (!istObjekt(o)) throw new EldaProtocolError(`Distanzanzeiger: Ort ${i + 1} ist kein Objekt.`, roh);
      return {
        okz: text(o['okz']),
        plz: text(o['plz']),
        ort: text(o['ort']),
        str: text(o['str']),
        hnr: text(o['hnr']),
        id: text(o['id']),
        meter: inMeter(o['distance'], `distance des Ortes ${i + 1}`, roh),
        meterAusland: inMeter(o['distance_ausland'], `distance_ausland des Ortes ${i + 1}`, roh),
      };
    });
    const meter = inMeter(data['total'], 'total', roh);
    return { ...basis, art: 'distanz', stationen, meter, kilometer: ganzeKilometer(meter) };
  }

  const geomarketing = data['geomarketing'];
  if (Array.isArray(geomarketing)) {
    const suchen = geomarketing.map((g, i): DistanzSuche => {
      const geocoder = istObjekt(g) ? g['geocoder'] : undefined;
      if (!istObjekt(geocoder)) {
        throw new EldaProtocolError(
          `Distanzanzeiger: Eintrag ${i + 1} in \`geomarketing\` ohne \`geocoder\`.`,
          roh,
        );
      }
      const query = istObjekt(geocoder['query']) ? geocoder['query'] : {};
      const found = Array.isArray(geocoder['found']) ? geocoder['found'] : [];
      return {
        abfrage: Object.fromEntries(Object.entries(query).map(([k, w]) => [k, text(w)])),
        anzahl: typeof geocoder['count'] === 'number' ? geocoder['count'] : found.length,
        status: typeof geocoder['geo_state'] === 'number' ? geocoder['geo_state'] : 0,
        meldung: text(geocoder['message']),
        treffer: found.filter(istObjekt).map((f): DistanzTreffer => {
          const treffer: DistanzTreffer = {
            plz: text(f['zip']),
            gemeinde: text(f['gem']),
            bezirk: text(f['district']),
            bundesland: text(f['state']),
            okz: text(f['okz']),
            str: text(f['str']),
            // Das Beispiel liefert die Hausnummer mit nachgestelltem Leerzeichen („79 ").
            hnr: text(f['hnr']).trim(),
            score: typeof f['score'] === 'number' ? f['score'] : 0,
          };
          if (text(f['ort']) !== '') treffer.ort = text(f['ort']);
          if (text(f['id']) !== '') treffer.id = text(f['id']);
          return treffer;
        }),
      };
    });
    return { ...basis, art: 'mehrdeutig', suchen };
  }
  throw new EldaProtocolError('Distanzanzeiger: `data` enthält weder `distance` noch `geomarketing`.', roh);
}

/** Baut den Client. Prüft die Konfiguration sofort. */
export function createDistanzanzeiger(config: DistanzanzeigerConfig): Distanzanzeiger {
  if (!/^https:\/\//.test(config.endpunkt)) {
    throw new EldaError('Distanzanzeiger: Der Endpunkt muss mit https:// beginnen.');
  }
  if (config.apiKey.trim() === '') throw new EldaError('Distanzanzeiger: API-Key fehlt.');
  const abstand = config.mindestabstandMs ?? MINDESTABSTAND_MS;
  const zeitlimit = config.zeitlimitMs ?? ZEITLIMIT_MS;
  if (!Number.isSafeInteger(abstand) || abstand < 0 || !Number.isSafeInteger(zeitlimit) || zeitlimit < 1) {
    throw new EldaError('Distanzanzeiger: Mindestabstand und Zeitlimit müssen ganze Millisekunden sein.');
  }
  const holen = config.fetch ?? fetch;

  // Anfragen laufen streng nacheinander; zwischen dem Ende der einen und dem
  // Beginn der nächsten liegt der Mindestabstand.
  let schlange: Promise<unknown> = Promise.resolve();
  let letztesEnde = 0;

  async function eineAnfrage(koerper: string): Promise<DistanzErgebnis> {
    const warten = letztesEnde + abstand - Date.now();
    if (letztesEnde > 0 && warten > 0) await new Promise((r) => setTimeout(r, warten));
    try {
      let antwort: Response;
      try {
        antwort = await holen(config.endpunkt, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: koerper,
          signal: AbortSignal.timeout(zeitlimit),
        });
      } catch (ursache) {
        const zeit = ursache instanceof Error && ursache.name === 'TimeoutError';
        throw new EldaError(
          zeit
            ? `Distanzanzeiger: keine Antwort innerhalb von ${zeitlimit} ms.`
            : 'Distanzanzeiger: Der Server war nicht erreichbar.',
          { cause: ursache },
        );
      }
      const rohtext = await antwort.text();
      let roh: unknown;
      try {
        roh = JSON.parse(rohtext);
      } catch {
        throw new EldaProtocolError(
          `Distanzanzeiger: Antwort (HTTP ${antwort.status}) ist kein JSON.`,
          rohtext.slice(0, 2000),
        );
      }
      // Die Dokumentation zeigt auch die Ablehnung mit „Statuscode: 200 OK"; der
      // Testserver antwortet darauf mit 401. Maßgeblich ist deshalb der Körper.
      if (!antwort.ok && !(istObjekt(roh) && roh['success'] === false)) {
        throw new EldaProtocolError(`Distanzanzeiger: HTTP ${antwort.status}.`, roh);
      }
      return liesAntwort(roh);
    } finally {
      letztesEnde = Date.now();
    }
  }

  return {
    abfragen(orte): Promise<DistanzErgebnis> {
      let koerper: string;
      try {
        koerper = JSON.stringify(anfrage(orte));
      } catch (e) {
        return Promise.reject(e);
      }
      const ergebnis = schlange.then(() => eineAnfrage(koerper));
      schlange = ergebnis.catch(() => undefined);
      return ergebnis;
    },
  };
}
