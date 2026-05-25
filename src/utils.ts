
export enum DataTypes {
  UINT8 = 0,
  UINT16,
  UINT32,
  UINT64,
  INT8,
  INT16,
  INT32,
  INT64,
  BOOL,
  FLOAT,
  BINARY,
  STRING,
  OBJECT,
}

export const {
  UINT8,
  UINT16,
  UINT32,
  UINT64,
  INT8,
  INT16,
  INT32,
  INT64,
  BOOL,
  FLOAT,
  BINARY,
  STRING,
  OBJECT,
} = DataTypes;

export type Schema =
  | DataTypes
  | DataTypes[]
  | readonly DataTypes[]
  | { [name: string]: Schema | Schema[] | readonly Schema[] };

export type DataTypeMap = {
  [DataTypes.UINT8]: number;
  [DataTypes.UINT16]: number;
  [DataTypes.UINT32]: number;
  [DataTypes.UINT64]: bigint;
  [DataTypes.INT8]: number;
  [DataTypes.INT16]: number;
  [DataTypes.INT32]: number;
  [DataTypes.INT64]: bigint;
  [DataTypes.BOOL]: boolean;
  [DataTypes.FLOAT]: number;
  [DataTypes.BINARY]: Uint8Array;
  [DataTypes.STRING]: string;
  [DataTypes.OBJECT]: any;
};

type ResolveDataType<S extends DataTypes> = DataTypes extends S
  ? number | string | boolean | bigint | Uint8Array
  : DataTypeMap[S];

export type SchemaToType<S extends Schema | ReadonlyArray<Schema>> = S extends DataTypes
  ? ResolveDataType<S>
  : S extends object
  ? S extends ReadonlyArray<infer U>
    ? U extends Schema
      ? SchemaToType<U>[]
      : never
    : { -readonly [K in keyof S]: S[K] extends Schema | ReadonlyArray<Schema> ? SchemaToType<S[K]> : never }
  : never;

export interface IPackConfig {
  chunkSize: number;
  useEncrypt: boolean;
  useCheckSum: boolean;
  secret: number;

}
export interface IPackConfigOptions {
  chunkSize?: number;
  useEncrypt?: boolean;
  useCheckSum?: boolean;
  secret?: number;
}

export const defaultConfig: IPackConfig = {
  chunkSize: 10240,
  useEncrypt: true,
  useCheckSum: true,
  secret: 1210
};

export function setDefaultConfig(opts: IPackConfigOptions): void {
  if (opts.chunkSize !== undefined) defaultConfig.chunkSize = opts.chunkSize;
  if (opts.useEncrypt !== undefined) defaultConfig.useEncrypt = opts.useEncrypt;
  if (opts.useCheckSum !== undefined) defaultConfig.useCheckSum = opts.useCheckSum;
  if (opts.secret !== undefined) defaultConfig.secret = opts.secret;
}

export function defineSchema<const T extends Schema>(schema: T): T {
  return schema;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeUTF8(str: string): Uint8Array {
  return encoder.encode(str);
}

export function decodeUTF8(bytes: Uint8Array, start?: number, end?: number): string {
  return decoder.decode(bytes.subarray(start, end));
}

export function toUint8Array(data: ArrayBufferLike | ArrayBuffer | Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    return encoder.encode(data);
  }
  return new Uint8Array(data as ArrayBuffer);
}
