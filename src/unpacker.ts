
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
  schema: Schema | Array<Schema>,
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

export const unpack = <S extends Schema | Array<Schema>>(
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

  if (useCheckSum || useEncrypt) {
    const dataEndOffset = useCheckSum ? buff.length - 2 : buff.length;
    const dataBuff = new Uint8Array(buff.slice(0, dataEndOffset));
    let checksum = 0;

    if (useEncrypt) {
      for (let i = 0; i < dataBuff.length; i++) {
        dataBuff[i] = (dataBuff[i] - i - secret) & 0xFF;
        checksum += dataBuff[i];
      }
    } else {
      for (let i = 0; i < dataBuff.length; i++) {
        checksum += dataBuff[i];
      }
    }

    if (useCheckSum) {
      const fullView = new DataView(buff.buffer, buff.byteOffset);
      const validchecksum = fullView.getInt16(dataEndOffset, false);
      if ((checksum % 32000) !== validchecksum) {
        throw new Error(`Data mismatch!`);
      }
    }
    buff = dataBuff;
  }

  const view = new DataView(buff.buffer, buff.byteOffset);
  return doUnpack(schema, buff, view, { offset: 0 }) as SchemaToType<S>;
};
