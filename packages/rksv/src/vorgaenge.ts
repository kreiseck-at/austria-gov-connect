import { escapeXmlText, FonError } from '@kreiseck/finanzonline-core';

export class RksvError extends FonError {
  constructor(message: string) {
    super(message);
    this.name = 'RksvError';
  }
}

export type ArtSe = 'SIGNATURKARTE' | 'EIGENES_HSM' | 'HSM_DIENSTLEISTER';

export interface RegistrierungKasse {
  art: 'registrierung_kasse';
  kassenidentifikationsnummer: string;
  benutzerschluessel: string;
  anmerkung?: string;
}
export interface RegistrierungSee {
  art: 'registrierung_se';
  artSe: ArtSe;
  vdaId: string;
  zertifikatsseriennummer?: string;
  zertifikat?: string;
}
export interface AusfallKasse {
  art: 'ausfall_kasse';
  kassenidentifikationsnummer: string;
  ausfall?: { begruendung: 1 | 5 | 99; beginn: Date };
  ausserbetriebnahme?: { begruendung: 6 | 7 };
}
export interface AusfallSee {
  art: 'ausfall_se';
  zertifikatsseriennummer: string;
  ausfall?: { begruendung: 1 | 2 | 99; beginn: Date };
  ausserbetriebnahme?: { begruendung: 6 | 7 };
}
export interface WiederinbetriebnahmeKasse {
  art: 'wiederinbetriebnahme_kasse';
  kassenidentifikationsnummer: string;
  ende: Date;
}
export interface WiederinbetriebnahmeSee {
  art: 'wiederinbetriebnahme_se';
  zertifikatsseriennummer: string;
  ende: Date;
}
export interface BelegpruefungVorgang {
  art: 'belegpruefung';
  beleg: string;
}
export type Vorgang =
  | RegistrierungKasse
  | RegistrierungSee
  | AusfallKasse
  | AusfallSee
  | WiederinbetriebnahmeKasse
  | WiederinbetriebnahmeSee
  | BelegpruefungVorgang;

const VDA_ID = /^[A-Z]{2}[1-9][0-9]?$/;
const ZERT_SN = /^[0-9A-Fa-f]{1,50}$/;
const BENUTZERSCHLUESSEL = /^[0-9a-zA-Z+/=]{44}$/;
const ART_SE: readonly ArtSe[] = ['SIGNATURKARTE', 'EIGENES_HSM', 'HSM_DIENSTLEISTER'];

export function isoDateTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function el(name: string, value: string): string {
  return `<${name}>${escapeXmlText(value)}</${name}>`;
}

/**
 * Zertifikatsseriennummer-Element mit `hex="true"` — wie in den echten
 * FON-Requests. Das Attribut macht die Hex-Interpretation explizit (sonst
 * würde eine rein numerische Seriennummer als Dezimalzahl fehlgedeutet).
 */
export function zertSnEl(value: string): string {
  return `<zertifikatsseriennummer hex="true">${escapeXmlText(value)}</zertifikatsseriennummer>`;
}

function req(condition: boolean, message: string): void {
  if (!condition) throw new RksvError(message);
}

export function vorgangArt(v: Vorgang): string {
  return v.art;
}

function ausfallBlock(
  a: { ausfall?: { begruendung: number; beginn: Date }; ausserbetriebnahme?: { begruendung: number } },
  ausfallCodes: readonly number[],
): string {
  const hatAusfall = a.ausfall !== undefined;
  const hatAbn = a.ausserbetriebnahme !== undefined;
  req(hatAusfall !== hatAbn, 'Genau eines von ausfall/ausserbetriebnahme ist erforderlich');
  if (a.ausfall) {
    req(ausfallCodes.includes(a.ausfall.begruendung), `Ungültiger Begründungscode ${a.ausfall.begruendung} für Ausfall`);
    return `<ausfall>${el('begruendung', String(a.ausfall.begruendung))}${el('beginn_ausfall', isoDateTime(a.ausfall.beginn))}</ausfall>`;
  }
  const abn = a.ausserbetriebnahme!;
  req(abn.begruendung === 6 || abn.begruendung === 7, `Ungültiger Begründungscode ${abn.begruendung} für Außerbetriebnahme`);
  return `<ausserbetriebnahme>${el('begruendung', String(abn.begruendung))}</ausserbetriebnahme>`;
}

export function vorgangXml(v: Vorgang, satznr: number): string {
  const satz = el('satznr', String(satznr));
  switch (v.art) {
    case 'registrierung_kasse': {
      req(BENUTZERSCHLUESSEL.test(v.benutzerschluessel), 'benutzerschluessel muss 44 Zeichen [0-9a-zA-Z+/=] sein');
      const anmerkung = v.anmerkung !== undefined ? el('anmerkung', v.anmerkung) : '';
      return `<registrierung_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${anmerkung}${el('benutzerschluessel', v.benutzerschluessel)}</registrierung_kasse>`;
    }
    case 'registrierung_se': {
      req(ART_SE.includes(v.artSe), `art_se ungültig: ${v.artSe}`);
      req(VDA_ID.test(v.vdaId), `vda_id ungültig: ${v.vdaId}`);
      const hatSn = v.zertifikatsseriennummer !== undefined;
      const hatZert = v.zertifikat !== undefined;
      req(hatSn !== hatZert, 'Genau eines von zertifikatsseriennummer/zertifikat ist erforderlich');
      if (hatSn) req(ZERT_SN.test(v.zertifikatsseriennummer!), 'zertifikatsseriennummer muss hex (max 50) sein');
      const zertEl = hatSn
        ? zertSnEl(v.zertifikatsseriennummer!)
        : el('zertifikat', v.zertifikat!);
      return `<registrierung_se>${satz}${el('art_se', v.artSe)}${el('vda_id', v.vdaId)}${zertEl}</registrierung_se>`;
    }
    case 'ausfall_kasse': {
      const block = ausfallBlock(v, [1, 5, 99]);
      return `<ausfall_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${block}</ausfall_kasse>`;
    }
    case 'ausfall_se': {
      req(ZERT_SN.test(v.zertifikatsseriennummer), 'zertifikatsseriennummer muss hex (max 50) sein');
      const block = ausfallBlock(v, [1, 2, 99]);
      return `<ausfall_se>${satz}${zertSnEl(v.zertifikatsseriennummer)}${block}</ausfall_se>`;
    }
    case 'wiederinbetriebnahme_kasse':
      return `<wiederinbetriebnahme_kasse>${satz}${el('kassenidentifikationsnummer', v.kassenidentifikationsnummer)}${el('ende_ausfall', isoDateTime(v.ende))}</wiederinbetriebnahme_kasse>`;
    case 'wiederinbetriebnahme_se': {
      req(ZERT_SN.test(v.zertifikatsseriennummer), 'zertifikatsseriennummer muss hex (max 50) sein');
      return `<wiederinbetriebnahme_se>${satz}${zertSnEl(v.zertifikatsseriennummer)}${el('ende_ausfall', isoDateTime(v.ende))}</wiederinbetriebnahme_se>`;
    }
    case 'belegpruefung':
      return `<belegpruefung>${satz}${el('beleg', v.beleg)}</belegpruefung>`;
  }
}
