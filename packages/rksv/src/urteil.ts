/**
 * Vorgangsbezogenes Urteil über eine FinanzOnline-Antwort.
 *
 * `Ergebnis.ok` beantwortet „hat der Aufruf funktioniert" — es ist schlicht
 * `rc === '0'`. Die Frage, die jeder Aufrufer tatsächlich hat, lautet aber:
 * **ist der Zustand, den ich wollte, jetzt hergestellt?** Diese beiden Fragen
 * fallen bei FinanzOnline regelmäßig auseinander, und zwar **vorgangsabhängig**:
 *
 * - `B6` („Außerbetriebnahme bereits erfolgt") heißt bei einer
 *   Außerbetriebnahme *Ziel erreicht*, bei einer Wiederinbetriebnahme *Ablehnung*.
 * - `B13` („Status bereits gesetzt") heißt umgekehrt.
 * - `B1`/`B10` („bereits registriert" / „bereits gespeichert") heißen bei einer
 *   Registrierung, dass die Einheit dem Dienst **bekannt** ist — aber nicht, in
 *   welchem Zustand.
 *
 * Deshalb drei Ausgänge statt zwei: Ziel erreicht, Zustand unklar, abgelehnt.
 *
 * Der mittlere ist der wichtigste. `B10` als Erfolg zu werten war der teuerste
 * Fehler dieser Reihe: eine beim Finanzamt abgemeldete Signatureinheit galt
 * danach lokal wieder als registriert. Als schlichte Ablehnung wäre es ebenso
 * falsch — die Einheit existiert ja. `statusUnklar` zwingt den Aufrufer, den
 * Zustand zu klären, statt ihn zu vermuten.
 *
 * **Was `statusUnklar` nicht verspricht:** dass eine Statusabfrage die Sache
 * löst. Am 31.07.2026 am echten Dienst nachgemessen — `status_signature`
 * antwortet nur für Einheiten **in Betrieb** (`rc 0` mit `status` und
 * `ts_registrierung`); für eine abgemeldete kommt `B33` ohne Status und ohne
 * Datum. „Nie registriert" und „bereits abgemeldet" sind über das Webservice
 * also nicht zu unterscheiden; das steht nur im FinanzOnline-Portal.
 * `statusUnklar` heißt deshalb genau: *dieser Aufruf kann es nicht entscheiden,
 * und ein weiterer möglicherweise auch nicht* — der Fall gehört an einen
 * Menschen, nicht in eine Heuristik.
 */
import { istWiederholbar } from './returncodes';
import type { Vorgang } from './vorgaenge';

/**
 * Die Vorgangsklasse, nach der ein Returncode auszulegen ist.
 *
 * Bewusst gröber als {@link Vorgang}: ob Registrierkasse oder
 * Signaturerstellungseinheit gemeldet wurde, ändert an der Auslegung nichts
 * (`B1` ist der Kassen-, `B10` der SEE-Zwilling desselben Sachverhalts). Die
 * Außerbetriebnahme ist dagegen eine eigene Klasse, obwohl sie im Request im
 * `ausfall_*`-Vorgang steckt — bei ihr bedeuten `B6` und `B13` das Gegenteil
 * dessen, was sie beim Ausfall bedeuten.
 */
export type VorgangKlasse =
  | 'registrierung'
  | 'ausfall'
  | 'ausserbetriebnahme'
  | 'wiederinbetriebnahme';

/** Das Nötigste aus einem {@link import('./antwort').Ergebnis} — ein `Ergebnis` passt unverändert. */
export interface UrteilEingabe {
  rc: string;
  msg?: string;
}

export interface VorgangUrteil {
  /** Liegt der gewünschte Zustand jetzt vor? */
  zielerreicht: boolean;
  /** Er lag schon vorher vor — dieser Aufruf hat nichts bewirkt. */
  bereitsSo: boolean;
  /**
   * Die Einheit ist dem Dienst bekannt, ihr Zustand aus dieser Antwort aber
   * nicht ableitbar. Nicht als Erfolg und nicht als Ablehnung behandeln.
   */
  statusUnklar: boolean;
  /** Ob derselbe Aufruf unverändert später gelingen kann (siehe `istWiederholbar`). */
  wiederholbar: boolean;
  rc: string;
  msg: string;
}

/**
 * Die Klasse zu einem konkreten Vorgang — damit niemand sie danebengreifen
 * kann. `null` für die Belegprüfung: sie liefert Daten, kein Ziel.
 */
export function vorgangKlasse(v: Vorgang): VorgangKlasse | null {
  switch (v.art) {
    case 'registrierung_kasse':
    case 'registrierung_se':
      return 'registrierung';
    case 'ausfall_kasse':
    case 'ausfall_se':
      // Beide Meldungen teilen sich denselben Vorgang; erst der gesetzte Block
      // sagt, was gemeldet wurde.
      return v.ausserbetriebnahme !== undefined ? 'ausserbetriebnahme' : 'ausfall';
    case 'wiederinbetriebnahme_kasse':
    case 'wiederinbetriebnahme_se':
      return 'wiederinbetriebnahme';
    case 'belegpruefung':
      return null;
  }
}

/**
 * Das Urteil zu einer Antwort. Unbekannte Returncodes gelten als Ablehnung —
 * bewusst konservativ: lieber eine Ablehnung zu viel als ein erfundener Erfolg.
 */
export function vorgangErgebnis(klasse: VorgangKlasse, erg: UrteilEingabe): VorgangUrteil {
  const rc = erg.rc ?? '';
  const rest = { wiederholbar: istWiederholbar(rc), rc, msg: erg.msg ?? '' };

  if (rc === '0') return { zielerreicht: true, bereitsSo: false, statusUnklar: false, ...rest };

  // „Der angegebene Status ist bereits gesetzt" — das Ziel liegt vor, dieser
  // Aufruf hat es nur nicht bewirkt. Bei einer Außerbetriebnahme kann der Code
  // nicht sinnvoll auftreten, dort bleibt es bei der Ablehnung.
  if (rc === 'B13' && (klasse === 'ausfall' || klasse === 'wiederinbetriebnahme'))
    return { zielerreicht: true, bereitsSo: true, statusUnklar: false, ...rest };

  // „Außerbetriebnahme bereits erfolgt — keine Änderung mehr möglich": für die
  // Außerbetriebnahme selbst das Ziel, für jede andere Meldung eine Absage.
  if (rc === 'B6' && klasse === 'ausserbetriebnahme')
    return { zielerreicht: true, bereitsSo: true, statusUnklar: false, ...rest };

  if ((rc === 'B1' || rc === 'B10') && klasse === 'registrierung')
    return { zielerreicht: false, bereitsSo: false, statusUnklar: true, ...rest };

  // Bewusst NICHT hier: B32/B33 („nicht registriert ODER bereits außer
  // Betrieb"). Mehrdeutig formuliert und nachweislich nicht auflösbar — sie
  // bleiben Ablehnung.
  return { zielerreicht: false, bereitsSo: false, statusUnklar: false, ...rest };
}
