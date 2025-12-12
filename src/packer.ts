
import { Buffer } from "buffer";
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  defaultConfig,
} from "./utils";

let sharedBuff = Buffer.alloc(1024 * 10); // Start with 10KB
let offset = 0;


if (typeof Buffer.prototype.writeBigUInt64BE !== 'function') {
  Buffer.prototype.writeBigUInt64BE = function (value: bigint, offset: number = 0): number {
    const high = Number(value >> BigInt(32));
    const low = Number(value & BigInt(0xFFFFFFFF));
    this.writeUInt32BE(high, offset);
    this.writeUInt32BE(low, offset + 4);
    return offset + 8;
  };
};

if (typeof Buffer.prototype.readBigUInt64BE !== 'function') {
  Buffer.prototype.readBigUInt64BE = function (offset: number = 0): bigint {
    const high = BigInt(this.readUInt32BE(offset));
    const low = BigInt(this.readUInt32BE(offset + 4));
    return (high << BigInt(32)) + low;
  };
};

export const pack = (
  data: any,
  dataSchema: Schema | Array<Schema>,
  opt?: IPackConfigOptions
) => {
  const conf = Object.assign({}, defaultConfig, opt || {});

  offset = 0;

  const ensureSize = (size: number) => {
    if (offset + size > sharedBuff.length) {
      const newBuff = Buffer.alloc(sharedBuff.length * 2 + size);
      sharedBuff.copy(newBuff as Uint8Array, 0, 0, offset);
      sharedBuff = newBuff;
    }
  };

  const doPack = (data: any, schema: Schema | Array<Schema>) => {
    if (typeof schema === "number") {
      switch (schema) {
        case DataTypes.UINT8:
          if (typeof data !== 'number') throw new Error('Invalid data type for UINT8. Expected number.');
          ensureSize(1);
          offset = sharedBuff.writeUInt8(data, offset);
          break;
        case DataTypes.BOOL:
          if (typeof data !== 'boolean') throw new Error('Invalid data type for BOOL. Expected boolean.');
          ensureSize(1);
          offset = sharedBuff.writeUInt8(data ? 1 : 0, offset);
          break;
        case DataTypes.INT8:
          if (typeof data !== 'number') throw new Error('Invalid data type for INT8. Expected number.');
          ensureSize(1);
          offset = sharedBuff.writeInt8(data, offset);
          break;
        case DataTypes.UINT16:
          if (typeof data !== 'number') throw new Error('Invalid data type for UINT16. Expected number.');
          ensureSize(2);
          offset = sharedBuff.writeUInt16BE(data, offset);
          break;
        case DataTypes.INT16:
          if (typeof data !== 'number') throw new Error('Invalid data type for INT16. Expected number.');
          ensureSize(2);
          offset = sharedBuff.writeInt16BE(data, offset);
          break;
        case DataTypes.UINT32:
          if (typeof data !== 'number') throw new Error('Invalid data type for UINT32. Expected number.');
          ensureSize(4);
          offset = sharedBuff.writeUInt32BE(data, offset);
          break;
        case DataTypes.INT32:
          if (typeof data !== 'number') throw new Error('Invalid data type for INT32. Expected number.');
          ensureSize(4);
          offset = sharedBuff.writeInt32BE(data, offset);
          break;
        case DataTypes.UINT64:
          if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for UINT64. Expected number or bigint.');
          ensureSize(8);
          offset = Number(sharedBuff.writeBigUInt64BE(BigInt(data), offset));
          break;
        case DataTypes.INT64:
          if (typeof data !== 'number' && typeof data !== 'bigint') throw new Error('Invalid data type for INT64. Expected number or bigint.');
          ensureSize(8);
          offset = Number(sharedBuff.writeBigInt64BE(BigInt(data), offset));
          break;
        case DataTypes.FLOAT:
          if (typeof data !== 'number') throw new Error('Invalid data type for FLOAT. Expected number.');
          ensureSize(4);
          offset = sharedBuff.writeFloatBE(data, offset);
          break;
        case DataTypes.BINARY:
          if (!Buffer.isBuffer(data)) throw new Error('Invalid data type for BINARY. Expected Buffer.');
          const dataBuff = data as Buffer;
          ensureSize(4 + dataBuff.length);
          offset = sharedBuff.writeInt32BE(dataBuff.length, offset);
          dataBuff.copy(sharedBuff as Uint8Array, offset);
          offset += dataBuff.length;
          break;
        case DataTypes.STRING: {
          if (typeof data !== 'string') throw new Error('Invalid data type for STRING. Expected string.');
          const len = Buffer.byteLength(data, "utf8");
          ensureSize(4 + len);
          offset = sharedBuff.writeInt32BE(len, offset);
          offset += sharedBuff.write(data, offset, len, "utf8");
          break;
        }
        case DataTypes.OBJECT: {
          const json = JSON.stringify(data);
          const len = Buffer.byteLength(json, "utf8");
          ensureSize(4 + len);
          offset = sharedBuff.writeInt32BE(len, offset);
          offset += sharedBuff.write(json, offset, len, "utf8");
          break;
        }
      }
    } else if (Array.isArray(schema)) {
      ensureSize(4);
      offset = sharedBuff.writeUInt32BE(data.length, offset);
      data.forEach((itemdata: any, i: number) => {
        const itemschema = schema[i % schema.length];
        doPack(itemdata, itemschema);
      });
    } else if (typeof schema === "object") {
      for (const key in schema) {
        doPack(data[key], (schema as { [name: string]: Schema })[key]);
      }
    }
  };

  doPack(data, dataSchema);

  const finalBuffSize = offset + (conf.useCheckSum ? 2 : 0);
  const finalBuff = Buffer.alloc(finalBuffSize);
  sharedBuff.copy(finalBuff as Uint8Array, 0, 0, offset);

  if (conf.useCheckSum || conf.useEncrypt) {
    let checksum = 0;
    for (let i = 0; i < offset; i++) {
      checksum += finalBuff[i];
      if (conf.useEncrypt) {
        finalBuff[i] = finalBuff[i] + i + conf.secret;
      }
    }
    if (conf.useCheckSum) {
      finalBuff.writeInt16BE(checksum % 32000, offset);
    }
  }

  return finalBuff;
};
