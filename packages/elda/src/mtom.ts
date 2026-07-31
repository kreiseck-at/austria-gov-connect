/**
 * MTOM/XOP — das Antwortformat des ELDA-Transfer-Webservice v4.
 *
 * ELDA (Apache CXF) antwortet **immer** als `multipart/related` mit
 * `type="application/xop+xml"`, auch auf Fehler und auch dann, wenn gar keine
 * Binärdaten anfallen. Der eigentliche SOAP-Envelope steckt im Wurzelteil, den
 * der `start`-Parameter des Content-Type benennt; Binärinhalte liegen als
 * eigene Teile daneben und werden im Envelope über `<xop:Include href="cid:…">`
 * referenziert.
 *
 * Wird der Körper ungeöffnet an einen XML-Parser gegeben, sieht dieser die
 * `--uuid:…`-Grenzzeilen und bricht ab. Genau das ist beim ersten Live-Aufruf
 * passiert — mit der Meldung „Unterminated element(s) in XML", und zwar auch
 * bei einer inhaltlich völlig korrekten Antwort.
 *
 * Belegt gegen den echten Dienst am 31.07.2026 (`online-test.elda.at`):
 *
 *     content-type: multipart/related; type="application/xop+xml";
 *                   boundary="uuid:ca65b474-…"; start="<root.message@cxf.apache.org>";
 *                   start-info="text/xml"
 */

/** Ergebnis des Auspackens: der Wurzelteil und die übrigen Teile nach Content-ID. */
export interface MtomAntwort {
  /** Rohbytes des Wurzelteils — der SOAP-Envelope. */
  wurzel: Buffer;
  /** Alle übrigen Teile, Schlüssel ist die Content-ID **ohne** die spitzen Klammern. */
  anhaenge: Map<string, Buffer>;
}

const CR = 0x0d;
const LF = 0x0a;
const BINDESTRICH = 0x2d;

/**
 * Liest einen Parameter aus einem Content-Type. Werte dürfen laut RFC 2045 mit
 * oder ohne Anführungszeichen stehen; CXF setzt sie, andere Stacks nicht.
 */
export function contentTypeParameter(contentType: string, name: string): string | undefined {
  const re = new RegExp(`;\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i');
  const treffer = re.exec(contentType);
  if (!treffer) return undefined;
  return treffer[1] !== undefined ? treffer[1] : treffer[2];
}

/** `true`, wenn der Content-Type eine mehrteilige Antwort ankündigt. */
export function istMehrteilig(contentType: string | null | undefined): boolean {
  return typeof contentType === 'string' && /^\s*multipart\//i.test(contentType);
}

/** Entfernt die spitzen Klammern einer Content-ID: `<a@b>` → `a@b`. */
function ohneKlammern(wert: string): string {
  const w = wert.trim();
  return w.startsWith('<') && w.endsWith('>') ? w.slice(1, -1) : w;
}

/**
 * Löst eine `cid:`-Referenz aus einem `<xop:Include href>` in die reine
 * Content-ID auf. Nach RFC 2392 ist der Teil hinter `cid:` prozentkodiert —
 * `root.message%40cxf.apache.org` meint `root.message@cxf.apache.org`.
 */
export function cidAusHref(href: string): string | undefined {
  const h = href.trim();
  if (!/^cid:/i.test(h)) return undefined;
  const roh = h.slice(4);
  try {
    return decodeURIComponent(roh);
  } catch {
    // Ein einzelnes '%' ohne gültige Folge darf die Auflösung nicht sprengen —
    // dann gilt der Wert unverändert.
    return roh;
  }
}

/** Positionen aller echten Grenzzeilen. Eine Grenze steht am Anfang oder nach einem Zeilenende. */
function grenzPositionen(roh: Buffer, trenner: Buffer): number[] {
  const positionen: number[] = [];
  let i = roh.indexOf(trenner, 0);
  while (i !== -1) {
    const davor = i === 0 || roh[i - 1] === LF;
    if (davor) positionen.push(i);
    i = roh.indexOf(trenner, i + trenner.length);
  }
  return positionen;
}

/** Schneidet ein führendes Zeilenende ab. */
function nachZeilenende(roh: Buffer, pos: number): number {
  if (roh[pos] === CR && roh[pos + 1] === LF) return pos + 2;
  if (roh[pos] === LF) return pos + 1;
  return pos;
}

/** Schneidet ein abschließendes Zeilenende ab — es gehört zur Grenze, nicht zum Inhalt. */
function vorZeilenende(roh: Buffer, pos: number): number {
  if (pos >= 2 && roh[pos - 2] === CR && roh[pos - 1] === LF) return pos - 2;
  if (pos >= 1 && roh[pos - 1] === LF) return pos - 1;
  return pos;
}

/** Trennt Kopfzeilen und Körper eines Teils an der ersten Leerzeile. */
function teileKopfUndKoerper(teil: Buffer): { kopf: string; koerper: Buffer } {
  for (let i = 0; i + 1 < teil.length; i++) {
    if (teil[i] === LF && teil[i + 1] === LF) {
      return { kopf: teil.subarray(0, i).toString('latin1'), koerper: teil.subarray(i + 2) };
    }
    if (teil[i] === CR && teil[i + 1] === LF && teil[i + 2] === CR && teil[i + 3] === LF) {
      return { kopf: teil.subarray(0, i).toString('latin1'), koerper: teil.subarray(i + 4) };
    }
  }
  // Ein Teil ohne Leerzeile hat keine Kopfzeilen — alles ist Körper.
  return { kopf: '', koerper: teil };
}

/** Liest eine Kopfzeile aus dem Kopfblock eines Teils. */
function kopfzeile(kopf: string, name: string): string | undefined {
  const re = new RegExp(`^${name}\\s*:\\s*(.*)$`, 'im');
  const treffer = re.exec(kopf);
  return treffer?.[1]?.trim();
}

/**
 * Packt eine mehrteilige Antwort aus.
 *
 * Wirft **nicht**, wenn etwas fehlt: Ein Aufrufer, der hier einen Fehler
 * bekäme, stünde ohne die Nutzdaten da — bei `empfangen` wäre die einmalige
 * Zustellung damit endgültig verloren. Statt dessen liefert die Funktion
 * `undefined` und überlässt dem Aufrufer die Entscheidung, der den rohen Körper
 * noch hat.
 */
export function zerlegeMehrteilig(roh: Buffer, contentType: string): MtomAntwort | undefined {
  const grenze = contentTypeParameter(contentType, 'boundary');
  if (!grenze) return undefined;

  const trenner = Buffer.from(`--${grenze}`, 'latin1');
  const positionen = grenzPositionen(roh, trenner);
  if (positionen.length < 2) return undefined;

  const teile: { id?: string; koerper: Buffer }[] = [];
  for (let i = 0; i < positionen.length - 1; i++) {
    const start = positionen[i];
    const naechste = positionen[i + 1];
    if (start === undefined || naechste === undefined) break;
    let anfang = start + trenner.length;
    // '--' unmittelbar nach dem Trenner schliesst die Folge ab.
    if (roh[anfang] === BINDESTRICH && roh[anfang + 1] === BINDESTRICH) break;
    anfang = nachZeilenende(roh, anfang);
    const ende = vorZeilenende(roh, naechste);
    if (ende <= anfang) continue;

    const { kopf, koerper } = teileKopfUndKoerper(roh.subarray(anfang, ende));
    const id = kopfzeile(kopf, 'Content-ID');
    const kodierung = (kopfzeile(kopf, 'Content-Transfer-Encoding') || '').toLowerCase();
    // 'binary', '8bit' und '7bit' sind bereits Rohbytes; nur base64 und
    // quoted-printable muessen zurueckverwandelt werden.
    const entschluesselt =
      kodierung === 'base64'
        ? Buffer.from(koerper.toString('latin1').replace(/\s+/g, ''), 'base64')
        : koerper;
    teile.push({ ...(id ? { id: ohneKlammern(id) } : {}), koerper: entschluesselt });
  }

  if (teile.length === 0) return undefined;

  const startId = contentTypeParameter(contentType, 'start');
  const gesucht = startId ? ohneKlammern(startId) : undefined;
  // Ohne 'start' gilt nach RFC 2387 der erste Teil als Wurzel.
  const wurzelIndex = gesucht ? teile.findIndex((t) => t.id === gesucht) : 0;
  const index = wurzelIndex === -1 ? 0 : wurzelIndex;

  const wurzelTeil = teile[index];
  if (!wurzelTeil) return undefined;

  const anhaenge = new Map<string, Buffer>();
  teile.forEach((t, i) => {
    if (i !== index && t.id) anhaenge.set(t.id, t.koerper);
  });

  return { wurzel: wurzelTeil.koerper, anhaenge };
}
