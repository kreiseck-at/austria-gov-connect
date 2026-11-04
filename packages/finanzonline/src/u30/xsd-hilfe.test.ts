// Testhilfe (enthält selbst keine Tests): prüft ein U30-XML offline gegen das
// amtliche BMF-Schema. Die Schemas liegen unverändert unter test/xsd/
// (Quelle und Stand: test/xsd/QUELLE.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateXML } from 'xmllint-wasm';

const XSD_ORDNER = join(__dirname, '..', '..', 'test', 'xsd');
const XSD_2026 = readFileSync(join(XSD_ORDNER, 'BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_07_2026.xsd'));
const XSD_2022 = readFileSync(join(XSD_ORDNER, 'BMF_ERKLAERUNGS_UEBERMITTLUNG_U30_01_2022.xsd'));

/** Ordner der Golden-Dateien. */
export const GOLDEN_ORDNER = join(__dirname, '..', '..', 'test', 'golden', 'u30');

/** Liest eine Golden-Datei (ISO-8859-1, wie im XML deklariert). */
export function golden(name: string): string {
  return readFileSync(join(GOLDEN_ORDNER, name), 'latin1');
}

/**
 * Validiert gegen das Schema ab 01/2022, wenn alle Zeiträume vor 07/2026
 * beginnen, sonst gegen das Schema ab 07/2026. Das XML wird in der deklarierten
 * Kodierung übergeben (ISO-8859-1-Bytes), damit Umlaute so geprüft werden, wie
 * FinanzOnline sie liest.
 */
export async function pruefeGegenXsd(
  xml: string,
): Promise<{ gueltig: boolean; fehler: string[]; schema: string }> {
  const zeitraeume = [...xml.matchAll(/<ZRVON type="jahrmonat">([^<]*)<\/ZRVON>/g)].map((m) => m[1] ?? '');
  const alt = zeitraeume.length > 0 && zeitraeume.every((z) => z < '2026-07');
  const kodierung = /encoding="iso-8859-1"/i.test(xml) ? 'latin1' : 'utf8';
  const ergebnis = await validateXML({
    xml: [{ fileName: 'u30.xml', contents: new Uint8Array(Buffer.from(xml, kodierung)) }],
    schema: [{ fileName: 'u30.xsd', contents: new Uint8Array(alt ? XSD_2022 : XSD_2026) }],
  });
  return {
    gueltig: ergebnis.valid,
    fehler: ergebnis.errors.map((e) => e.rawMessage),
    schema: alt ? '01/2022' : '07/2026',
  };
}
