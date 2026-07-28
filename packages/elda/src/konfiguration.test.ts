import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loeseEndpoint } from './konfiguration';
import { ELDA_ENDPOINTS } from './endpoints';
import { EldaError } from './errors';

const zugang = { seriennummer: 'S1', kundenpasswort: 'p', apiKey: 'K1' };

test('umgebung bestimmt den Endpoint', () => {
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'produktion' }), ELDA_ENDPOINTS.produktion);
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'kundentest' }), ELDA_ENDPOINTS.kundentest);
  assert.equal(loeseEndpoint({ ...zugang, umgebung: 'sit' }), ELDA_ENDPOINTS.sit);
});

test('expliziter endpoint hat Vorrang und macht umgebung entbehrlich', () => {
  assert.equal(loeseEndpoint({ ...zugang, endpoint: 'https://mock.test/svc' }), 'https://mock.test/svc');
  assert.equal(
    loeseEndpoint({ ...zugang, umgebung: 'produktion', endpoint: 'https://mock.test/svc' }),
    'https://mock.test/svc',
  );
});

test('fehlende umgebung wirft und nennt die gültigen Werte', () => {
  assert.throws(
    () => loeseEndpoint({ ...zugang } as never),
    (err: unknown) => {
      assert.ok(err instanceof EldaError);
      assert.match((err as Error).message, /umgebung/);
      assert.match((err as Error).message, /produktion/);
      assert.match((err as Error).message, /kundentest/);
      assert.match((err as Error).message, /sit/);
      return true;
    },
  );
});

test('unbekannte umgebung wirft (Aufruf aus JavaScript, kein Compiler)', () => {
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: 'Kundentest' } as never), EldaError);
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: '' } as never), EldaError);
});

test('leere oder fehlende Zugangsdaten werfen beim Bauen, nicht erst bei ELDA', () => {
  for (const feld of ['seriennummer', 'kundenpasswort', 'apiKey']) {
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: '', umgebung: 'kundentest' } as never),
      (err: unknown) => {
        assert.ok(err instanceof EldaError);
        assert.match((err as Error).message, new RegExp(feld));
        return true;
      },
      `leeres Feld muss werfen: ${feld}`,
    );
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: '   ', umgebung: 'kundentest' } as never),
      EldaError,
      `Feld nur aus Leerzeichen muss werfen: ${feld}`,
    );
    assert.throws(
      () => loeseEndpoint({ ...zugang, [feld]: undefined, umgebung: 'kundentest' } as never),
      EldaError,
      `fehlendes Feld muss werfen: ${feld}`,
    );
  }
});

test('leerer endpoint wirft statt still auf umgebung zurückzufallen', () => {
  assert.throws(() => loeseEndpoint({ ...zugang, umgebung: 'kundentest', endpoint: '' } as never), EldaError);
});
