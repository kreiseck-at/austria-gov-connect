export interface XmlNode {
  name: string;
  prefix?: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const replacement = NAMED_ENTITIES[body];
    return replacement !== undefined ? replacement : match;
  });
}

function splitName(raw: string): { prefix?: string; name: string } {
  const i = raw.indexOf(':');
  return i === -1 ? { name: raw } : { prefix: raw.slice(0, i), name: raw.slice(i + 1) };
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// Findet die Position des schließenden '>' eines Tags ab `start`,
// wobei '>' innerhalb von Attributwerten (in Quotes) ignoriert wird.
function findTagEnd(xml: string, start: number): number {
  let quote: string | null = null;
  for (let j = start; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return j;
    }
  }
  return -1;
}

function parseStartTag(inner: string): XmlNode {
  let k = 0;
  const len = inner.length;
  while (k < len && isSpace(inner[k]!)) k++;
  const nameStart = k;
  while (k < len && !isSpace(inner[k]!)) k++;
  const { prefix, name } = splitName(inner.slice(nameStart, k));
  const attrs: Record<string, string> = {};

  while (k < len) {
    while (k < len && isSpace(inner[k]!)) k++;
    if (k >= len) break;
    const attrStart = k;
    while (k < len && inner[k] !== '=' && !isSpace(inner[k]!)) k++;
    const attrRaw = inner.slice(attrStart, k);
    while (k < len && isSpace(inner[k]!)) k++;
    if (inner[k] !== '=') {
      if (attrRaw) attrs[attrRaw] = '';
      continue;
    }
    k++; // '='
    while (k < len && isSpace(inner[k]!)) k++;
    const quote = inner[k];
    let value = '';
    if (quote === '"' || quote === "'") {
      k++;
      const valueStart = k;
      while (k < len && inner[k] !== quote) k++;
      value = inner.slice(valueStart, k);
      k++; // schließendes Quote
    } else {
      const valueStart = k;
      while (k < len && !isSpace(inner[k]!)) k++;
      value = inner.slice(valueStart, k);
    }
    attrs[attrRaw] = decodeEntities(value);
  }

  return { name, prefix, attrs, children: [], text: '' };
}

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  const n = xml.length;

  while (i < n) {
    if (xml[i] !== '<') {
      const lt = xml.indexOf('<', i);
      const end = lt === -1 ? n : lt;
      const raw = xml.slice(i, end);
      if (raw.trim().length > 0) {
        stack[stack.length - 1]!.text += decodeEntities(raw);
      }
      i = end;
      continue;
    }

    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i);
      if (end === -1) throw new Error('Unterminated processing instruction');
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i);
      if (end === -1) throw new Error('Unterminated comment');
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i);
      if (end === -1) throw new Error('Unterminated CDATA');
      stack[stack.length - 1]!.text += xml.slice(i + 9, end);
      i = end + 3;
      continue;
    }
    if (xml.startsWith('</', i)) {
      const end = xml.indexOf('>', i);
      if (end === -1) throw new Error('Unterminated end tag');
      const { name } = splitName(xml.slice(i + 2, end).trim());
      const top = stack.pop();
      if (!top || top === root) throw new Error(`Unexpected end tag </${name}>`);
      if (top.name !== name) {
        throw new Error(`Mismatched end tag: expected </${top.name}>, got </${name}>`);
      }
      i = end + 1;
      continue;
    }

    const end = findTagEnd(xml, i + 1);
    if (end === -1) throw new Error('Unterminated start tag');
    let inner = xml.slice(i + 1, end);
    const selfClose = inner.endsWith('/');
    if (selfClose) inner = inner.slice(0, -1);
    const node = parseStartTag(inner);
    stack[stack.length - 1]!.children.push(node);
    if (!selfClose) stack.push(node);
    i = end + 1;
  }

  if (stack.length !== 1) throw new Error('Unterminated element(s) in XML');
  if (root.children.length === 0) throw new Error('No root element found');
  if (root.children.length > 1) throw new Error('Multiple root elements found');
  if (root.text.trim().length > 0) throw new Error('Unexpected content outside root element');
  return root.children[0]!;
}

export function firstChild(node: XmlNode, localName: string): XmlNode | undefined {
  return node.children.find((c) => c.name === localName);
}

export function childText(node: XmlNode, localName: string): string | undefined {
  return firstChild(node, localName)?.text;
}

export function findDescendant(node: XmlNode, localName: string): XmlNode | undefined {
  if (node.name === localName) return node;
  for (const child of node.children) {
    const found = findDescendant(child, localName);
    if (found) return found;
  }
  return undefined;
}
