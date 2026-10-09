// Minimal read-only ZIP reader: central directory + stored/deflated members.

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;
const decoder = new TextDecoder();

export class ZipArchive {
  constructor(buffer) {
    this.bytes = new Uint8Array(buffer);
    this.view = new DataView(buffer);
    this.entries = new Map();
    const view = this.view;
    let end = -1;
    for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 22 - 0xffff); i--) {
      if (view.getUint32(i, true) === EOCD) { end = i; break; }
    }
    if (end < 0) throw new Error("Not a ZIP archive.");
    const total = view.getUint16(end + 10, true);
    let p = view.getUint32(end + 16, true);
    for (let i = 0; i < total; i++) {
      if (view.getUint32(p, true) !== CENTRAL) throw new Error("Corrupt ZIP directory.");
      const nameLength = view.getUint16(p + 28, true);
      const name = decoder.decode(this.bytes.subarray(p + 46, p + 46 + nameLength));
      this.entries.set(name, {
        method: view.getUint16(p + 10, true),
        compressedSize: view.getUint32(p + 20, true),
        offset: view.getUint32(p + 42, true),
      });
      p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    }
  }

  has(name) { return this.entries.has(name); }

  names() { return [...this.entries.keys()]; }

  /** Uncompressed bytes of a member; throws if it is missing. */
  async read(name) {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Missing archive member: ${name}`);
    const view = this.view, at = entry.offset;
    if (view.getUint32(at, true) !== LOCAL) throw new Error("Corrupt ZIP member.");
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    const raw = this.bytes.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return raw;
    if (entry.method !== 8) throw new Error(`Unsupported ZIP compression: ${entry.method}`);
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async json(name) { return JSON.parse(decoder.decode(await this.read(name))); }
}
