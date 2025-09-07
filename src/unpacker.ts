
import { Buffer } from "buffer/index";
import {
  DataTypes,
  Schema,
  IPackConfigOptions,
  defaultConfig,
  SchemaToType,
} from "./utils";

const unpackerFunctions: {
  [key in DataTypes]: (buf: Buffer, ctx: { offset: number }) => any;
} = {
  [DataTypes.UINT8]: (buf, ctx) => {
    const val = buf.readUInt8(ctx.offset);
    ctx.offset += 1;
    return val;
  },
  [DataTypes.INT8]: (buf, ctx) => {
    const val = buf.readInt8(ctx.offset);
    ctx.offset += 1;
    return val;
  },
  [DataTypes.BOOL]: (buf, ctx) => {
    const val = !!buf.readUInt8(ctx.offset);
    ctx.offset += 1;
    return val;
  },
  [DataTypes.UINT16]: (buf, ctx) => {
    const val = buf.readUInt16BE(ctx.offset);
    ctx.offset += 2;
    return val;
  },
  [DataTypes.INT16]: (buf, ctx) => {
    const val = buf.readInt16BE(ctx.offset);
    ctx.offset += 2;
    return val;
  },
  [DataTypes.UINT32]: (buf, ctx) => {
    const val = buf.readUInt32BE(ctx.offset);
    ctx.offset += 4;
    return val;
  },
  [DataTypes.INT32]: (buf, ctx) => {
    const val = buf.readInt32BE(ctx.offset);
    ctx.offset += 4;
    return val;
  },
  [DataTypes.UINT64]: (buf, ctx) => {
    const val = buf.readBigUInt64BE(ctx.offset);
    ctx.offset += 8;
    return val;
  },
  [DataTypes.INT64]: (buf, ctx) => {
    const val = buf.readBigInt64BE(ctx.offset);
    ctx.offset += 8;
    return val;
  },
  [DataTypes.FLOAT]: (buf, ctx) => {
    const val = buf.readFloatBE(ctx.offset);
    ctx.offset += 4;
    return val;
  },
  [DataTypes.BINARY]: (buf, ctx) => {
    const length = buf.readUInt32BE(ctx.offset);
    ctx.offset += 4;
    const val = buf.slice(ctx.offset, ctx.offset + length);
    ctx.offset += length;
    return val;
  },
  [DataTypes.STRING]: (buf, ctx) => {
    const length = buf.readUInt32BE(ctx.offset);
    ctx.offset += 4;
    const val = buf.toString("utf-8", ctx.offset, ctx.offset + length);
    ctx.offset += length;
    return val;
  },
  [DataTypes.OBJECT]: (buf, ctx) => {
    const length = buf.readUInt32BE(ctx.offset);
    ctx.offset += 4;
    const val = JSON.parse(buf.toString("utf-8", ctx.offset, ctx.offset + length));
    ctx.offset += length;
    return val;
  },
};

export const unpack = <S extends Schema | Array<Schema>>(
  data: ArrayBufferLike | ArrayBuffer | Uint8Array | string,
  schema: S,
  opt?: IPackConfigOptions
): SchemaToType<S> => {
  const conf = Object.assign({}, defaultConfig, opt || {});
  let buff = data instanceof Buffer ? data : Buffer.from(data as any);

  if (!buff || buff.length < 2) {
    throw new Error("Invalid package!");
  }

  if (conf.useCheckSum || conf.useEncrypt) {
    const dataBuff = Buffer.from(buff.slice(0, buff.length - 2));
    let checksum = 0;
    for (let i = 0; i < dataBuff.length; i++) {
      if (conf.useEncrypt) {
        dataBuff[i] = dataBuff[i] - i - conf.secret;
      }
      checksum += dataBuff[i];
    }
    checksum = checksum % 32000;

    if (conf.useCheckSum) {
      const validchecksum = buff.readInt16BE(buff.length - 2);
      if (checksum !== validchecksum) {
        throw new Error(`Data mismatch! ${checksum} vs ${validchecksum}`);
      }
    }
    buff = dataBuff;
  }

  const doUnpack = (
    schema: Schema | Array<Schema>,
    buf: Buffer,
    ctx: { offset: number }
  ): any => {
    if (typeof schema === "number") {
      return unpackerFunctions[schema](buf, ctx);
    }

    if (Array.isArray(schema)) {
      const length = buf.readUInt32BE(ctx.offset);
      ctx.offset += 4;
      let val: any[] = [];
      for (let i = 0; i < length; ++i) {
        const result = doUnpack(schema[i % schema.length], buf, ctx);
        val.push(result);
      }
      return val;
    }

    if (typeof schema === "object") {
      let val: any = {};
      for (const key in schema) {
        val[key] = doUnpack((schema as { [name: string]: Schema })[key], buf, ctx);
      }
      return val;
    }

    return undefined;
  };

  return doUnpack(schema, buff, { offset: 0 }) as SchemaToType<S>;
};
