// Writer of NBT, the binary format of Minecraft's world data: schematics,
// structures and blueprints. Uncompressed; most files gzip the result.

export const TAG = {
  END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, BYTE_ARRAY: 7, STRING: 8,
  LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12,
};
const encoder = new TextEncoder();

export class NbtWriter {
  constructor() { this.bytes = []; }
  u8(v) { this.bytes.push(v & 0xff); }
  i16(v) { this.u8(v >> 8); this.u8(v); }
  i32(v) { this.u8(v >> 24); this.u8(v >> 16); this.u8(v >> 8); this.u8(v); }
  text(value) {
    const utf8 = encoder.encode(value);
    this.i16(utf8.length);
    for (const b of utf8) this.bytes.push(b);
  }
  header(tag, name) { this.u8(tag); this.text(name); }
  byte(name, v) { this.header(TAG.BYTE, name); this.u8(v); }
  short(name, v) { this.header(TAG.SHORT, name); this.i16(v); }
  int(name, v) { this.header(TAG.INT, name); this.i32(v); }
  /** A long that fits in 32 bits. */
  long(name, v) { this.header(TAG.LONG, name); this.i32(v < 0 ? -1 : 0); this.i32(v); }
  float(name, v) {
    this.header(TAG.FLOAT, name);
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, v);
    for (let i = 0; i < 4; i++) this.u8(view.getUint8(i));
  }
  byteArray(name, values) { this.header(TAG.BYTE_ARRAY, name); this.i32(values.length); for (const v of values) this.u8(v); }
  intArray(name, values) { this.header(TAG.INT_ARRAY, name); this.i32(values.length); for (const v of values) this.i32(v); }
  /** values: BigUint64Array. */
  longArray(name, values) {
    this.header(TAG.LONG_ARRAY, name); this.i32(values.length);
    for (const v of values) { this.i32(Number(v >> 32n)); this.i32(Number(v & 0xffffffffn)); }
  }
  string(name, v) { this.header(TAG.STRING, name); this.text(v); }
  /** The head of a list; its `length` elements follow, each compound closed with end(). */
  list(name, elementTag, length) { this.header(TAG.LIST, name); this.u8(elementTag); this.i32(length); }
  emptyList(name) { this.list(name, TAG.COMPOUND, 0); }
  intList(name, values) { this.list(name, TAG.INT, values.length); for (const v of values) this.i32(v); }
  compound(name, body) { this.header(TAG.COMPOUND, name); body(); this.end(); }
  end() { this.u8(TAG.END); }
}
