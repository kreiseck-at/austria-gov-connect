// Node-gebundener Einstiegspunkt: @kreiseck/rksv/code/signatur.
//
// Die ES256-Signaturpruefung braucht X.509-Zertifikate und elliptische Kurven,
// also node:crypto. Sie wird bewusst nicht browsertauglich gemacht: ohne das
// Zertifikat der Signatureinheit ist sie ohnehin fuer niemanden moeglich -- auch
// nicht fuer das BMF-Prueftool --, und im Datenerfassungsprotokoll stehen die
// Zertifikatsfelder leer.
//
// Alles, was ohne Node auskommt (Dekodierung, Verkettung, Base32), liegt unter
// @kreiseck/rksv/code.
export { pruefeBelegCode, type Pruefergebnis, type PruefOptionen } from './pruefe';
export { type Pruefung } from './pruefungstyp';
