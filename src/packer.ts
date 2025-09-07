
import { Buffer } from "buffer/index";
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  defaultConfig,
} from "./utils";

let sharedBuff = Buffer.alloc(1024 * 10); // Start with 10KB
let offset = 0;

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
      sharedBuff.copy(newBuff, 0, 0, offset);
      sharedBuff = newBuff;
    }
  };

  const doPack = (data: any, schema: Schema | Array<Schema>) => {
    if (typeof schema === "number") {
      switch (schema) {
        case DataTypes.UINT8:
        case DataTypes.BOOL:
          ensureSize(1);
          offset = sharedBuff.writeUInt8(
            schema === DataTypes.BOOL ? (data ? 1 : 0) : data,
            offset
          );
          break;
        case DataTypes.INT8:
          ensureSize(1);
          offset = sharedBuff.writeInt8(data, offset);
          break;
        case DataTypes.UINT16:
          ensureSize(2);
          offset = sharedBuff.writeUInt16BE(data, offset);
          break;
        case DataTypes.INT16:
          ensureSize(2);
          offset = sharedBuff.writeInt16BE(data, offset);
          break;
        case DataTypes.UINT32:
          ensureSize(4);
          offset = sharedBuff.writeUInt32BE(data, offset);
          break;
        case DataTypes.INT32:
          ensureSize(4);
          offset = sharedBuff.writeInt32BE(data, offset);
          break;
        case DataTypes.UINT64:
          ensureSize(8);
          offset = Number(sharedBuff.writeBigUInt64BE(data, offset));
          break;
        case DataTypes.INT64:
          ensureSize(8);
          offset = Number(sharedBuff.writeBigInt64BE(data, offset));
          break;
        case DataTypes.FLOAT:
          ensureSize(4);
          offset = sharedBuff.writeFloatBE(data, offset);
          break;
        case DataTypes.BINARY:
          const dataBuff = data as Buffer;
          ensureSize(4 + dataBuff.length);
          offset = sharedBuff.writeInt32BE(dataBuff.length, offset);
          dataBuff.copy(sharedBuff, offset);
          offset += dataBuff.length;
          break;
        case DataTypes.STRING: {
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
  sharedBuff.copy(finalBuff, 0, 0, offset);

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
