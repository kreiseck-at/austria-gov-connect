import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verschiebeFristendeNachBao, verschiebeFristendeNachAvg } from './fristen';
import { FeiertageEingabeError } from './datum';

// Kernpunkt des Pakets, zweite Hälfte: Der Karfreitag ist zwar kein ARG-Feiertag
// (siehe feiertage.test.ts), verschiebt aber sehr wohl eine Frist — für beide
// Rechtsgrundlagen, da § 108 Abs 3 BAO und § 33 Abs 2 AVG ihn wortgleich nennen.
test('der Karfreitag verschiebt eine Frist nach BAO und AVG', () => {
  // Karfreitag 2026 = 3.4. (Freitag) -> 4.4. (Sa) -> 5.4. (So, zugleich Ostersonntag)
  // -> 6.4. (Ostermontag, selbst ARG-Feiertag) -> 7.4. (Di) ist der erste freie Tag.
  assert.equal(verschiebeFristendeNachBao('2026-04-03'), '2026-04-07');
  assert.equal(verschiebeFristendeNachAvg('2026-04-03'), '2026-04-07');
});

test('der 24. Dezember verschiebt eine Frist', () => {
  // 24.12.2026 ist ein Donnerstag, aber eigens als fristenhemmender Tag genannt.
  assert.notEqual(verschiebeFristendeNachBao('2026-12-24'), '2026-12-24');
});

test('Gegenprobe: der 31. Dezember verschiebt nicht', () => {
  // 31.12.2026 ist ein Donnerstag und kein Feiertag, kein Karfreitag, kein 24.12.
  assert.equal(verschiebeFristendeNachBao('2026-12-31'), '2026-12-31');
  assert.equal(verschiebeFristendeNachAvg('2026-12-31'), '2026-12-31');
});

test('Fristende auf einen Samstag verschiebt auf den nächsten Werktag', () => {
  // 7.3.2026 ist ein Samstag, 8.3. ein Sonntag, 9.3. der nächste Montag.
  assert.equal(verschiebeFristendeNachBao('2026-03-07'), '2026-03-09');
});

test('Fristende auf einen Sonntag verschiebt auf den nächsten Werktag', () => {
  assert.equal(verschiebeFristendeNachBao('2026-03-08'), '2026-03-09');
});

test('Fristende auf einen unter der Woche liegenden Feiertag verschiebt', () => {
  // 26.10.2026 (Nationalfeiertag) ist ein Montag; 27.10. ist frei.
  assert.equal(verschiebeFristendeNachBao('2026-10-26'), '2026-10-27');
});

// Kette: Fällt das Ende auf den 24.12., muss über Weihnachten (25.) und Stephanstag (26.)
// hinweg geschoben werden. 2026 fällt der 24.12. auf einen Donnerstag, sodass die Kette
// zusätzlich noch das anschließende Wochenende mitnimmt.
test('Kette ab 24.12.: schiebt über Weihnachten, Stephanstag und das Wochenende', () => {
  // 24. (Do, 24.12.) -> 25. (Fr, Weihnachten) -> 26. (Sa, Stephanstag+Wochenende)
  // -> 27. (So, Wochenende) -> 28. (Mo, frei)
  assert.equal(verschiebeFristendeNachBao('2026-12-24'), '2026-12-28');
});

// Maximale Kettenlänge: Fällt der 24.12. auf einen Mittwoch, hängt sich das Wochenende
// unmittelbar an Stephanstag an, und die Kette wird am längsten. Von Hand nachgerechnet:
// 24. (Mi, 24.12.) -> 25. (Do, Weihnachten) -> 26. (Fr, Stephanstag) -> 27. (Sa, Wochenende)
// -> 28. (So, Wochenende) -> 29. (Mo, frei). Das ist zugleich der Beweis, dass eine Kette,
// die an einem 24.12. beginnt, den Jahreswechsel nie erreicht: Nach den drei fix
// aufeinanderfolgenden Tagen 24./25./26. folgt bis Silvester kein weiterer Feiertag, und
// ein Wochenende kann höchstens zwei weitere Tage anhängen — macht spätestens den 29.12.
test('Kette ab 24.12. (2025): längstmögliche Verschiebung bleibt im Dezember', () => {
  assert.equal(verschiebeFristendeNachBao('2025-12-24'), '2025-12-29');
});

// Der 15. August ist der einzige Feiertag, der auf einen Fünfzehnten fällt, und trifft
// damit regelmäßig die Fälligkeit von Lohnabgaben. 2026 fällt er auf einen Samstag,
// 2028 auf einen Dienstag — beide Wochenlagen sind eigens zu prüfen.
test('15. August 2026 (Samstag): verschiebt über den Sonntag hinweg', () => {
  assert.equal(verschiebeFristendeNachBao('2026-08-15'), '2026-08-17');
});

test('15. August 2028 (Dienstag): verschiebt dennoch, weil selbst Feiertag', () => {
  assert.equal(verschiebeFristendeNachBao('2028-08-15'), '2028-08-16');
});

test('ungültiges Datum wirft', () => {
  assert.throws(() => verschiebeFristendeNachBao('2026-13-01'), FeiertageEingabeError);
  assert.throws(() => verschiebeFristendeNachAvg('31.02.2026'), FeiertageEingabeError);
});
