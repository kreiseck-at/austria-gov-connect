import { escapeXmlText } from '@kreiseck/finanzonline-core';
import { EldaError } from './errors';

/**
 * Ersetzt jedes Vorkommen der übergebenen Geheimnisse durch einen benannten
 * Platzhalter — gedacht für Mitschnitte des HTTP-Austauschs, die in ein Ticket
 * oder ein Log wandern.
 *
 * Bewusst **wertbasiert** und nicht elementbasiert: Ein Ausdruck wie
 * `<apiKey>…</apiKey>` trifft nur die eine Stelle, an der der Envelope das
 * Geheimnis heute schreibt. Ein SOAP-Fault, der die Anfrage in seinem
 * `<detail>` zitiert (JAX-WS tut das bei Validierungsfehlern regelmäßig), ein
 * Namensraum-Präfix oder ein umgestellter Envelope-Bau würden stillschweigend
 * daran vorbeigehen. Gesucht wird deshalb der Wert selbst, zusätzlich in seiner
 * XML-escapten Form.
 *
 * **Fail closed:** Steht ein Geheimnis nach der Ersetzung noch im Text, wirft
 * diese Funktion, statt einen scheinbar geschwärzten Text zurückzugeben. Der
 * Aufrufer schreibt dann keine Datei — eine fehlende Diagnosedatei ist zu
 * verschmerzen, ein Zugangsdatum auf der Platte nicht.
 *
 * Zu kurze Werte sind nicht sinnvoll zu schwärzen: Sie kommen als Teilfolge
 * überall vor und die Ersetzung zerstört den Text. Das ist hier kein Sonderfall
 * — Seriennummer, API-Key und SHA-512-Digest sind lang —, aber es erklärt, warum
 * eine Ersetzung mehr treffen kann als gemeint: Enthält etwa eine
 * Protokollnummer die Seriennummer als Teilfolge, wird sie mitgeschwärzt. Der
 * Platzhalter macht genau das sichtbar.
 *
 * @param text zu schwärzender Text
 * @param geheimnisse Name → Wert; Name geht in den Platzhalter ein, leere und
 * fehlende Werte werden übersprungen
 */
export function redigiereGeheimnisse(
  text: string,
  geheimnisse: Readonly<Record<string, string | undefined>>,
): string {
  const formen = (wert: string): string[] => [...new Set([wert, escapeXmlText(wert)])];

  let out = text;
  for (const [name, wert] of Object.entries(geheimnisse)) {
    if (!wert) continue;
    for (const form of formen(wert)) {
      out = out.split(form).join(`***${name}***`);
    }
  }

  for (const [name, wert] of Object.entries(geheimnisse)) {
    if (!wert) continue;
    if (formen(wert).some((form) => out.includes(form))) {
      throw new EldaError(
        `Schwärzung fehlgeschlagen: '${name}' steht nach der Ersetzung weiterhin im Text. ` +
          'Es wird nichts geschrieben — ein Mitschnitt mit Zugangsdaten wäre schlimmer als gar keiner.',
      );
    }
  }
  return out;
}
