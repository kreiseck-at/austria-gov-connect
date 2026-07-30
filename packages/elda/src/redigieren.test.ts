import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redigiereGeheimnisse } from './redigieren';
import { baueEldaEnvelope } from './envelope';
import { baueSecurity, hashKundenpasswort } from './security';
import { EldaError } from './errors';

const ZUGANG = { seriennummer: 'S1234567', apiKey: 'API-KEY-4711-XYZ', kundenpasswort: 'gehe1m!' };
const GEHEIMNISSE = {
  apiKey: ZUGANG.apiKey,
  kundenpasswortHash: hashKundenpasswort(ZUGANG.kundenpasswort),
  kundenpasswort: ZUGANG.kundenpasswort,
  seriennummer: ZUGANG.seriennummer,
};

/** Zitiert XML als Text — so, wie ein SOAP-Fault die Anfrage im `<detail>` führt. */
function alsZitat(xml: string): string {
  return xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Bindet die Schwärzung an den ECHTEN Envelope-Bau statt an eine nachgebaute
 * Zeichenkette: Ändert sich `baueEldaEnvelope` (Namensraum-Präfixe, Reihenfolge,
 * andere Feldnamen), muss die Schwärzung mitwandern — sonst schlägt dieser Test
 * fehl, statt dass unbemerkt Zugangsdaten auf die Platte gehen.
 */
function echterEnvelope(): string {
  return baueEldaEnvelope(
    'senden',
    baueSecurity(ZUGANG, { nonce: 'N1', created: '2026-07-30T07:00:00.000Z' }),
    [
      { name: 'dateiName', value: 'm.dat' },
      { name: 'payload', value: 'QUJD' },
    ],
  );
}

test('Schwärzung entfernt alle Geheimnisse aus einem echten Envelope', () => {
  const xml = echterEnvelope();
  // Vorbedingung: die Geheimnisse stehen wirklich drin, der Test prüft also etwas.
  for (const wert of [GEHEIMNISSE.apiKey, GEHEIMNISSE.kundenpasswortHash, GEHEIMNISSE.seriennummer]) {
    assert.ok(xml.includes(wert), `Vorbedingung: '${wert.slice(0, 12)}…' steht im Envelope`);
  }

  const sauber = redigiereGeheimnisse(xml, GEHEIMNISSE);
  for (const wert of Object.values(GEHEIMNISSE)) {
    assert.ok(!sauber.includes(wert), 'Geheimnis steht noch im Text');
  }
  assert.match(sauber, /<apiKey>\*\*\*apiKey\*\*\*<\/apiKey>/);
  assert.match(sauber, /<kundenpasswort>\*\*\*kundenpasswortHash\*\*\*<\/kundenpasswort>/);
  assert.match(sauber, /<seriennummer>\*\*\*seriennummer\*\*\*<\/seriennummer>/);
  // Alles Diagnostische bleibt erhalten — sonst wäre der Mitschnitt wertlos.
  assert.match(sauber, /<created>2026-07-30T07:00:00\.000Z<\/created>/);
  assert.match(sauber, /<nonce>N1<\/nonce>/);
  assert.match(sauber, /<dateiName>m\.dat<\/dateiName>/);
  assert.match(sauber, /<payload>QUJD<\/payload>/);
});

test('Schwärzung greift auch, wenn ein Fault die Anfrage in <detail> zitiert', () => {
  // JAX-WS zitiert bei Validierungsfehlern regelmäßig die Anfrage. Ein
  // elementweiser Ausdruck auf <apiKey> fände hier nichts, weil die spitzen
  // Klammern escapt sind — die Geheimnisse stünden trotzdem lesbar in der Datei.
  const fault =
    '<soap:Envelope><soap:Body><soap:Fault><faultstring>Validierung</faultstring><detail>' +
    alsZitat(echterEnvelope()) +
    '</detail></soap:Fault></soap:Body></soap:Envelope>';
  for (const wert of [GEHEIMNISSE.apiKey, GEHEIMNISSE.kundenpasswortHash, GEHEIMNISSE.seriennummer]) {
    assert.ok(fault.includes(wert), 'Vorbedingung: Geheimnis steht im zitierten Fault');
  }
  const sauber = redigiereGeheimnisse(fault, GEHEIMNISSE);
  for (const wert of Object.values(GEHEIMNISSE)) {
    assert.ok(!sauber.includes(wert), 'Geheimnis steht noch im Fault-Detail');
  }
  assert.match(sauber, /<faultstring>Validierung<\/faultstring>/);
});

test('Schwärzung findet ein Geheimnis auch in XML-escapter Form', () => {
  const apiKey = 'A&B<C>D';
  assert.equal(
    redigiereGeheimnisse(`<apiKey>${alsZitat(apiKey)}</apiKey>`, { apiKey }),
    '<apiKey>***apiKey***</apiKey>',
  );
});

test('Schwärzung übergeht leere und fehlende Werte, statt alles zu ersetzen', () => {
  const text = '<a>x</a>';
  assert.equal(redigiereGeheimnisse(text, { apiKey: '', kundenpasswortHash: undefined }), text);
});

test('Schwärzung wirft, statt einen scheinbar geschwärzten Text zu liefern', () => {
  // Ein Wert, der durch die Ersetzung selbst wieder entsteht: '*x' im Text '*xx'
  // wird zu '***apiKey***x' — und darin steht '*x' erneut. Fail closed: werfen,
  // damit der Aufrufer nichts schreibt.
  assert.throws(
    () => redigiereGeheimnisse('*xx', { apiKey: '*x' }),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /Schwärzung fehlgeschlagen/);
      return true;
    },
  );
});
