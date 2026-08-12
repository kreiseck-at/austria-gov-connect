// Reine SHA-256 nach FIPS 180-4 -- ohne node:crypto, ohne Web Crypto.
//
// Warum von Hand: `crypto.subtle.digest` gibt es zwar in beiden Welten, ist
// aber ausschliesslich asynchron. Damit bekaeme `verkettungswert` im Browser
// eine andere Signatur als in Node, und wir haetten wieder zwei Fassungen des
// Kerns -- genau das, was dieses Paket vermeiden soll. Eine synchrone,
// abhaengigkeitsfreie Umsetzung ist in beiden Welten dieselbe Funktion.
//
// Herkunft: uebernommen aus dem Pruefportal (kasseneck-web,
// hosting/check-public/pruefen.js, Funktionen neuerZustand/komprimiere/
// nimmAuf/schliesseAb). Dort ist sie mit 8946 differenziellen Vergleichen
// gegen node:crypto belegt: alle Laengen 0 bis 300 ueber fuenfzehn
// Blockgroessen, die Raender der Auffuellung nach FIPS 180-4, die
// 8-MiB-Blockgrenze, Daten um 2^32 Bit herum und Digests mit fuehrender Null --
// null Abweichungen.
//
// Nicht "aufraeumen": Rotationsweiten, Konstanten, die Reihenfolge der
// Rundenvariablen und die 64-Bit-Laengenkodierung sind Teil des Verfahrens.
// Jede Aenderung daran bricht die RKSV-Verkettungspruefung. Die Tests in
// sha256.test.ts vergleichen gegen node:crypto und fallen bei einer
// veraenderten Rotationsweite.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Laufender Hash-Zustand: Zwischenwerte, Rundenplan und der angebrochene Block. */
interface Zustand {
  h: Uint32Array;
  w: Uint32Array;
  rest: Uint8Array;
  imRest: number;
  bytes: number;
}

function neuerZustand(): Zustand {
  return {
    h: new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ]),
    w: new Uint32Array(64),
    rest: new Uint8Array(64),
    imRest: 0,
    bytes: 0,
  };
}

/**
 * Verarbeitet genau einen 64-Byte-Block ab `offset`. Die Indexzugriffe sind
 * durch die festen Feldlaengen (64 Byte Block, 64 Rundenwoerter, 8 Zwischen-
 * werte) gedeckt, darum `!` statt eines Ersatzwerts -- ein Ersatzwert wuerde
 * einen echten Indexfehler in ein falsches Ergebnis verwandeln.
 */
function komprimiere(z: Zustand, daten: Uint8Array, offset: number): void {
  const w = z.w;
  for (let i = 0; i < 16; i += 1) {
    const p = offset + i * 4;
    w[i] = (daten[p]! << 24) | (daten[p + 1]! << 16) | (daten[p + 2]! << 8) | daten[p + 3]!;
  }
  for (let i = 16; i < 64; i += 1) {
    const x = w[i - 15]!;
    const y = w[i - 2]!;
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
  }

  let a = z.h[0]!;
  let b = z.h[1]!;
  let c = z.h[2]!;
  let d = z.h[3]!;
  let e = z.h[4]!;
  let f = z.h[5]!;
  let g = z.h[6]!;
  let h = z.h[7]!;

  for (let i = 0; i < 64; i += 1) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + s1 + ch + K[i]! + w[i]!) | 0;
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (s0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }

  z.h[0] = (z.h[0]! + a) | 0;
  z.h[1] = (z.h[1]! + b) | 0;
  z.h[2] = (z.h[2]! + c) | 0;
  z.h[3] = (z.h[3]! + d) | 0;
  z.h[4] = (z.h[4]! + e) | 0;
  z.h[5] = (z.h[5]! + f) | 0;
  z.h[6] = (z.h[6]! + g) | 0;
  z.h[7] = (z.h[7]! + h) | 0;
}

/** Nimmt beliebig viele Bytes auf und haelt den angebrochenen Block zurueck. */
function nimmAuf(z: Zustand, daten: Uint8Array): void {
  z.bytes += daten.length;
  let i = 0;

  if (z.imRest > 0) {
    const fehlt = Math.min(64 - z.imRest, daten.length);
    z.rest.set(daten.subarray(0, fehlt), z.imRest);
    z.imRest += fehlt;
    i = fehlt;
    if (z.imRest === 64) {
      komprimiere(z, z.rest, 0);
      z.imRest = 0;
    }
  }

  for (; i + 64 <= daten.length; i += 64) komprimiere(z, daten, i);

  if (i < daten.length) {
    z.rest.set(daten.subarray(i), 0);
    z.imRest = daten.length - i;
  }
}

/**
 * Haengt die Auffuellung nach FIPS 180-4 an und liefert die 32 Byte des
 * Digests. Die Bitlaenge ist ein 64-Bit-Wert: das hohe Wort ueber
 * `Math.floor(bits / 4294967296)`, das niedrige ueber `bits >>> 0` -- ein
 * naiver 32-Bit-Zaehler laeuft jenseits von 512 MB ueber.
 */
function schliesseAb(z: Zustand): Uint8Array {
  const bits = z.bytes * 8;
  const laenge = z.imRest < 56 ? 64 : 128;
  const block = new Uint8Array(laenge);
  block.set(z.rest.subarray(0, z.imRest), 0);
  block[z.imRest] = 0x80;
  const sicht = new DataView(block.buffer);
  sicht.setUint32(laenge - 8, Math.floor(bits / 4294967296));
  sicht.setUint32(laenge - 4, bits >>> 0);
  for (let o = 0; o < laenge; o += 64) komprimiere(z, block, o);

  const aus = new Uint8Array(32);
  const ausSicht = new DataView(aus.buffer);
  for (let i = 0; i < 8; i += 1) ausSicht.setUint32(i * 4, z.h[i]! >>> 0);
  return aus;
}

/** SHA-256 nach FIPS 180-4: liefert die 32 Byte des Digests. */
export function sha256(daten: Uint8Array): Uint8Array {
  const z = neuerZustand();
  nimmAuf(z, daten);
  return schliesseAb(z);
}
