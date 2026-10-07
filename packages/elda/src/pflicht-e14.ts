import type { Pflichtstufe } from './pflicht-e29';
import type { Lohnzettelversion } from './felder-e14';

/**
 * Pflichtstufen des Lohnzettels Finanz, Kapitel E.13.1 (Informationssatz) und
 * E.14.1 (Mitteilungssatz) — Version 28 Seiten 221 und 234–237, Version 29
 * Seiten 227 und 241–244. Legende wie im Dokument:
 *
 * - `Z`  Angabe zwingend
 * - `Z1` zwingend, wenn zutreffend
 * - `Z3` Angabe möglich
 * - `-`  keine Angabe, Feld in Grundstellung
 *
 * Reines Datenabbild, geschlüsselt über den Feldnamen der Feldtabelle. Die
 * Tabelle E.14.1 selbst weicht an sechs Stellen von den Namen der Feldtabelle
 * ab; maßgeblich ist hier die Feldnummer:
 *
 * | Nr. | E.14.1 | Feldtabelle E.14 |
 * |---|---|---|
 * | 35 | `PGDB` | `PGBD` |
 * | 89 | `BVSV` | `BPFG` |
 * | 146 | `BFABO` (wie Feld 143) | `FABO` |
 * | 147 | `HTOA` | `HOTA` |
 * | 164 | zweimal vergeben (`VFSVB`, `FSVB`) | `VFSVB` 164, `FSVB` 165 |
 * | 169 | `VKZUB` | `VZUKB` |
 *
 * Felder, die in der Feldtabelle stehen, in E.14.1 aber fehlen, sind
 * ausschließlich Reservefelder; sie bleiben in Grundstellung.
 *
 * Wie `erstelleLohnzettelBestand` mit den Stufen umgeht — und warum `Z` nicht
 * überall durchgesetzt werden kann —, steht bei `pruefePflichtLohnzettel`.
 */

/** Informationssatz `I1` (E.13.1). In Version 28 und 29 gleich. */
export const PFLICHT_I1: Readonly<Record<string, Pflichtstufe>> = Object.freeze({
  FSART: 'Z', // 2
  CLEAR: '-', // 3
  CLDVR: '-', // 4
  STNRL: 'Z3', // 6
  DVRNL: 'Z3', // 7
  STNRA: 'Z', // 9
  DVRNA: 'Z3', // 10
  ARTD: 'Z', // 11
  DTUE: 'Z', // 12
  ZTUE: 'Z3', // 13
  STVE: 'Z', // 14
  ANAM: 'Z', // 15
  ATIT: 'Z3', // 16
  AADR: 'Z', // 17
  ALKZ: 'Z', // 18
  APLZ: 'Z', // 19
  AORT: 'Z3', // 20
  INTE: '-', // 21
  JAHR: 'Z', // 22
  GESA: 'Z', // 23
  ANZA: 'Z', // 24
  ATEL: 'Z3', // 25
  AFAX: 'Z3', // 26
});

/** Mitteilungssatz `L1`, Felder 2–194 — in Version 28 und 29 gleich. */
const PFLICHT_L1_GEMEINSAM: Readonly<Record<string, Pflichtstufe>> = {
  FSART: 'Z', // 2
  CLADR: '-', // 3
  CLDVR: '-', // 4
  STNRL: 'Z3', // 6
  DVRNL: 'Z3', // 7
  ARTU: '-', // 8
  DTUE: 'Z', // 9
  ZTUE: 'Z3', // 10
  REFN: 'Z', // 11
  ARTL: 'Z', // 12
  FEHL: '-', // 13
  STAT: '-', // 14
  FIND: 'Z', // 15
  BELZ: 'Z', // 16
  ENLZ: 'Z', // 17
  JALZ: 'Z', // 18
  SOZS: 'Z', // 19
  AVLN: 'Z', // 20
  AGBD: 'Z', // 21
  ANAM: 'Z', // 22
  ATIT: 'Z3', // 23
  AADR: 'Z', // 24
  ALKZ: 'Z', // 25
  APLZ: 'Z', // 26
  AORT: 'Z1', // 27
  GESW: 'Z1', // 28
  GESM: 'Z1', // 29
  GESD: 'Z1', // 30
  VOLL: 'Z1', // 31
  TEIL: 'Z1', // 32
  AVAB: 'Z1', // 33
  PVLN: 'Z', // 34
  PGBD: 'Z', // 35
  AEAB: 'Z1', // 36
  V210: 'Z', // 37
  B210: 'Z', // 38
  V215: 'Z1', // 39
  B215: 'Z1', // 40
  V220: 'Z1', // 41
  B220: 'Z1', // 42
  VIEB: 'Z1', // 43
  BIEB: 'Z1', // 44
  V225: 'Z1', // 45
  B225: 'Z1', // 46
  V226: 'Z1', // 47
  B226: 'Z1', // 48
  V230: 'Z1', // 49
  B230: 'Z1', // 50
  VAUS: 'Z1', // 53
  BAUS: 'Z1', // 54
  VPEN: 'Z1', // 55
  BPEN: 'Z1', // 56
  VEFB: 'Z1', // 57
  BEFB: 'Z1', // 58
  VSTF: 'Z1', // 59
  BSTF: 'Z1', // 60
  VSSB: 'Z1', // 61
  BSSB: 'Z1', // 62
  V243: 'Z1', // 63
  B243: 'Z1', // 64
  V245: 'Z', // 65
  B245: 'Z', // 66
  VIEL: 'Z1', // 67
  BIEL: 'Z1', // 68
  VABL: 'Z1', // 69
  BABL: 'Z1', // 70
  V260: 'Z1', // 71
  B260: 'Z1', // 72
  VSOB: 'Z1', // 73
  BSOB: 'Z1', // 74
  VFB1: 'Z1', // 75
  BFB1: 'Z1', // 76
  VFB2: 'Z1', // 78
  BFB2: 'Z1', // 79
  VAUF: 'Z1', // 80
  BAUF: 'Z1', // 81
  VFB3: 'Z1', // 82
  BFB3: 'Z1', // 83
  VNEB: 'Z1', // 84
  BNEB: 'Z1', // 85
  PVON: 'Z1', // 86
  PBIS: 'Z1', // 87
  VPFG: 'Z1', // 88
  BPFG: 'Z1', // 89
  VSFB: 'Z1', // 90
  BSFB: 'Z1', // 91
  STNRA: 'Z', // 101
  DVRNA: 'Z3', // 102
  ANME: 'Z1', // 103
  KORR: 'Z1', // 104
  VUEB: 'Z1', // 105
  BUEB: 'Z1', // 106
  INTE: '-', // 107
  WOBD: 'Z3', // 108
  ZOBD: 'Z3', // 109
  ANZK: 'Z1', // 110
  VAPK: 'Z1', // 123
  BAPK: 'Z1', // 124
  EPAB: 'Z1', // 125
  VENT: 'Z1', // 126
  ENTW: 'Z1', // 127
  VPRE: 'Z1', // 128
  PREI: 'Z1', // 129
  WERK: 'Z1', // 130
  VPEND: 'Z1', // 131
  BPEND: 'Z1', // 132
  UEBMO: 'Z1', // 134
  LDKZA: 'Z1', // 137
  VWBKB: 'Z1', // 138
  WBKB: 'Z1', // 139
  ERVAB: 'Z1', // 142
  BFABO: 'Z1', // 143
  KFABO: 'Z1', // 144
  VFABO: 'Z1', // 145
  FABO: 'Z1', // 146
  HOTA: 'Z1', // 147
  VHOPA: 'Z1', // 148
  HOPA: 'Z1', // 149
  VKOUN: 'Z1', // 150
  KOUN: 'Z1', // 151
  VMAGB: 'Z1', // 152
  MAGB: 'Z1', // 153
  FLABZ: 'Z1', // 154
  AUEZG: 'Z1', // 155
  VTEPR: 'Z1', // 156
  TEPR: 'Z1', // 157
  VMAPR: 'Z1', // 158
  MAPR: 'Z1', // 159
  STUM: 'Z1', // 160
  STUMJ: 'Z1', // 161
  ZF673: 'Z1', // 162
  BDOZ: 'Z1', // 163
  VFSVB: 'Z1', // 164
  FSVB: 'Z1', // 165
  PLST: 'Z1', // 166
  VKAKL: 'Z1', // 167
  KAKL: 'Z1', // 168
  VZUKB: 'Z1', // 169
  ZUKB: 'Z1', // 170
  GEBD: 'Z1', // 171
  GEBP: 'Z1', // 172
  AKZKB: 'Z1', // 173
  REFN_175: 'Z3', // 175
  BSBKFZ: 'Z1', // 177
  BSBWR: 'Z1', // 178
  BSBSB: 'Z1', // 179
  SB681: 'Z1', // 180
  SB682: 'Z1', // 181
  BZUKG: 'Z1', // 182
  MAKBG: 'Z1', // 183
  MABST: 'Z1', // 184
  ZUCSG: 'Z1', // 185
  GUTSC: 'Z1', // 186
  MARAB: 'Z1', // 187
  SBK00: 'Z1', // 188
  SBK15: 'Z1', // 189
  SBK20: 'Z1', // 190
  SBKDW: 'Z1', // 191
  AKKFZ: 'Z1', // 192
  KEAKFZ: 'Z1', // 193
  AGLAG: 'Z1', // 194
};

/** Version 29: die fünf neuen Felder ab Position 1194. */
const PFLICHT_L1_ANHANG_29: Readonly<Record<string, Pflichtstufe>> = {
  SBK37: 'Z1', // 195
  TALV: 'Z1', // 196
  AKFB: 'Z1', // 197
  AKFH: 'Z1', // 198
  AKFK: 'Z1', // 199
};

/**
 * Mitteilungssatz `L1` je Version, ohne Kinderblock. Die Felder des
 * Kinderblocks stehen in {@link PFLICHT_KIND} — einmal je Feld, sie gelten für
 * jedes der 15 Kinder.
 */
export const PFLICHT_L1: Readonly<Record<Lohnzettelversion, Readonly<Record<string, Pflichtstufe>>>> =
  Object.freeze({
    '28': Object.freeze({ ...PFLICHT_L1_GEMEINSAM }),
    '29': Object.freeze({ ...PFLICHT_L1_GEMEINSAM, ...PFLICHT_L1_ANHANG_29 }),
  });

/** Kinderblock je Version (alle `Z1`: zwingend, wenn zutreffend). */
export const PFLICHT_KIND: Readonly<Record<Lohnzettelversion, Readonly<Record<string, Pflichtstufe>>>> =
  Object.freeze({
    '28': Object.freeze({
      KFAM: 'Z1', // 196
      KVON: 'Z1', // 197
      KSTAAT: 'Z1', // 198
      KSTWE: 'Z1', // 199
      KVSNR: 'Z1', // 200
      KGEBD: 'Z1', // 201
      KAFBZ: 'Z1', // 202
      KAPFB: 'Z1', // 203
      KAUHZ: 'Z1', // 204
      KBGFP: 'Z1', // 205
      KEGFP: 'Z1', // 206
      KBHFP: 'Z1', // 207
      KEHFP: 'Z1', // 208
    }),
    '29': Object.freeze({
      KFAM: 'Z1', // 201
      KVON: 'Z1', // 202
      KSTAAT: 'Z1', // 203
      KSTWE: 'Z1', // 204
      KVSNR: 'Z1', // 205
      KGEBD: 'Z1', // 206
      KAFBZ: 'Z1', // 207
      KAPFB: 'Z1', // 208
      KAUHZ: 'Z1', // 209
      KBGFP: 'Z1', // 210
      KEGFP: 'Z1', // 211
      KBHFP: 'Z1', // 212
      KEHFP: 'Z1', // 213
      KBVFP: 'Z1', // 214
      KEVFP: 'Z1', // 215
      KBDFP: 'Z1', // 216
      KEDFP: 'Z1', // 217
      KVRFP: 'Z1', // 218
      KBRFP: 'Z1', // 219
      KERFP: 'Z1', // 220
    }),
  });
