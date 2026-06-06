
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  resolveConfig,
  computeChecksum,
  SchemaToType,
  toUint8Array,
} from "./utils";

const decoder = new TextDecoder();

// Below this payload size the Fletcher-16 accumulators cannot overflow a
// float64 safe integer (the byte sum is at most 255·n, well under 2^53 for any
// realistic payload), so the mod-65536 reduction can be deferred to the very
// end. Larger encrypted payloads fall back to the two-pass decodeBuffer path.
const INLINE_DECRYPT_LIMIT = 5_000_000;

// Shared scratch for assembling one decrypted fixed-width value at a time.
const scratch = new Uint8Array(8);
const scratchView = new DataView(scratch.buffer);

// Reusable growable scratch for decrypting variable-length STRING/OBJECT bytes
// (which are immediately decoded, so the buffer need not outlive the call).
let varScratch = new Uint8Array(256);

/**
 * Sequential parser that decrypts each byte inline as it is consumed (a
 * position-dependent shift back by `position + secret`) and folds the plaintext
 * byte-sum checksum into the same pass — no separate decrypt pass and no
 * full-buffer copy. `st` carries the read offset, the running checksum sum, the
 * data end (excludes the trailing checksum bytes), and the encryption secret.
 */
type DecState = { offset: number; sum: number; end: number; secret: number };

/** Decrypt `n` bytes at the cursor into `scratch`, accumulating the checksum. */
function decScratch(buff: Uint8Array, st: DecState, n: number): void {
  const p = st.offset;
  if (p + n > st.end) throw new RangeError("Attempt to access memory outside buffer bounds");
  let sum = st.sum;
  const secret = st.secret;
  for (let k = 0; k < n; k++) {
    const d = (buff[p + k] - (p + k) - secret) & 0xFF;
    scratch[k] = d;
    sum += d * (p + k + 1);
  }
  st.sum = sum;
  st.offset = p + n;
}

/**
 * Decrypt `len` bytes at the cursor into the shared `varScratch`, accumulating
 * the checksum, and report whether every decrypted byte is ASCII (<= 127) so
 * the caller can take the fast string path without a second scan.
 */
function decVar(buff: Uint8Array, st: DecState, len: number): boolean {
  const p = st.offset;
  if (p + len > st.end) throw new RangeError("Attempt to access memory outside buffer bounds");
  let sum = st.sum;
  const secret = st.secret;
  let ascii = 0;
  for (let k = 0; k < len; k++) {
    const d = (buff[p + k] - (p + k) - secret) & 0xFF;
    varScratch[k] = d;
    ascii |= d;
    sum += d * (p + k + 1);
  }
  st.sum = sum;
  st.offset = p + len;
  return (ascii & 0x80) === 0;
}

/** Decrypt `len` bytes at the cursor into `target`, accumulating the checksum. */
function decInto(buff: Uint8Array, st: DecState, target: Uint8Array, len: number): void {
  const p = st.offset;
  if (p + len > st.end) throw new RangeError("Attempt to access memory outside buffer bounds");
  let sum = st.sum;
  const secret = st.secret;
  for (let k = 0; k < len; k++) {
    const d = (buff[p + k] - (p + k) - secret) & 0xFF;
    target[k] = d;
    sum += d * (p + k + 1);
  }
  st.sum = sum;
  st.offset = p + len;
}

function doUnpackDec(
  schema: Schema | ReadonlyArray<Schema>,
  buff: Uint8Array,
  st: DecState
): any {
  if (typeof schema === "number") {
    switch (schema) {
      case DataTypes.UINT8:
        decScratch(buff, st, 1);
        return scratchView.getUint8(0);
      case DataTypes.INT8:
        decScratch(buff, st, 1);
        return scratchView.getInt8(0);
      case DataTypes.BOOL:
        decScratch(buff, st, 1);
        return scratch[0] !== 0;
      case DataTypes.UINT16:
        decScratch(buff, st, 2);
        return scratchView.getUint16(0, false);
      case DataTypes.INT16:
        decScratch(buff, st, 2);
        return scratchView.getInt16(0, false);
      case DataTypes.UINT32:
        decScratch(buff, st, 4);
        return scratchView.getUint32(0, false);
      case DataTypes.INT32:
        decScratch(buff, st, 4);
        return scratchView.getInt32(0, false);
      case DataTypes.UINT64:
        decScratch(buff, st, 8);
        return scratchView.getBigUint64(0, false);
      case DataTypes.INT64:
        decScratch(buff, st, 8);
        return scratchView.getBigInt64(0, false);
      case DataTypes.FLOAT:
        decScratch(buff, st, 4);
        return scratchView.getFloat32(0, false);
      case DataTypes.FLOAT64:
        decScratch(buff, st, 8);
        return scratchView.getFloat64(0, false);
      case DataTypes.BINARY: {
        decScratch(buff, st, 4);
        const length = scratchView.getUint32(0, false);
        const val = new Uint8Array(length); // returned to caller, needs its own buffer
        decInto(buff, st, val, length);
        return val;
      }
      case DataTypes.STRING: {
        decScratch(buff, st, 4);
        const length = scratchView.getUint32(0, false);
        if (length > varScratch.length) varScratch = new Uint8Array(length);
        const isAscii = decVar(buff, st, length); // decrypts into varScratch
        if (isAscii) {
          if (length < 64) {
            let str = '';
            for (let i = 0; i < length; i++) str += String.fromCharCode(varScratch[i]);
            return str;
          }
          return String.fromCharCode.apply(null, varScratch.subarray(0, length) as any);
        }
        return decoder.decode(varScratch.subarray(0, length));
      }
      case DataTypes.OBJECT: {
        decScratch(buff, st, 4);
        const length = scratchView.getUint32(0, false);
        if (length > varScratch.length) varScratch = new Uint8Array(length);
        decVar(buff, st, length);
        return JSON.parse(decoder.decode(varScratch.subarray(0, length)));
      }
      default:
        throw new Error("Invalid schema!");
    }
  }

  if (schema === null || schema === undefined) {
    throw Error('Invalid schema!');
  }

  if (Array.isArray(schema)) {
    decScratch(buff, st, 4);
    const length = scratchView.getUint32(0, false);
    const val = new Array(length);
    const schemaLen = schema.length;
    for (let i = 0; i < length; i++) {
      val[i] = doUnpackDec(schema[i % schemaLen], buff, st);
    }
    return val;
  }

  if (typeof schema === "object") {
    const val: any = {};
    for (const key in schema) {
      val[key] = doUnpackDec((schema as any)[key], buff, st);
    }
    return val;
  }

  return undefined;
}

/**
 * Reverse the optional checksum/encryption layer applied by pack().
 * Returns the raw data bytes (decrypted and with the checksum stripped),
 * or throws "Data mismatch!" if the checksum does not validate.
 */
function decodeBuffer(
  buff: Uint8Array,
  useCheckSum: boolean,
  useEncrypt: boolean,
  secret: number
): Uint8Array {
  if (useEncrypt && useCheckSum) {
    // Decrypt (position-dependent shift back) and accumulate the plaintext
    // byte-sum checksum in a single pass.
    const dataEndOffset = buff.length - 2;
    const dataBuff = new Uint8Array(dataEndOffset);
    let sum = 0;
    for (let i = 0; i < dataEndOffset; i++) {
      const d = (buff[i] - i - secret) & 0xFF;
      dataBuff[i] = d;
      sum += d * (i + 1);
    }
    sum &= 0xFFFF;
    if (((sum >> 8) & 0xFF) !== buff[dataEndOffset] || (sum & 0xFF) !== buff[dataEndOffset + 1]) {
      throw new Error(`Data mismatch!`);
    }
    return dataBuff;
  }

  if (useEncrypt) {
    // Decrypt into a mutable copy (one pass), no checksum to validate.
    const dataEndOffset = buff.length;
    const dataBuff = new Uint8Array(dataEndOffset);
    for (let i = 0; i < dataEndOffset; i++) {
      dataBuff[i] = (buff[i] - i - secret) & 0xFF;
    }
    return dataBuff;
  }

  if (useCheckSum) {
    // Checksum only: no copy needed, just validate.
    const dataEndOffset = buff.length - 2;
    const sum = computeChecksum(buff, dataEndOffset);
    if (((sum >> 8) & 0xFF) !== buff[dataEndOffset] || (sum & 0xFF) !== buff[dataEndOffset + 1]) {
      throw new Error(`Data mismatch!`);
    }
    return buff.subarray(0, dataEndOffset);
  }

  return buff;
}

function doUnpack(
  schema: Schema | ReadonlyArray<Schema>,
  buf: Uint8Array,
  view: DataView,
  ctx: { offset: number }
): any {
  if (typeof schema === "number") {
    let val: any;
    switch (schema) {
      case DataTypes.UINT8:
        val = view.getUint8(ctx.offset);
        ctx.offset += 1;
        return val;
      case DataTypes.INT8:
        val = view.getInt8(ctx.offset);
        ctx.offset += 1;
        return val;
      case DataTypes.BOOL:
        val = view.getUint8(ctx.offset) !== 0;
        ctx.offset += 1;
        return val;
      case DataTypes.UINT16:
        val = view.getUint16(ctx.offset, false);
        ctx.offset += 2;
        return val;
      case DataTypes.INT16:
        val = view.getInt16(ctx.offset, false);
        ctx.offset += 2;
        return val;
      case DataTypes.UINT32:
        val = view.getUint32(ctx.offset, false);
        ctx.offset += 4;
        return val;
      case DataTypes.INT32:
        val = view.getInt32(ctx.offset, false);
        ctx.offset += 4;
        return val;
      case DataTypes.UINT64:
        val = view.getBigUint64(ctx.offset, false);
        ctx.offset += 8;
        return val;
      case DataTypes.INT64:
        val = view.getBigInt64(ctx.offset, false);
        ctx.offset += 8;
        return val;
      case DataTypes.FLOAT:
        val = view.getFloat32(ctx.offset, false);
        ctx.offset += 4;
        return val;
      case DataTypes.FLOAT64:
        val = view.getFloat64(ctx.offset, false);
        ctx.offset += 8;
        return val;
      case DataTypes.BINARY: {
        const length = view.getUint32(ctx.offset, false);
        ctx.offset += 4;
        if (ctx.offset + length > buf.length) throw new RangeError("Attempt to access memory outside buffer bounds");
        val = buf.slice(ctx.offset, ctx.offset + length);
        ctx.offset += length;
        return val;
      }
      case DataTypes.STRING: {
        const length = view.getUint32(ctx.offset, false);
        ctx.offset += 4;
        if (ctx.offset + length > buf.length) throw new RangeError("Attempt to access memory outside buffer bounds");
        // Fast path for ASCII
        const strStart = ctx.offset;
        let isAscii = true;
        for (let i = strStart; i < strStart + length; i++) {
          if (buf[i] > 127) { isAscii = false; break; }
        }
        if (isAscii && length < 64) {
          let str = '';
          for (let i = strStart; i < strStart + length; i++) {
            str += String.fromCharCode(buf[i]);
          }
          val = str;
        } else if (isAscii) {
          val = String.fromCharCode.apply(null, buf.subarray(strStart, strStart + length) as any);
        } else {
          val = decoder.decode(buf.subarray(strStart, strStart + length));
        }
        ctx.offset += length;
        return val;
      }
      case DataTypes.OBJECT: {
        const length = view.getUint32(ctx.offset, false);
        ctx.offset += 4;
        if (ctx.offset + length > buf.length) throw new RangeError("Attempt to access memory outside buffer bounds");
        val = JSON.parse(decoder.decode(buf.subarray(ctx.offset, ctx.offset + length)));
        ctx.offset += length;
        return val;
      }
      default:
        // A numeric schema that is not a known DataType would otherwise read
        // nothing and silently corrupt the rest of the unpack.
        throw new Error("Invalid schema!");
    }
  }

  if (schema === null || schema === undefined) {
    throw Error('Invalid schema!');
  }

  if (Array.isArray(schema)) {
    const length = view.getUint32(ctx.offset, false);
    ctx.offset += 4;
    const val = new Array(length);
    const schemaLen = schema.length;
    for (let i = 0; i < length; i++) {
      val[i] = doUnpack(schema[i % schemaLen], buf, view, ctx);
    }
    return val;
  }

  if (typeof schema === "object") {
    const val: any = {};
    for (const key in schema) {
      val[key] = doUnpack((schema as any)[key], buf, view, ctx);
    }
    return val;
  }

  return undefined;
}

/**
 * Skip over schema data in buffer without unpacking values.
 * Advances ctx.offset to the end of the field's data.
 */
function skipSchema(
  schema: Schema | Array<Schema>,
  buf: Uint8Array,
  view: DataView,
  ctx: { offset: number }
): void {
  if (typeof schema === "number") {
    switch (schema) {
      case DataTypes.UINT8:
      case DataTypes.INT8:
      case DataTypes.BOOL:
        ctx.offset += 1;
        break;
      case DataTypes.UINT16:
      case DataTypes.INT16:
        ctx.offset += 2;
        break;
      case DataTypes.UINT32:
      case DataTypes.INT32:
      case DataTypes.FLOAT:
        ctx.offset += 4;
        break;
      case DataTypes.UINT64:
      case DataTypes.INT64:
      case DataTypes.FLOAT64:
        ctx.offset += 8;
        break;
      case DataTypes.BINARY:
      case DataTypes.STRING:
      case DataTypes.OBJECT: {
        if (ctx.offset + 4 > buf.length) throw new RangeError("Attempt to access memory outside buffer bounds");
        const length = view.getUint32(ctx.offset, false);
        ctx.offset += 4 + length;
        break;
      }
      default:
        throw new Error("Invalid schema!");
    }
    if (ctx.offset > buf.length) throw new RangeError("Attempt to access memory outside buffer bounds");
    return;
  }

  if (Array.isArray(schema)) {
    const length = view.getUint32(ctx.offset, false);
    ctx.offset += 4;
    const schemaLen = schema.length;
    for (let i = 0; i < length; i++) {
      skipSchema(schema[i % schemaLen], buf, view, ctx);
    }
    return;
  }

  if (typeof schema === "object" && schema !== null) {
    for (const key in schema) {
      skipSchema((schema as any)[key], buf, view, ctx);
    }
  }
}

export const unpack = <const S extends Schema | ReadonlyArray<Schema>>(
  data: ArrayBufferLike | ArrayBuffer | Uint8Array | string,
  schema: S,
  opt?: IPackConfigOptions
): SchemaToType<S> => {
  const { useCheckSum, useEncrypt, secret } = resolveConfig(opt);

  let buff = toUint8Array(data);

  // A checksum adds 2 trailing bytes; without one, even a single-byte payload
  // (e.g. a lone UINT8) is a valid package.
  if (!buff || buff.length < (useCheckSum ? 2 : 1)) {
    throw new Error("Invalid package!");
  }

  // Encrypted fast path: decrypt each value's bytes inline while parsing and
  // fold the checksum into the same pass — no full-buffer decrypt pass and no
  // intermediate copy. Bounded so the deferred byte sum stays exact.
  if (useEncrypt && buff.length <= INLINE_DECRYPT_LIMIT) {
    const end = useCheckSum ? buff.length - 2 : buff.length;
    const st: DecState = { offset: 0, sum: 0, end, secret };
    const result = doUnpackDec(schema, buff, st) as SchemaToType<S>;
    if (useCheckSum) {
      // Decrypt + sum any bytes the schema didn't consume so the checksum
      // always covers the full payload (catches length-shortening corruption
      // and keeps the graceful path for schemas that read nothing).
      let { sum } = st;
      for (let p = st.offset; p < end; p++) {
        sum += ((buff[p] - p - secret) & 0xFF) * (p + 1);
      }
      sum &= 0xFFFF;
      if (((sum >> 8) & 0xFF) !== buff[end] || (sum & 0xFF) !== buff[end + 1]) {
        throw new Error(`Data mismatch!`);
      }
    }
    return result;
  }

  buff = decodeBuffer(buff, useCheckSum, useEncrypt, secret);

  const view = new DataView(buff.buffer, buff.byteOffset);
  return doUnpack(schema, buff, view, { offset: 0 }) as SchemaToType<S>;
};

/**
 * Split a packed buffer into per-field slices for an object schema.
 * Uses skipSchema to find field boundaries without actually unpacking.
 * Returns a map of key -> Uint8Array slice for each field.
 *
 * The input data must already be decrypted (pass useCheckSum: false, useEncrypt: false
 * or pre-process with decryptBuffer).
 */
export const splitPackedParts = (
  data: ArrayBufferLike | ArrayBuffer | Uint8Array | string,
  dataSchema: { [name: string]: Schema | Schema[] },
  opt?: IPackConfigOptions
): { [key: string]: Uint8Array } => {
  const { useCheckSum, useEncrypt, secret } = resolveConfig(opt);

  let buff = toUint8Array(data);

  // A checksum adds 2 trailing bytes; without one, even a single-byte payload
  // (e.g. a lone UINT8) is a valid package.
  if (!buff || buff.length < (useCheckSum ? 2 : 1)) {
    throw new Error("Invalid package!");
  }

  buff = decodeBuffer(buff, useCheckSum, useEncrypt, secret);

  const view = new DataView(buff.buffer, buff.byteOffset);
  const ctx = { offset: 0 };
  const parts: { [key: string]: Uint8Array } = {};

  for (const key in dataSchema) {
    const start = ctx.offset;
    skipSchema(dataSchema[key], buff, view, ctx);
    parts[key] = buff.subarray(start, ctx.offset);
  }

  return parts;
};

/**
 * Unpack a single field part (as returned by splitPackedParts).
 * No encryption/checksum handling — parts are already decrypted raw data.
 */
export const unpackPart = <const S extends Schema | ReadonlyArray<Schema>>(
  part: Uint8Array,
  schema: S,
): SchemaToType<S> => {
  const view = new DataView(part.buffer, part.byteOffset);
  return doUnpack(schema, part, view, { offset: 0 }) as SchemaToType<S>;
};

/**
 * Unpack each field of an object schema independently.
 * Splits the buffer into per-field slices, then unpacks each one separately.
 * Each field can be unpacked in parallel using Workers by the caller.
 *
 * Falls back to regular unpack if schema is not an object or has fewer than 2 keys.
 */
export const unpackParallel = async <const S extends Schema | ReadonlyArray<Schema>>(
  data: ArrayBufferLike | ArrayBuffer | Uint8Array | string,
  schema: S,
  opt?: IPackConfigOptions
): Promise<SchemaToType<S>> => {
  if (typeof schema !== "object" || Array.isArray(schema)) {
    return unpack(data, schema, opt);
  }

  const keys = Object.keys(schema);
  if (keys.length < 2) {
    return unpack(data, schema, opt);
  }

  // Split into parts (handles decryption/checksum)
  const parts = splitPackedParts(data, schema as any, opt);

  // Unpack each part independently
  const result: any = {};
  for (const key of keys) {
    result[key] = unpackPart(parts[key], (schema as any)[key]);
  }

  return result as SchemaToType<S>;
};
