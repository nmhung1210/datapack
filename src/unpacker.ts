
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  defaultConfig,
  SchemaToType,
  toUint8Array,
} from "./utils";

const decoder = new TextDecoder();

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
        return;
      case DataTypes.UINT16:
      case DataTypes.INT16:
        ctx.offset += 2;
        return;
      case DataTypes.UINT32:
      case DataTypes.INT32:
      case DataTypes.FLOAT:
        ctx.offset += 4;
        return;
      case DataTypes.UINT64:
      case DataTypes.INT64:
      case DataTypes.FLOAT64:
        ctx.offset += 8;
        return;
      case DataTypes.BINARY:
      case DataTypes.STRING:
      case DataTypes.OBJECT: {
        const length = view.getUint32(ctx.offset, false);
        ctx.offset += 4 + length;
        return;
      }
    }
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
  const useCheckSum = opt ? (opt.useCheckSum ?? defaultConfig.useCheckSum) : defaultConfig.useCheckSum;
  const useEncrypt = opt ? (opt.useEncrypt ?? defaultConfig.useEncrypt) : defaultConfig.useEncrypt;
  const secret = opt ? (opt.secret ?? defaultConfig.secret) : defaultConfig.secret;

  let buff = toUint8Array(data);

  if (!buff || buff.length < 2) {
    throw new Error("Invalid package!");
  }

  if (useEncrypt) {
    // Decrypt: need a mutable copy, combined decrypt+checksum in one pass
    const dataEndOffset = useCheckSum ? buff.length - 2 : buff.length;
    const dataBuff = new Uint8Array(dataEndOffset);
    let checksum = 0;
    // Unrolled: process 4 bytes per iteration
    const end4 = dataEndOffset - (dataEndOffset % 4);
    let i = 0;
    for (; i < end4; i += 4) {
      const d0 = (buff[i] - i - secret) & 0xFF;
      const d1 = (buff[i + 1] - i - 1 - secret) & 0xFF;
      const d2 = (buff[i + 2] - i - 2 - secret) & 0xFF;
      const d3 = (buff[i + 3] - i - 3 - secret) & 0xFF;
      dataBuff[i] = d0;
      dataBuff[i + 1] = d1;
      dataBuff[i + 2] = d2;
      dataBuff[i + 3] = d3;
      checksum += d0 + d1 + d2 + d3;
    }
    for (; i < dataEndOffset; i++) {
      const d = (buff[i] - i - secret) & 0xFF;
      dataBuff[i] = d;
      checksum += d;
    }
    if (useCheckSum) {
      const fullView = new DataView(buff.buffer, buff.byteOffset);
      const validchecksum = fullView.getInt16(dataEndOffset, false);
      if ((checksum % 32000) !== validchecksum) {
        throw new Error(`Data mismatch!`);
      }
    }
    buff = dataBuff;
  } else if (useCheckSum) {
    // Checksum only: no copy needed, just validate (unrolled)
    const dataEndOffset = buff.length - 2;
    let checksum = 0;
    const end8 = dataEndOffset - (dataEndOffset % 8);
    let i = 0;
    for (; i < end8; i += 8) {
      checksum += buff[i] + buff[i + 1] + buff[i + 2] + buff[i + 3]
                + buff[i + 4] + buff[i + 5] + buff[i + 6] + buff[i + 7];
    }
    for (; i < dataEndOffset; i++) {
      checksum += buff[i];
    }
    const fullView = new DataView(buff.buffer, buff.byteOffset);
    const validchecksum = fullView.getInt16(dataEndOffset, false);
    if ((checksum % 32000) !== validchecksum) {
      throw new Error(`Data mismatch!`);
    }
    buff = buff.subarray(0, dataEndOffset);
  }

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
  const useCheckSum = opt ? (opt.useCheckSum ?? defaultConfig.useCheckSum) : defaultConfig.useCheckSum;
  const useEncrypt = opt ? (opt.useEncrypt ?? defaultConfig.useEncrypt) : defaultConfig.useEncrypt;
  const secret = opt ? (opt.secret ?? defaultConfig.secret) : defaultConfig.secret;

  let buff = toUint8Array(data);

  if (!buff || buff.length < 2) {
    throw new Error("Invalid package!");
  }

  if (useEncrypt) {
    const dataEndOffset = useCheckSum ? buff.length - 2 : buff.length;
    const dataBuff = new Uint8Array(dataEndOffset);
    let checksum = 0;
    const end4 = dataEndOffset - (dataEndOffset % 4);
    let i = 0;
    for (; i < end4; i += 4) {
      const d0 = (buff[i] - i - secret) & 0xFF;
      const d1 = (buff[i + 1] - i - 1 - secret) & 0xFF;
      const d2 = (buff[i + 2] - i - 2 - secret) & 0xFF;
      const d3 = (buff[i + 3] - i - 3 - secret) & 0xFF;
      dataBuff[i] = d0;
      dataBuff[i + 1] = d1;
      dataBuff[i + 2] = d2;
      dataBuff[i + 3] = d3;
      checksum += d0 + d1 + d2 + d3;
    }
    for (; i < dataEndOffset; i++) {
      const d = (buff[i] - i - secret) & 0xFF;
      dataBuff[i] = d;
      checksum += d;
    }
    if (useCheckSum) {
      const fullView = new DataView(buff.buffer, buff.byteOffset);
      const validchecksum = fullView.getInt16(dataEndOffset, false);
      if ((checksum % 32000) !== validchecksum) {
        throw new Error(`Data mismatch!`);
      }
    }
    buff = dataBuff;
  } else if (useCheckSum) {
    const dataEndOffset = buff.length - 2;
    let checksum = 0;
    const end8 = dataEndOffset - (dataEndOffset % 8);
    let i = 0;
    for (; i < end8; i += 8) {
      checksum += buff[i] + buff[i + 1] + buff[i + 2] + buff[i + 3]
                + buff[i + 4] + buff[i + 5] + buff[i + 6] + buff[i + 7];
    }
    for (; i < dataEndOffset; i++) {
      checksum += buff[i];
    }
    const fullView = new DataView(buff.buffer, buff.byteOffset);
    const validchecksum = fullView.getInt16(dataEndOffset, false);
    if ((checksum % 32000) !== validchecksum) {
      throw new Error(`Data mismatch!`);
    }
    buff = buff.subarray(0, dataEndOffset);
  }

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
