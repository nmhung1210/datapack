
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  resolveConfig,
  computeChecksum,
} from "./utils";

const encoder = new TextEncoder();

// ============ Reentrant Packer Context ============

export class PackerContext {
  buf: Uint8Array;
  view: DataView;
  offset: number;

  constructor(initialSize = 1024 * 10) {
    this.buf = new Uint8Array(initialSize);
    this.view = new DataView(this.buf.buffer);
    this.offset = 0;
  }

  grow(size: number) {
    const newSize = (this.buf.length * 2 + size) | 0;
    const newBuff = new Uint8Array(newSize);
    newBuff.set(this.buf.subarray(0, this.offset));
    this.buf = newBuff;
    this.view = new DataView(this.buf.buffer);
  }

  getResult(): Uint8Array {
    return this.buf.slice(0, this.offset);
  }

  reset() {
    this.offset = 0;
  }
}

export function doPackCtx(ctx: PackerContext, data: any, schema: Schema | Array<Schema>) {
  if (typeof schema === "number") {
    switch (schema) {
      case DataTypes.UINT8:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT8. Expected number.');
        if (!Number.isInteger(data) || data < 0 || data > 0xFF) throw new RangeError('Value out of range for UINT8 (0..255).');
        if (ctx.offset + 1 > ctx.buf.length) ctx.grow(1);
        ctx.view.setUint8(ctx.offset, data);
        ctx.offset += 1;
        return;
      case DataTypes.BOOL:
        if (typeof data !== 'boolean') throw new Error('Invalid data type for BOOL. Expected boolean.');
        if (ctx.offset + 1 > ctx.buf.length) ctx.grow(1);
        ctx.view.setUint8(ctx.offset, data ? 1 : 0);
        ctx.offset += 1;
        return;
      case DataTypes.INT8:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT8. Expected number.');
        if (!Number.isInteger(data) || data < -0x80 || data > 0x7F) throw new RangeError('Value out of range for INT8 (-128..127).');
        if (ctx.offset + 1 > ctx.buf.length) ctx.grow(1);
        ctx.view.setInt8(ctx.offset, data);
        ctx.offset += 1;
        return;
      case DataTypes.UINT16:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT16. Expected number.');
        if (!Number.isInteger(data) || data < 0 || data > 0xFFFF) throw new RangeError('Value out of range for UINT16 (0..65535).');
        if (ctx.offset + 2 > ctx.buf.length) ctx.grow(2);
        ctx.view.setUint16(ctx.offset, data, false);
        ctx.offset += 2;
        return;
      case DataTypes.INT16:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT16. Expected number.');
        if (!Number.isInteger(data) || data < -0x8000 || data > 0x7FFF) throw new RangeError('Value out of range for INT16 (-32768..32767).');
        if (ctx.offset + 2 > ctx.buf.length) ctx.grow(2);
        ctx.view.setInt16(ctx.offset, data, false);
        ctx.offset += 2;
        return;
      case DataTypes.UINT32:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT32. Expected number.');
        if (!Number.isInteger(data) || data < 0 || data > 0xFFFFFFFF) throw new RangeError('Value out of range for UINT32 (0..4294967295).');
        if (ctx.offset + 4 > ctx.buf.length) ctx.grow(4);
        ctx.view.setUint32(ctx.offset, data, false);
        ctx.offset += 4;
        return;
      case DataTypes.INT32:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT32. Expected number.');
        if (!Number.isInteger(data) || data < -0x80000000 || data > 0x7FFFFFFF) throw new RangeError('Value out of range for INT32 (-2147483648..2147483647).');
        if (ctx.offset + 4 > ctx.buf.length) ctx.grow(4);
        ctx.view.setInt32(ctx.offset, data, false);
        ctx.offset += 4;
        return;
      case DataTypes.UINT64:
        if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for UINT64. Expected number or bigint.');
        if (ctx.offset + 8 > ctx.buf.length) ctx.grow(8);
        ctx.view.setBigUint64(ctx.offset, BigInt(data), false);
        ctx.offset += 8;
        return;
      case DataTypes.INT64:
        if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for INT64. Expected number or bigint.');
        if (ctx.offset + 8 > ctx.buf.length) ctx.grow(8);
        ctx.view.setBigInt64(ctx.offset, BigInt(data), false);
        ctx.offset += 8;
        return;
      case DataTypes.FLOAT:
        if (typeof data !== 'number') throw new Error('Invalid data type for FLOAT. Expected number.');
        if (ctx.offset + 4 > ctx.buf.length) ctx.grow(4);
        ctx.view.setFloat32(ctx.offset, data, false);
        ctx.offset += 4;
        return;
      case DataTypes.FLOAT64:
        if (typeof data !== 'number') throw new Error('Invalid data type for FLOAT64. Expected number.');
        if (ctx.offset + 8 > ctx.buf.length) ctx.grow(8);
        ctx.view.setFloat64(ctx.offset, data, false);
        ctx.offset += 8;
        return;
      case DataTypes.BINARY: {
        if (!(data instanceof Uint8Array)) throw new Error('Invalid data type for BINARY. Expected Uint8Array.');
        const len = data.length;
        if (ctx.offset + 4 + len > ctx.buf.length) ctx.grow(4 + len);
        ctx.view.setUint32(ctx.offset, len, false);
        ctx.offset += 4;
        ctx.buf.set(data, ctx.offset);
        ctx.offset += len;
        return;
      }
      case DataTypes.STRING: {
        if (typeof data !== 'string') throw new Error('Invalid data type for STRING. Expected string.');
        const strLen = data.length;
        if (ctx.offset + 4 + strLen > ctx.buf.length) ctx.grow(4 + strLen * 3);
        let len = strLen;
        let isAscii = true;
        const start = ctx.offset + 4;
        for (let i = 0; i < strLen; i++) {
          const c = data.charCodeAt(i);
          if (c > 127) { isAscii = false; break; }
          ctx.buf[start + i] = c;
        }
        if (!isAscii) {
          if (ctx.offset + 4 + strLen * 3 > ctx.buf.length) ctx.grow(4 + strLen * 3);
          const result = encoder.encodeInto(data, ctx.buf.subarray(ctx.offset + 4));
          len = result.written!;
        }
        ctx.view.setUint32(ctx.offset, len, false);
        ctx.offset += 4 + len;
        return;
      }
      case DataTypes.OBJECT: {
        const json = JSON.stringify(data);
        const maxLen = json.length * 3;
        if (ctx.offset + 4 + maxLen > ctx.buf.length) ctx.grow(4 + maxLen);
        const result = encoder.encodeInto(json, ctx.buf.subarray(ctx.offset + 4));
        const len = result.written!;
        ctx.view.setUint32(ctx.offset, len, false);
        ctx.offset += 4 + len;
        return;
      }
    }
  } else if (Array.isArray(schema)) {
    const arrLen = data.length;
    const schemaLen = schema.length;
    if (ctx.offset + 4 > ctx.buf.length) ctx.grow(4);
    ctx.view.setUint32(ctx.offset, arrLen, false);
    ctx.offset += 4;
    for (let i = 0; i < arrLen; i++) {
      doPackCtx(ctx, data[i], schema[i % schemaLen]);
    }
  } else {
    for (const key in schema) {
      doPackCtx(ctx, data[key], (schema as any)[key]);
    }
  }
}

// ============ Default shared context for fast single-threaded pack ============

const defaultCtx = new PackerContext();

export const pack = (
  data: any,
  dataSchema: Schema | Array<Schema>,
  opt?: IPackConfigOptions
) => {
  const { useCheckSum, useEncrypt, secret } = resolveConfig(opt);

  defaultCtx.reset();
  doPackCtx(defaultCtx, data, dataSchema);

  const dataLen = defaultCtx.offset;
  const src = defaultCtx.buf;

  if (!useCheckSum && !useEncrypt) {
    return src.slice(0, dataLen);
  }

  const finalBuffSize = dataLen + (useCheckSum ? 2 : 0);
  const finalBuff = new Uint8Array(finalBuffSize);

  // The checksum is the plaintext byte sum (so unpack decrypts first, then
  // validates), written as a big-endian unsigned 16-bit int. Encryption is a
  // position-dependent byte shift by `i + secret`. When both are on we fold the
  // sum into the same pass.
  if (useEncrypt && useCheckSum) {
    let sum = 0;
    for (let i = 0; i < dataLen; i++) {
      const b = src[i];
      sum += b * (i + 1);
      finalBuff[i] = (b + i + secret) & 0xFF;
    }
    finalBuff[dataLen] = (sum >> 8) & 0xFF;
    finalBuff[dataLen + 1] = sum & 0xFF;
  } else if (useEncrypt) {
    for (let i = 0; i < dataLen; i++) {
      finalBuff[i] = (src[i] + i + secret) & 0xFF;
    }
  } else if (useCheckSum) {
    // Fuse the copy into the checksum pass (no subarray, no DataView).
    let sum = 0;
    for (let i = 0; i < dataLen; i++) {
      const b = src[i];
      sum += b * (i + 1);
      finalBuff[i] = b;
    }
    finalBuff[dataLen] = (sum >> 8) & 0xFF;
    finalBuff[dataLen + 1] = sum & 0xFF;
  } else {
    finalBuff.set(src.subarray(0, dataLen));
  }

  return finalBuff;
};

// ============ Parallel packing for object schemas ============

/**
 * Pack each field of an object schema independently using separate PackerContext instances.
 * Each field is packed with its own buffer, enabling true parallelism when the caller
 * distributes packParts calls across Web Workers or worker_threads.
 *
 * Falls back to sequential pack if schema is not an object or has fewer than 2 keys.
 */
export const packParallel = async (
  data: any,
  dataSchema: Schema | Array<Schema>,
  opt?: IPackConfigOptions
): Promise<Uint8Array> => {
  // Only parallelize object schemas with multiple keys
  if (typeof dataSchema !== "object" || Array.isArray(dataSchema)) {
    return pack(data, dataSchema, opt);
  }

  const keys = Object.keys(dataSchema);
  if (keys.length < 2) {
    return pack(data, dataSchema, opt);
  }

  const parts = packParts(data, dataSchema as any);
  return combinePackedParts(parts, keys, opt);
};

/**
 * Pack each field of an object schema in parallel without worker_threads.
 * Uses separate PackerContext instances for each field, enabling true
 * parallelism when called from within Web Workers or worker_threads by the user.
 *
 * Returns packed parts that can be combined with combinePackedParts().
 */
export const packParts = (
  data: any,
  dataSchema: { [name: string]: Schema | Schema[] },
): { [key: string]: Uint8Array } => {
  const result: { [key: string]: Uint8Array } = {};
  for (const key in dataSchema) {
    const ctx = new PackerContext();
    doPackCtx(ctx, data[key], dataSchema[key]);
    result[key] = ctx.getResult();
  }
  return result;
};

/**
 * Combine independently packed parts into a single buffer.
 * Parts must be in the same key order as the schema.
 */
export const combinePackedParts = (
  parts: { [key: string]: Uint8Array },
  schemaKeys: string[],
  opt?: IPackConfigOptions
): Uint8Array => {
  const { useCheckSum, useEncrypt, secret } = resolveConfig(opt);

  let totalLen = 0;
  for (const key of schemaKeys) {
    totalLen += parts[key].length;
  }

  const finalBuffSize = totalLen + (useCheckSum ? 2 : 0);
  const finalBuff = new Uint8Array(finalBuffSize);
  let pos = 0;
  for (const key of schemaKeys) {
    finalBuff.set(parts[key], pos);
    pos += parts[key].length;
  }

  // Checksum over the plaintext first, then encrypt the bytes in place with a
  // position-dependent shift by `i + secret`.
  const checksum = useCheckSum ? computeChecksum(finalBuff, totalLen) : 0;
  if (useEncrypt) {
    for (let i = 0; i < totalLen; i++) {
      finalBuff[i] = (finalBuff[i] + i + secret) & 0xFF;
    }
  }
  if (useCheckSum) {
    finalBuff[totalLen] = (checksum >> 8) & 0xFF;
    finalBuff[totalLen + 1] = checksum & 0xFF;
  }

  return finalBuff;
};
