export class UidEingabeError extends Error {
  constructor(message: string) { super(message); this.name = 'UidEingabeError'; }
}
