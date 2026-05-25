
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  defaultConfig,
} from "./utils";

const encoder = new TextEncoder();

let sharedBuff = new Uint8Array(1024 * 10);
let sharedView = new DataView(sharedBuff.buffer);
let offset = 0;

function grow(size: number) {
  const newSize = (sharedBuff.length * 2 + size) | 0;
  const newBuff = new Uint8Array(newSize);
  newBuff.set(sharedBuff.subarray(0, offset));
  sharedBuff = newBuff;
  sharedView = new DataView(sharedBuff.buffer);
}

function doPack(data: any, schema: Schema | Array<Schema>) {
  if (typeof schema === "number") {
    switch (schema) {
      case DataTypes.UINT8:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT8. Expected number.');
        if (offset + 1 > sharedBuff.length) grow(1);
        sharedView.setUint8(offset, data);
        offset += 1;
        return;
      case DataTypes.BOOL:
        if (typeof data !== 'boolean') throw new Error('Invalid data type for BOOL. Expected boolean.');
        if (offset + 1 > sharedBuff.length) grow(1);
        sharedView.setUint8(offset, data ? 1 : 0);
        offset += 1;
        return;
      case DataTypes.INT8:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT8. Expected number.');
        if (offset + 1 > sharedBuff.length) grow(1);
        sharedView.setInt8(offset, data);
        offset += 1;
        return;
      case DataTypes.UINT16:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT16. Expected number.');
        if (offset + 2 > sharedBuff.length) grow(2);
        sharedView.setUint16(offset, data, false);
        offset += 2;
        return;
      case DataTypes.INT16:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT16. Expected number.');
        if (offset + 2 > sharedBuff.length) grow(2);
        sharedView.setInt16(offset, data, false);
        offset += 2;
        return;
      case DataTypes.UINT32:
        if (typeof data !== 'number') throw new Error('Invalid data type for UINT32. Expected number.');
        if (offset + 4 > sharedBuff.length) grow(4);
        sharedView.setUint32(offset, data, false);
        offset += 4;
        return;
      case DataTypes.INT32:
        if (typeof data !== 'number') throw new Error('Invalid data type for INT32. Expected number.');
        if (offset + 4 > sharedBuff.length) grow(4);
        sharedView.setInt32(offset, data, false);
        offset += 4;
        return;
      case DataTypes.UINT64:
        if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for UINT64. Expected number or bigint.');
        if (offset + 8 > sharedBuff.length) grow(8);
        sharedView.setBigUint64(offset, BigInt(data), false);
        offset += 8;
        return;
      case DataTypes.INT64:
        if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for INT64. Expected number or bigint.');
        if (offset + 8 > sharedBuff.length) grow(8);
        sharedView.setBigInt64(offset, BigInt(data), false);
        offset += 8;
        return;
      case DataTypes.FLOAT:
        if (typeof data !== 'number') throw new Error('Invalid data type for FLOAT. Expected number.');
        if (offset + 4 > sharedBuff.length) grow(4);
        sharedView.setFloat32(offset, data, false);
        offset += 4;
        return;
      case DataTypes.BINARY: {
        if (!(data instanceof Uint8Array)) throw new Error('Invalid data type for BINARY. Expected Uint8Array.');
        const len = data.length;
        if (offset + 4 + len > sharedBuff.length) grow(4 + len);
        sharedView.setInt32(offset, len, false);
        offset += 4;
        sharedBuff.set(data, offset);
        offset += len;
        return;
      }
      case DataTypes.STRING: {
        if (typeof data !== 'string') throw new Error('Invalid data type for STRING. Expected string.');
        const strLen = data.length;
        if (offset + 4 + strLen > sharedBuff.length) grow(4 + strLen * 3);
        // Fast path for ASCII strings
        let len = strLen;
        let isAscii = true;
        const start = offset + 4;
        for (let i = 0; i < strLen; i++) {
          const c = data.charCodeAt(i);
          if (c > 127) { isAscii = false; break; }
          sharedBuff[start + i] = c;
        }
        if (!isAscii) {
          if (offset + 4 + strLen * 3 > sharedBuff.length) grow(4 + strLen * 3);
          const result = encoder.encodeInto(data, sharedBuff.subarray(offset + 4));
          len = result.written!;
        }
        sharedView.setInt32(offset, len, false);
        offset += 4 + len;
        return;
      }
      case DataTypes.OBJECT: {
        const json = JSON.stringify(data);
        const maxLen = json.length * 3;
        if (offset + 4 + maxLen > sharedBuff.length) grow(4 + maxLen);
        const result = encoder.encodeInto(json, sharedBuff.subarray(offset + 4));
        const len = result.written!;
        sharedView.setInt32(offset, len, false);
        offset += 4 + len;
        return;
      }
    }
  } else if (Array.isArray(schema)) {
    const arrLen = data.length;
    const schemaLen = schema.length;
    if (offset + 4 > sharedBuff.length) grow(4);
    sharedView.setUint32(offset, arrLen, false);
    offset += 4;
    for (let i = 0; i < arrLen; i++) {
      doPack(data[i], schema[i % schemaLen]);
    }
  } else {
    for (const key in schema) {
      doPack(data[key], (schema as any)[key]);
    }
  }
}

export const pack = (
  data: any,
  dataSchema: Schema | Array<Schema>,
  opt?: IPackConfigOptions
) => {
  const useCheckSum = opt ? (opt.useCheckSum ?? defaultConfig.useCheckSum) : defaultConfig.useCheckSum;
  const useEncrypt = opt ? (opt.useEncrypt ?? defaultConfig.useEncrypt) : defaultConfig.useEncrypt;
  const secret = opt ? (opt.secret ?? defaultConfig.secret) : defaultConfig.secret;

  offset = 0;
  doPack(data, dataSchema);

  const dataLen = offset;

  if (!useCheckSum && !useEncrypt) {
    // Fast path: just copy the data out
    return sharedBuff.slice(0, dataLen);
  }

  const finalBuffSize = dataLen + (useCheckSum ? 2 : 0);
  const finalBuff = new Uint8Array(finalBuffSize);
  finalBuff.set(sharedBuff.subarray(0, dataLen));

  let checksum = 0;
  if (useEncrypt) {
    for (let i = 0; i < dataLen; i++) {
      checksum += finalBuff[i];
      finalBuff[i] = (finalBuff[i] + i + secret) & 0xFF;
    }
  } else {
    for (let i = 0; i < dataLen; i++) {
      checksum += finalBuff[i];
    }
  }

  if (useCheckSum) {
    const view = new DataView(finalBuff.buffer);
    view.setInt16(dataLen, checksum % 32000, false);
  }

  return finalBuff;
};
